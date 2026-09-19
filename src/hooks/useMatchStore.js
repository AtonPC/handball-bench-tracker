import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { lineupsOf, orderLineup, validateLineup } from '../utils/lineups';

const EXCLUSION_MS = 2 * 60 * 1000;

// Campos de reloj de un jugador: si un evento los toca (cambio, exclusión...),
// deshacerlo solo es exacto mientras el reloj del partido no haya cambiado
// desde entonces (ver recordEvent y undo).
const TIME_FIELDS = new Set(['onCourtSinceMs', 'accumulatedMs']);

// Cambios de jugadores: con el reloj en marcha, o parado ENTRE periodos (tras
// "FIN" de un tiempo/cuarto) — ahí es cuando se rota de verdad. El resto de
// anotaciones siguen exigiendo el reloj en marcha, y una pausa normal
// (parada arbitral) sigue bloqueando también los cambios.
export function canSubstituteNow(match) {
  if (!match) return false;
  return match.status === 'running' || (match.status === 'paused' && !!match.periodEnded);
}

// Los 7 que están en pista, con el portero primero — es lo que se guarda como
// "equipo titular" del periodo que empieza (ver utils/lineups.js).
function courtLineup(match, players) {
  const goalkeeperId = match.courtSlots.find((id) => players[id]?.isGK);
  return orderLineup(match.courtSlots, goalkeeperId);
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Valor ANTERIOR de cada campo que va a cambiar un evento (rutas con puntos
// como 'score.own' incluidas). Se guarda como lista {path, value}, no como
// mapa, porque Firestore no admite claves con puntos ni arrays anidados;
// un campo que no existía se guarda como null.
function beforeValues(source, paths) {
  return paths.map((path) => {
    const value = getPath(source, path);
    return { path, value: value === undefined ? null : value };
  });
}

// Store de un partido concreto (matchId): cronómetro, marcador, jugadores en
// vivo, sustituciones y el log de eventos para deshacer. El partido y su
// convocatoria ya deben existir (creados desde Gestión de Partidos).
export function useMatchStore(matchId, enabled) {
  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState({});
  const [now, setNow] = useState(Date.now());
  const [canUndo, setCanUndo] = useState(false);
  // Último evento del log (etiqueta y jugadores que tocó) — lo enseña la vista
  // reducida como "Última acción", para saber qué se acaba de anotar sin
  // mirar la lista de jugadores.
  const [lastEvent, setLastEvent] = useState(null);
  const closingExclusions = useRef(new Set());

  const matchRef = useMemo(() => (matchId ? doc(db, 'matches', matchId) : null), [matchId]);
  const playersCol = useMemo(() => (matchId ? collection(db, 'matches', matchId, 'players') : null), [matchId]);
  const eventsCol = useMemo(() => (matchId ? collection(db, 'matches', matchId, 'events') : null), [matchId]);
  const playerRef = useCallback((id) => doc(db, 'matches', matchId, 'players', id), [matchId]);

  useEffect(() => {
    if (!enabled || !matchId) {
      setMatch(null);
      setPlayers({});
      return undefined;
    }
    const unsubMatch = onSnapshot(matchRef, (snap) => setMatch(snap.exists() ? snap.data() : null));
    const unsubPlayers = onSnapshot(playersCol, (snap) => {
      const next = {};
      snap.forEach((d) => {
        next[d.id] = { id: d.id, ...d.data() };
      });
      setPlayers(next);
    });
    const unsubEvents = onSnapshot(query(eventsCol, orderBy('createdAt', 'desc'), limit(1)), (snap) => {
      setCanUndo(!snap.empty);
      if (snap.empty) {
        setLastEvent(null);
      } else {
        const data = snap.docs[0].data();
        setLastEvent({ label: data.label, playerIds: (data.undo?.players || []).map((p) => p.id) });
      }
    });
    return () => {
      unsubMatch();
      unsubPlayers();
      unsubEvents();
    };
  }, [enabled, matchId, matchRef, playersCol, eventsCol]);

  // Ticker local: solo fuerza el recálculo de los relojes en pantalla, no
  // escribe en Firestore. El navegador (sobre todo en móvil, con la
  // pantalla bloqueada o la pestaña en segundo plano) puede retrasar
  // setInterval varios segundos de golpe — el reloj entonces "salta" al
  // volver, aunque el valor real (siempre Date.now() menos el inicio, no
  // un acumulador) nunca estuvo mal. Forzar un recálculo inmediato al
  // volver a estar visible acorta al máximo ese salto visible.
  useEffect(() => {
    if (!match || match.status !== 'running') return undefined;
    function resync() {
      if (document.visibilityState === 'visible') setNow(Date.now());
    }
    document.addEventListener('visibilitychange', resync);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', resync);
    };
  }, [match?.status]);

  // Cierra automáticamente las exclusiones que ya han cumplido sus 2 minutos.
  useEffect(() => {
    if (!match || match.status !== 'running') return;
    for (const slotId of match.courtSlots) {
      const p = players[slotId];
      if (!p || !p.excluded || p.exclusionEndsAtMs > now) continue;
      if (closingExclusions.current.has(slotId)) continue;
      closingExclusions.current.add(slotId);
      writeBatch(db)
        .update(playerRef(slotId), {
          excluded: false,
          exclusionEndsAtMs: null,
          onCourtSinceMs: p.exclusionEndsAtMs,
        })
        .commit()
        .finally(() => closingExclusions.current.delete(slotId));
    }
  }, [now, match, players, playerRef]);

  const liveElapsedMs = useMemo(() => {
    if (!match) return 0;
    const running = match.status === 'running' && match.runningSinceMs ? now - match.runningSinceMs : 0;
    return match.accumulatedMs + running;
  }, [match, now]);

  const livePlayers = useMemo(() => {
    const result = {};
    for (const id of Object.keys(players)) {
      const p = players[id];
      const running = p.onCourtSinceMs ? now - p.onCourtSinceMs : 0;
      result[id] = {
        ...p,
        accumulatedMs: p.accumulatedMs + running,
        exclusionRemainingMs: p.excluded ? Math.max(0, p.exclusionEndsAtMs - now) : 0,
      };
    }
    return result;
  }, [players, now]);

  // Un evento puede, además de cambiar el partido/los jugadores:
  //  - `extra.creates` (array; `extra.create` singular sigue aceptándose):
  //    crear documentos de detalle (p. ej. una Parada crea también su Fallo
  //    rival emparejado, ver registerRivalShot). Se guarda su ruta en el
  //    evento para que el deshacer los borre.
  //  - `extra.deletes` (array de {ref, data}): borrar documentos de detalle
  //    (un "−1" borra el gol/parada/... que restaba). Se guarda su contenido
  //    en el evento para que el deshacer los recree.
  // El evento guarda solo el valor ANTERIOR de lo que cambia (`undo`), no una
  // foto del partido entero: así deshacer no pisa nada que no sea de este
  // evento — antes, tras una pausa o un cambio de periodo, restaurar la foto
  // entera devolvía el reloj y el periodo a un estado ya pasado.
  const recordEvent = useCallback(async (label, matchUpdate, playerUpdates, extra) => {
    if (!match) return;
    const batch = writeBatch(db);
    const matchKeys = Object.keys(matchUpdate || {});
    const playerIds = Object.keys(playerUpdates || {});
    if (matchKeys.length > 0) batch.update(matchRef, matchUpdate);
    for (const id of playerIds) {
      batch.update(playerRef(id), playerUpdates[id]);
    }
    const creates = extra?.creates || (extra?.create ? [extra.create] : []);
    for (const c of creates) batch.set(c.ref, c.data);
    const createdRefPaths = creates.map((c) => c.ref.path);
    const deletes = extra?.deletes || [];
    for (const d of deletes) batch.delete(d.ref);
    const deletedDocs = deletes.map((d) => ({ path: d.ref.path, data: d.data }));

    const touchesTime = playerIds.some((id) => Object.keys(playerUpdates[id]).some((k) => TIME_FIELDS.has(k)));
    const undo = {
      match: beforeValues(match, matchKeys),
      players: playerIds.map((id) => ({ id, fields: beforeValues(players[id] || {}, Object.keys(playerUpdates[id])) })),
      // Solo si toca relojes de jugador: estado del reloj del partido en
      // este momento, para saber en el deshacer si sigue siendo el mismo.
      clock: touchesTime ? { status: match.status, runningSinceMs: match.runningSinceMs ?? null, period: match.period } : null,
    };
    batch.set(doc(eventsCol), { label, createdAt: Date.now(), period: match.period, undo, createdRefPaths, deletedDocs, ...(extra?.eventFields || {}) });
    await batch.commit();
  }, [match, players, matchRef, playerRef, eventsCol]);

  // Un "−1" primero busca en Firestore el detalle que va a restar (el último
  // gol de ese jugador, la última parada...). Mientras tanto se ignoran
  // otros "−1" para que dos toques seguidos no borren el mismo documento
  // dos veces. No se espera al commit (sin conexión no resolvería nunca).
  const busyRef = useRef(false);
  const runExclusive = useCallback(async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await fn();
    } finally {
      busyRef.current = false;
    }
  }, []);

  // Último documento (por createdAt) de una subcolección del partido que
  // cumpla todas las condiciones de igualdad. Si no se puede leer (p. ej.
  // sin conexión ni caché), devuelve null y el "−1" se limita al contador,
  // como antes — mejor que dejar el botón muerto en pleno partido.
  const latestDetailDoc = useCallback(async (sub, conditions = []) => {
    try {
      const constraints = conditions.map(([field, value]) => where(field, '==', value));
      const snap = await getDocs(query(collection(db, 'matches', matchId, sub), ...constraints));
      let best = null;
      snap.forEach((d) => {
        const data = d.data();
        if (!best || (data.createdAt || 0) > (best.data.createdAt || 0)) best = { ref: d.ref, id: d.id, data };
      });
      return best;
    } catch (err) {
      console.warn(`No se pudo leer ${sub} para restar`, err);
      return null;
    }
  }, [matchId]);

  // Parada y Fallo rival emparejados: se enlazan por `pairId` (el id de la
  // parada). Los emparejados antes de existir ese campo comparten el mismo
  // createdAt exacto — se buscan por ahí.
  const findPairedDoc = useCallback((sub, source) => {
    if (source.data.pairId) return latestDetailDoc(sub, [['pairId', source.data.pairId]]);
    return latestDetailDoc(sub, [['createdAt', source.data.createdAt]]);
  }, [latestDetailDoc]);

  // --- Controles del cronómetro maestro (no pasan por el log de deshacer) ---
  const startPeriod1 = useCallback(async () => {
    if (!match) return;
    const nowMs = Date.now();
    const batch = writeBatch(db);
    batch.update(matchRef, { status: 'running', period: 1, runningSinceMs: nowMs });
    for (const id of match.courtSlots) {
      if (!players[id]?.excluded) batch.update(playerRef(id), { onCourtSinceMs: nowMs });
    }
    await batch.commit();
  }, [match, players, matchRef, playerRef]);

  // Pausar (parada arbitral) y terminar un periodo comparten mecánica: los
  // dos detienen el reloj. Lo que cambia es `periodEnded`, que es lo único
  // que deja iniciar el siguiente periodo — así una pausa normal a mitad de
  // un cuarto nunca ofrece por error el botón de empezar el siguiente.
  const pauseClock = useCallback(async (endsPeriod) => {
    if (!match || match.status !== 'running') return;
    const nowMs = Date.now();
    const batch = writeBatch(db);
    batch.update(matchRef, {
      status: 'paused',
      accumulatedMs: match.accumulatedMs + (nowMs - match.runningSinceMs),
      runningSinceMs: null,
      periodEnded: !!endsPeriod,
    });
    for (const id of match.courtSlots) {
      const p = players[id];
      if (p?.onCourtSinceMs) {
        batch.update(playerRef(id), {
          accumulatedMs: p.accumulatedMs + (nowMs - p.onCourtSinceMs),
          onCourtSinceMs: null,
        });
      }
    }
    await batch.commit();
  }, [match, players, matchRef, playerRef]);

  const togglePause = useCallback(async () => {
    if (!match) return;
    if (match.status === 'running') {
      await pauseClock(false);
      return;
    }
    const nowMs = Date.now();
    const batch = writeBatch(db);
    batch.update(matchRef, { status: 'running', runningSinceMs: nowMs, periodEnded: false });
    for (const id of match.courtSlots) {
      if (!players[id]?.excluded) batch.update(playerRef(id), { onCourtSinceMs: nowMs });
    }
    await batch.commit();
  }, [match, players, matchRef, playerRef, pauseClock]);

  // Terminar el periodo (el botón Stop): con el reloj en marcha lo detiene y lo
  // marca como terminado; si ya estaba parado por una pausa normal, el reloj ya
  // está detenido y solo hace falta marcarlo como terminado.
  const endPeriod = useCallback(async () => {
    if (!match) return;
    if (match.status === 'running') {
      await pauseClock(true);
      return;
    }
    if (match.status === 'paused' && !match.periodEnded) {
      const batch = writeBatch(db);
      batch.update(matchRef, { periodEnded: true });
      await batch.commit();
    }
  }, [match, matchRef, pauseClock]);

  // periodStartAccumulatedMs guarda cuánto llevaba el partido en total al
  // empezar este periodo, para poder mostrar la cuenta atrás del periodo en
  // curso (no del partido completo) restando ese punto de partida. Vale
  // igual para la 2ª parte que para el 2º, 3er o 4º cuarto. Solo se puede
  // empezar tras terminar el anterior con "FIN" (periodEnded) y si aún
  // queda un periodo por jugar.
  const startNextPeriod = useCallback(async () => {
    if (!match || match.status !== 'paused' || !match.periodEnded) return;
    if (match.period >= (match.periodCount === 4 ? 4 : 2)) return;
    // Con las reglas de Alevín hay que haber elegido el equipo titular del
    // periodo (setPeriodLineup) antes de poder iniciarlo. Repetir jugadores o
    // hacer cambios nunca se bloquea: solo esto.
    if (match.alevinRules && !lineupsOf(match)[match.period + 1]) return;
    const nowMs = Date.now();
    const batch = writeBatch(db);
    batch.update(matchRef, {
      status: 'running',
      period: match.period + 1,
      runningSinceMs: nowMs,
      periodStartAccumulatedMs: match.accumulatedMs,
      periodEnded: false,
      // Quién EMPIEZA este periodo: lo que haya en pista ahora mismo. Nunca
      // bloquea iniciarlo; es lo que luego consulta la vista de titulares.
      [`lineups.${match.period + 1}`]: courtLineup(match, players),
    });
    for (const id of match.courtSlots) {
      if (!players[id]?.excluded) batch.update(playerRef(id), { onCourtSinceMs: nowMs });
    }
    await batch.commit();
  }, [match, players, matchRef, playerRef]);

  // Equipo titular del periodo que va a empezar (OPCIONAL, para cualquier
  // partido): `ids` son los 7 puestos en orden, el primero es el portero, y
  // '' un puesto sin rellenar. Solo entre periodos (tras terminar el anterior).
  // Lo único que se exige es que haya al menos un jugador y nadie repetido
  // dentro del propio equipo: con menos de 7 se aplica igual (la pantalla ya
  // pidió la segunda confirmación) y sin portero, también. Si repite a
  // jugadores del periodo anterior, la pantalla avisa pero esto lo aplica igual
  // (nunca bloquea: la app también se usa en entrenamientos). Lo aplica de una
  // vez: pista, banquillo y quién es el portero, más el registro en
  // `lineups.{periodo}`. Es un evento del log: un Deshacer lo revierte mientras
  // el reloj no cambie. Quien sale de la pista con una exclusión sin cumplir la
  // pierde (si no, se quedaría "excluido" en el banquillo para siempre: el
  // cierre automático solo mira la pista).
  const setPeriodLineup = useCallback(
    (period, ids) => {
      if (!match) return { ok: false, reason: 'state' };
      if (match.status !== 'paused' || !match.periodEnded || period !== match.period + 1) return { ok: false, reason: 'state' };
      const check = validateLineup({ ids });
      if (!check.canConfirm) return { ok: false, reason: 'invalid' };
      const chosen = ids.filter(Boolean);
      if (chosen.some((id) => !players[id] || players[id].disqualified)) return { ok: false, reason: 'players' };
      const goalkeeperId = ids[0];
      const bench = Object.keys(players).filter((id) => !chosen.includes(id) && !players[id].disqualified);
      const playerUpdates = {};
      for (const id of Object.keys(players)) {
        const update = {};
        if (!!players[id].isGK !== (id === goalkeeperId)) update.isGK = id === goalkeeperId;
        if (!chosen.includes(id) && players[id].excluded) {
          update.excluded = false;
          update.exclusionEndsAtMs = null;
        }
        if (Object.keys(update).length > 0) playerUpdates[id] = update;
      }
      recordEvent(`Equipo titular del periodo ${period}`, { courtSlots: chosen, bench, [`lineups.${period}`]: [...ids] }, playerUpdates);
      return { ok: true };
    },
    [match, players, recordEvent]
  );

  // Finaliza el partido: congela cronómetro y tiempos en pista, y lo marca
  // como 'finished' (pasa a solo consulta de estadísticas).
  const finishMatch = useCallback(async () => {
    if (!match) return;
    const nowMs = Date.now();
    const batch = writeBatch(db);
    const matchUpdate = { lifecycle: 'finished', status: 'paused' };
    if (match.status === 'running') {
      matchUpdate.accumulatedMs = match.accumulatedMs + (nowMs - match.runningSinceMs);
      matchUpdate.runningSinceMs = null;
      for (const id of match.courtSlots) {
        const p = players[id];
        if (p?.onCourtSinceMs) {
          batch.update(playerRef(id), {
            accumulatedMs: p.accumulatedMs + (nowMs - p.onCourtSinceMs),
            onCourtSinceMs: null,
          });
        }
      }
    }
    batch.update(matchRef, matchUpdate);
    await batch.commit();
  }, [match, players, matchRef, playerRef]);

  // --- Marcador y acciones rivales (delta: +1 o -1, para poder corregir toques) ---
  // El "−1" borra también el último gol rival con detalle (dorsal, zonas):
  // antes solo bajaba el marcador y ese gol seguía contando en "tiros del
  // rival", en las zonas y en la cronología.
  const rivalGoal = useCallback(
    (delta = 1) => {
      if (!match || match.status !== 'running') return;
      if (delta > 0) {
        recordEvent('Gol rival', { 'score.rival': match.score.rival + 1 }, {});
        return;
      }
      if (match.score.rival <= 0) return;
      runExclusive(async () => {
        const goalDoc = await latestDetailDoc('rivalGoals');
        // Si ese gol llevaba la falta de un jugador nuestro (7m), se le quita.
        const foulId = goalDoc?.data.foulPlayerId;
        const foulPlayer = foulId ? players[foulId] : null;
        recordEvent('Gol rival (-1)', { 'score.rival': match.score.rival - 1 },
          foulPlayer ? { [foulId]: { sevenMetersCommitted: Math.max(0, (foulPlayer.sevenMetersCommitted || 0) - 1) } } : {},
          { deletes: goalDoc ? [goalDoc] : [] });
      });
    },
    [match, players, recordEvent, runExclusive, latestDetailDoc]
  );

  // Gol rival con detalle: dorsal de quien marca, minuto (del propio reloj
  // del partido) y, si se rellenan, zona de lanzamiento y de entrada a
  // portería. Se guarda como documento propio en matches/{id}/rivalGoals,
  // no solo como un +1 al marcador.
  // `foulPlayerId` (opcional, solo en un gol rival de 7 metros): el jugador
  // NUESTRO que cometió la falta que dio el 7m. Se guarda en el propio gol y
  // se suma a su contador `sevenMetersCommitted`, todo en el mismo evento —
  // un solo Deshacer lo revierte, y un "−1" del gol rival también le quita
  // el 7m al jugador (ver rivalGoal).
  const rivalGoalWithDetail = useCallback(
    ({ number, shotZone, goalZone, foulPlayerId }) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, match.score.rival + 1);
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'rivalGoals'));
      const foulPlayer = foulPlayerId ? players[foulPlayerId] : null;
      recordEvent(`Gol rival #${number}`, { 'score.rival': next },
        foulPlayer ? { [foulPlayerId]: { sevenMetersCommitted: (foulPlayer.sevenMetersCommitted || 0) + 1 } } : {},
        {
          create: {
            ref,
            data: {
              number,
              minute,
              period: match.period,
              shotZone: shotZone || null,
              goalZone: goalZone || null,
              foulPlayerId: foulPlayer ? foulPlayerId : null,
              createdAt: Date.now(),
            },
          },
        });
    },
    [match, players, matchId, liveElapsedMs, recordEvent]
  );

  const rivalShot = useCallback(
    (delta = 1) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, match.rivalShots + delta);
      recordEvent(delta > 0 ? 'Tiro rival' : 'Tiro rival (-1)', { rivalShots: next }, {});
    },
    [match, recordEvent]
  );

  // Tiro del rival que NO fue gol — un único registro para las dos formas de
  // anotarlo, que comparten interfaz (RivalShotModal):
  //  - FALLO rival (se fue fuera, o lo paró nuestro portero): `saverId` es
  //    el portero en pista si la zona de portería fue de las 9 de dentro, o
  //    null si fue "Fuera" / no se marcó zona.
  //  - PARADA de nuestro portero: `saverId` es ese portero.
  // Sin `saverId` solo se crea el Fallo rival (matches/{id}/rivalMisses) y no
  // se anota nada a nuestro equipo. Con `saverId` se crean a la vez y enlazadas
  // (pairId = id de la parada) la Parada (saveEvents) y su Fallo rival, y se
  // suma la parada al portero: una parada nuestra ES un tiro fallado del
  // rival, y por eso zoneStats.rivalShotZoneStats() no suma saveEvents aparte.
  // El dorsal (`number`) es opcional: si no da tiempo a verlo no bloquea.
  const registerRivalShot = useCallback(
    ({ number, shotZone, goalZone, saverId }) => {
      if (!match || match.status !== 'running') return;
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const period = match.period;
      const createdAt = Date.now();
      const rivalNumber = number ? Number(number) : null;
      const zones = { shotZone: shotZone || null, goalZone: goalZone || null };
      const missRef = doc(collection(db, 'matches', matchId, 'rivalMisses'));

      if (!saverId) {
        recordEvent(`Fallo rival${rivalNumber ? ` #${rivalNumber}` : ''}`, {}, {}, {
          create: { ref: missRef, data: { number: rivalNumber, minute, period, ...zones, createdAt } },
        });
        return;
      }

      const saver = players[saverId];
      if (!saver) return;
      const saveRef = doc(collection(db, 'matches', matchId, 'saveEvents'));
      recordEvent('Parada', {}, { [saverId]: { saves: (saver.saves || 0) + 1 } }, {
        creates: [
          { ref: saveRef, data: { playerId: saverId, minute, period, ...zones, rivalNumber, pairId: saveRef.id, createdAt } },
          { ref: missRef, data: { number: rivalNumber, minute, period, ...zones, pairId: saveRef.id, createdAt } },
        ],
      });
    },
    [match, players, matchId, liveElapsedMs, recordEvent]
  );

  // "−1" del Fallo rival: borra el último fallo rival. Si era un tiro parado
  // (tiene su Parada emparejada) borra también esa parada y se la resta al
  // portero que la tenía anotada — un solo toque deja las dos estadísticas
  // como si ese tiro nunca se hubiera anotado.
  const rivalMissDec = useCallback(() => {
    if (!match || match.status !== 'running') return;
    runExclusive(async () => {
      const missDoc = await latestDetailDoc('rivalMisses');
      if (!missDoc) return;
      const deletes = [missDoc];
      const playerUpdates = {};
      const saveDoc = await findPairedDoc('saveEvents', missDoc);
      if (saveDoc) {
        deletes.push(saveDoc);
        const gk = players[saveDoc.data.playerId];
        if (gk && (gk.saves || 0) > 0) playerUpdates[saveDoc.data.playerId] = { saves: gk.saves - 1 };
      }
      recordEvent('Fallo rival (-1)', {}, playerUpdates, { deletes });
    });
  }, [match, players, recordEvent, runExclusive, latestDetailDoc, findPairedDoc]);

  // Exclusión rival: solo el dorsal, sin zonas — a diferencia del gol rival,
  // no cambia el marcador. Se guarda en matches/{id}/rivalExclusions con su
  // propia cuenta atrás (endsAtMs) para poder mostrarla en directo, igual
  // que la del propio equipo — antes no se guardaba y no había forma de
  // saber si una exclusión rival seguía activa en cada momento.
  const rivalExclusion = useCallback(
    (number) => {
      if (!match || match.status !== 'running') return;
      const nowMs = Date.now();
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'rivalExclusions'));
      recordEvent(`Exclusión rival #${number}`, {}, {}, {
        create: {
          ref,
          data: { number, minute, period: match.period, createdAt: nowMs, endsAtMs: nowMs + EXCLUSION_MS },
        },
      });
    },
    [match, matchId, liveElapsedMs, recordEvent]
  );

  // Anula una exclusión rival marcada por error: se borra del todo (no solo
  // se "cancela") para que ni cuente para el 1/3, 2/3... ni salga en la
  // cronología, como si nunca hubiera pasado.
  const cancelRivalExclusion = useCallback(
    (rivalExclusionId) => {
      if (!matchId) return;
      return deleteDoc(doc(db, 'matches', matchId, 'rivalExclusions', rivalExclusionId));
    },
    [matchId]
  );

  // 7 metros provocado por el rival: solo dorsal y minuto, igual que una
  // exclusión rival — no cambia el marcador (el gol/fallo de 7m resultante
  // se anota aparte, como un gol/fallo propio normal con zona "7 metros").
  // `shotEventId` (opcional) es el gol propio de 7m que originó este 7m
  // rival: si más tarde se resta ese gol, se borra también este registro.
  const rivalSevenMeter = useCallback(
    (number, shotEventId = null) => {
      if (!match || match.status !== 'running') return;
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'rivalSevenMeters'));
      recordEvent(`7 metros cometido por rival #${number}`, {}, {}, {
        create: { ref, data: { number, minute, period: match.period, shotEventId, createdAt: Date.now() } },
      });
    },
    [match, matchId, liveElapsedMs, recordEvent]
  );

  // Anula un 7m rival marcado por error — borrado duro, igual que anular
  // una exclusión rival.
  const cancelRivalSevenMeter = useCallback(
    (rivalSevenMeterId) => {
      if (!matchId) return;
      return deleteDoc(doc(db, 'matches', matchId, 'rivalSevenMeters', rivalSevenMeterId));
    },
    [matchId]
  );

  // Tarjeta amarilla rival: solo dorsal y minuto, igual que un 7m rival —
  // no es una sanción temporal, no cambia el marcador. Como mucho una por
  // dorsal en el partido: la comprobación de si ese dorsal ya la tiene se
  // hace en quien llama (BenchConsole.jsx), con la lista ya cargada.
  const rivalYellowCard = useCallback(
    (number) => {
      if (!match || match.status !== 'running') return;
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'rivalYellowCards'));
      recordEvent(`Tarjeta amarilla rival #${number}`, {}, {}, {
        create: { ref, data: { number, minute, period: match.period, createdAt: Date.now() } },
      });
    },
    [match, matchId, liveElapsedMs, recordEvent]
  );

  // Anula una tarjeta amarilla rival marcada por error — borrado duro,
  // igual que anular un 7m rival.
  const cancelRivalYellowCard = useCallback(
    (rivalYellowCardId) => {
      if (!matchId) return;
      return deleteDoc(doc(db, 'matches', matchId, 'rivalYellowCards', rivalYellowCardId));
    },
    [matchId]
  );

  // --- Tiempos muertos ---
  const timeout = useCallback(
    (team, delta = 1) => {
      const period = match.period;
      const count = Math.max(0, (match.timeouts[team][period] || 0) + delta);
      recordEvent(team === 'own' ? 'Tiempo muerto propio' : 'Tiempo muerto rival', {
        [`timeouts.${team}.${period}`]: count,
      }, {});
    },
    [match, recordEvent]
  );

  // --- Acciones por jugador (delta: +1 o -1, para poder corregir toques) ---
  // Regla común de todos los "−1" de aquí abajo: restar es DESHACER esa
  // anotación entera, no solo bajar un número. Se borra el último documento
  // de detalle de ese tipo del jugador (y sus enlazados) en el mismo batch
  // que baja el contador y el marcador, para que zonas, cronología y "tiros
  // del rival" no sigan contando algo que ya no existe. Con el contador a 0
  // no hace nada (antes un "−1" en un jugador sin goles bajaba igualmente
  // el marcador del equipo).
  const playerGoal = useCallback(
    (playerId, delta = 1) => {
      if (!match || match.status !== 'running') return;
      if (delta > 0) {
        recordEvent('Gol', { 'score.own': match.score.own + 1 }, { [playerId]: { goals: players[playerId].goals + 1 } });
        return;
      }
      if ((players[playerId]?.goals || 0) <= 0) return;
      runExclusive(async () => {
        const goalDoc = await latestDetailDoc('shotEvents', [['playerId', playerId], ['type', 'goal']]);
        const deletes = goalDoc ? [goalDoc] : [];
        // Si ese gol fue de 7m y llevó un "7m cometido por rival #N"
        // enlazado, se quita también.
        if (goalDoc?.data.shotZone === '7 metros') {
          const sevenMeter = await latestDetailDoc('rivalSevenMeters', [['shotEventId', goalDoc.id]]);
          if (sevenMeter) deletes.push(sevenMeter);
        }
        recordEvent('Gol (-1)', { 'score.own': Math.max(0, match.score.own - 1) }, {
          [playerId]: { goals: players[playerId].goals - 1 },
        }, { deletes });
      });
    },
    [match, players, recordEvent, runExclusive, latestDetailDoc]
  );

  const playerShot = useCallback(
    (playerId, delta = 1) => {
      if (!match || match.status !== 'running') return;
      if (delta > 0) {
        recordEvent('Lanzamiento', {}, { [playerId]: { shots: players[playerId].shots + 1 } });
        return;
      }
      if ((players[playerId]?.shots || 0) <= 0) return;
      runExclusive(async () => {
        const missDoc = await latestDetailDoc('shotEvents', [['playerId', playerId], ['type', 'miss']]);
        recordEvent('Lanzamiento (-1)', {}, { [playerId]: { shots: players[playerId].shots - 1 } }, {
          deletes: missDoc ? [missDoc] : [],
        });
      });
    },
    [match, players, recordEvent, runExclusive, latestDetailDoc]
  );

  // Gol/Fallo con zona (lanzamiento y, si es gol, entrada a portería), igual
  // que el gol rival: se guarda como documento propio en matches/{id}/shotEvents.
  const playerGoalWithDetail = useCallback(
    (playerId, { shotZone, goalZone }) => {
      if (!match || match.status !== 'running') return null;
      const nextGoals = Math.max(0, players[playerId].goals + 1);
      const nextScore = Math.max(0, match.score.own + 1);
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'shotEvents'));
      recordEvent('Gol', { 'score.own': nextScore }, { [playerId]: { goals: nextGoals } }, {
        create: {
          ref,
          data: { playerId, type: 'goal', minute, period: match.period, shotZone: shotZone || null, goalZone: goalZone || null, createdAt: Date.now() },
        },
      });
      // Se devuelve el id del gol para poder enlazarle el 7m rival, si lo hay.
      return ref.id;
    },
    [match, players, matchId, liveElapsedMs, recordEvent]
  );

  const playerShotWithDetail = useCallback(
    (playerId, { shotZone, goalZone }) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, players[playerId].shots + 1);
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'shotEvents'));
      recordEvent('Fallo', {}, { [playerId]: { shots: next } }, {
        create: {
          ref,
          data: { playerId, type: 'miss', minute, period: match.period, shotZone: shotZone || null, goalZone: goalZone || null, createdAt: Date.now() },
        },
      });
    },
    [match, players, matchId, liveElapsedMs, recordEvent]
  );

  // El "+1" real queda registrado con su minuto en matches/{id}/recoveryEvents
  // (para la cronología de la vista de Seguidor); el "−1" borra la última
  // recuperación de ese jugador, para que la cronología no la siga mostrando.
  const playerRecovery = useCallback(
    (playerId, delta = 1) => {
      if (!match || match.status !== 'running') return;
      if (delta > 0) {
        const minute = Math.floor(liveElapsedMs / 60000) + 1;
        const ref = doc(collection(db, 'matches', matchId, 'recoveryEvents'));
        recordEvent('Recuperación', {}, { [playerId]: { recoveries: players[playerId].recoveries + 1 } }, {
          create: { ref, data: { playerId, minute, period: match.period, createdAt: Date.now() } },
        });
        return;
      }
      if ((players[playerId]?.recoveries || 0) <= 0) return;
      runExclusive(async () => {
        const recoveryDoc = await latestDetailDoc('recoveryEvents', [['playerId', playerId]]);
        recordEvent('Recuperación (-1)', {}, { [playerId]: { recoveries: players[playerId].recoveries - 1 } }, {
          deletes: recoveryDoc ? [recoveryDoc] : [],
        });
      });
    },
    [match, players, matchId, liveElapsedMs, recordEvent, runExclusive, latestDetailDoc]
  );

  // Solo tiene sentido para quien juega de portero en este partido. El "−1"
  // borra la última parada del portero Y su Fallo rival emparejado (una
  // parada es a la vez un tiro fallado del rival): antes se quedaba el
  // fallo rival huérfano, inflando "tiros del rival" y sus zonas.
  const playerSave = useCallback(
    (playerId, delta = 1) => {
      if (!match || match.status !== 'running') return;
      if (delta > 0) {
        recordEvent('Parada', {}, { [playerId]: { saves: players[playerId].saves + 1 } });
        return;
      }
      if ((players[playerId]?.saves || 0) <= 0) return;
      runExclusive(async () => {
        const saveDoc = await latestDetailDoc('saveEvents', [['playerId', playerId]]);
        const deletes = [];
        if (saveDoc) {
          deletes.push(saveDoc);
          const missDoc = await findPairedDoc('rivalMisses', saveDoc);
          if (missDoc) deletes.push(missDoc);
        }
        recordEvent('Parada (-1)', {}, { [playerId]: { saves: players[playerId].saves - 1 } }, { deletes });
      });
    },
    [match, players, recordEvent, runExclusive, latestDetailDoc, findPairedDoc]
  );

  // A la 3ª exclusión, el jugador queda expulsado del partido (tarjeta roja).
  // No se toca courtSlots aquí: el jugador se queda en su sitio (sin poder
  // seguir jugando) hasta que el banquillo elige quién entra por él, con
  // substituteDisqualified — así nunca se saca a nadie sin preguntar.
  // Devuelve si esta exclusión ha supuesto expulsión, para que quien llama
  // pueda abrir el cambio en el momento.
  const playerExclusion = useCallback(
    (playerId) => {
      if (!match || match.status !== 'running') return false;
      const nowMs = Date.now();
      const p = players[playerId];
      const nextCount = p.exclusionsCount + 1;
      const accumulatedMs = p.onCourtSinceMs ? p.accumulatedMs + (nowMs - p.onCourtSinceMs) : p.accumulatedMs;
      const willDisqualify = nextCount >= 3;
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'exclusionEvents'));
      const extra = {
        create: { ref, data: { playerId, minute, period: match.period, disqualified: willDisqualify, createdAt: Date.now() } },
      };
      if (willDisqualify) {
        recordEvent('Expulsión (3ª exclusión)', {}, {
          [playerId]: {
            exclusionsCount: nextCount,
            excluded: false,
            exclusionEndsAtMs: null,
            disqualified: true,
            accumulatedMs,
            onCourtSinceMs: null,
          },
        }, extra);
      } else {
        recordEvent('Exclusión 2min', {}, {
          [playerId]: {
            exclusionsCount: nextCount,
            excluded: true,
            exclusionEndsAtMs: nowMs + EXCLUSION_MS,
            accumulatedMs,
            onCourtSinceMs: null,
          },
        }, extra);
      }
      return willDisqualify;
    },
    [match, players, matchId, liveElapsedMs, recordEvent]
  );

  // Cancela una exclusión en curso (toque accidental): el jugador vuelve a
  // pista de inmediato y se descuenta del contador de exclusiones.
  // También borra la exclusión de la cronología (su último exclusionEvents):
  // antes el contador bajaba pero la exclusión seguía saliendo en la
  // cronología del Seguidor.
  const cancelExclusion = useCallback(
    (playerId) => {
      const p = players[playerId];
      if (!p.excluded) return;
      runExclusive(async () => {
        const exclusionDoc = await latestDetailDoc('exclusionEvents', [['playerId', playerId]]);
        recordEvent('Cancelar exclusión', {}, {
          [playerId]: {
            exclusionsCount: Math.max(0, p.exclusionsCount - 1),
            excluded: false,
            exclusionEndsAtMs: null,
            onCourtSinceMs: match.status === 'running' ? Date.now() : null,
          },
        }, { deletes: exclusionDoc ? [exclusionDoc] : [] });
      });
    },
    [match, players, recordEvent, runExclusive, latestDetailDoc]
  );

  // Tarjeta amarilla propia: una amonestación, no una sanción temporal —
  // no cambia el marcador ni saca a nadie de pista. Como mucho una por
  // jugador y partido (el propio botón deja de estar disponible en cuanto
  // `yellowCard` es true, y aquí se comprueba otra vez por si acaso).
  const playerYellowCard = useCallback(
    (playerId) => {
      if (!match || match.status !== 'running') return;
      if (players[playerId]?.yellowCard) return;
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'yellowCardEvents'));
      recordEvent('Tarjeta amarilla', {}, { [playerId]: { yellowCard: true } }, {
        create: { ref, data: { playerId, minute, period: match.period, createdAt: Date.now() } },
      });
    },
    [match, players, matchId, liveElapsedMs, recordEvent]
  );

  // Anula una tarjeta amarilla marcada por error — mismo criterio que
  // cancelExclusion: baja el campo del jugador y borra su documento de
  // detalle, para que no siga saliendo en la cronología.
  const cancelYellowCard = useCallback(
    (playerId) => {
      if (!players[playerId]?.yellowCard) return;
      runExclusive(async () => {
        const yellowDoc = await latestDetailDoc('yellowCardEvents', [['playerId', playerId]]);
        recordEvent('Cancelar tarjeta amarilla', {}, { [playerId]: { yellowCard: false } }, {
          deletes: yellowDoc ? [yellowDoc] : [],
        });
      });
    },
    [players, recordEvent, runExclusive, latestDetailDoc]
  );

  // --- Sustitución ---
  // Si el que sale es el portero de este partido, el que entra hereda ese
  // rol — el portero es un papel del partido, no de la ficha del jugador.
  const substitute = useCallback(
    (outPlayerId, inPlayerId) => {
      if (!canSubstituteNow(match)) return;
      const nowMs = Date.now();
      const outP = players[outPlayerId];
      const courtSlots = match.courtSlots.map((id) => (id === outPlayerId ? inPlayerId : id));
      const bench = match.bench.filter((id) => id !== inPlayerId).concat(outPlayerId);
      const playerUpdates = {
        [outPlayerId]: {
          accumulatedMs: outP.onCourtSinceMs ? outP.accumulatedMs + (nowMs - outP.onCourtSinceMs) : outP.accumulatedMs,
          onCourtSinceMs: null,
          isGK: false,
        },
      };
      playerUpdates[inPlayerId] = { isGK: !!outP.isGK };
      if (match.status === 'running') {
        playerUpdates[inPlayerId].onCourtSinceMs = nowMs;
      }
      recordEvent('Cambio', { courtSlots, bench }, playerUpdates);
    },
    [match, players, recordEvent]
  );

  // Varios cambios a la vez (vista reducida), como UN solo evento — un único
  // "Deshacer" los revierte todos. `pairs` es [{ outId, inId }]. Reglas: quien
  // sale debe estar en la lista de pista y quien entra en el banquillo, sin
  // repetir a nadie; si algo no cuadra no se hace nada. Quien sale por
  // expulsión (roja) no vuelve al banquillo, igual que en el cambio suelto.
  // El evento guarda `substitutionCount` para que las estadísticas cuenten N
  // cambios, no uno.
  const substituteMany = useCallback(
    (pairs) => {
      if (!canSubstituteNow(match) || !pairs || pairs.length === 0) return;
      const nowMs = Date.now();
      const running = match.status === 'running';
      let courtSlots = [...match.courtSlots];
      let bench = [...match.bench];
      const playerUpdates = {};
      const usedIn = new Set();
      const usedOut = new Set();
      for (const { outId, inId } of pairs) {
        const outP = players[outId];
        const inP = players[inId];
        if (!outP || !inP || usedIn.has(inId) || usedOut.has(outId)) return;
        if (!courtSlots.includes(outId) || !bench.includes(inId) || inP.disqualified) return;
        usedIn.add(inId);
        usedOut.add(outId);
        const disqualified = !!outP.disqualified;
        courtSlots = courtSlots.map((id) => (id === outId ? inId : id));
        bench = bench.filter((id) => id !== inId);
        if (!disqualified) {
          bench.push(outId);
          playerUpdates[outId] = {
            accumulatedMs: outP.onCourtSinceMs ? outP.accumulatedMs + (nowMs - outP.onCourtSinceMs) : outP.accumulatedMs,
            onCourtSinceMs: null,
            isGK: false,
          };
        }
        playerUpdates[inId] = { isGK: !!outP.isGK, ...(running ? { onCourtSinceMs: nowMs } : {}) };
      }
      recordEvent('Cambio', { courtSlots, bench }, playerUpdates, { eventFields: { substitutionCount: pairs.length } });
    },
    [match, players, recordEvent]
  );

  // Cambio por expulsión: el expulsado no vuelve al banquillo (no puede
  // volver a jugar en lo que queda de partido), a diferencia de un cambio
  // normal — solo se actualiza el reloj de quien entra. También transfiere
  // el rol de portero si el expulsado lo tenía.
  const substituteDisqualified = useCallback(
    (outPlayerId, inPlayerId) => {
      if (!canSubstituteNow(match)) return;
      const nowMs = Date.now();
      const outP = players[outPlayerId];
      const courtSlots = match.courtSlots.map((id) => (id === outPlayerId ? inPlayerId : id));
      const bench = match.bench.filter((id) => id !== inPlayerId);
      const playerUpdates = { [inPlayerId]: { isGK: !!outP.isGK } };
      if (match.status === 'running') {
        playerUpdates[inPlayerId].onCourtSinceMs = nowMs;
      }
      recordEvent('Cambio por expulsión', { courtSlots, bench }, playerUpdates);
    },
    [match, players, recordEvent]
  );

  // --- Deshacer ---
  // Deshace el ÚLTIMO evento: devuelve cada campo que cambió a su valor
  // anterior, borra los documentos de detalle que creó y recrea los que
  // borró. Si el evento tocaba relojes de jugador (cambio, exclusión...) y
  // el reloj del partido ha cambiado desde entonces (pausa, reanudar, otro
  // periodo), no se deshace: los minutos individuales saldrían mal, y es
  // mejor avisar que corromperlos — devuelve { ok: false, reason: 'clock' }.
  // Los eventos guardados antes de este formato traen una foto entera
  // (`snapshot`) y se siguen deshaciendo como antes.
  const undo = useCallback(async () => {
    const snap = await getDocs(query(eventsCol, orderBy('createdAt', 'desc'), limit(1)));
    if (snap.empty) return { ok: true };
    const eventDoc = snap.docs[0];
    const eventData = eventDoc.data();
    const batch = writeBatch(db);

    if (eventData.undo) {
      const clock = eventData.undo.clock;
      if (clock && match && (
        match.status !== clock.status
        || (match.runningSinceMs ?? null) !== clock.runningSinceMs
        || match.period !== clock.period
      )) {
        return { ok: false, reason: 'clock' };
      }
      const matchPatch = {};
      for (const { path, value } of eventData.undo.match) matchPatch[path] = value;
      if (Object.keys(matchPatch).length > 0) batch.update(matchRef, matchPatch);
      for (const { id, fields } of eventData.undo.players) {
        const patch = {};
        for (const { path, value } of fields) patch[path] = value;
        batch.update(playerRef(id), patch);
      }
    } else if (eventData.snapshot) {
      const { match: matchSnap, players: playersSnap } = eventData.snapshot;
      batch.update(matchRef, matchSnap);
      for (const id of Object.keys(playersSnap)) {
        batch.update(playerRef(id), playersSnap[id]);
      }
    }

    // createdRefPaths (array) es el formato actual; createdRefPath
    // (singular) es el de eventos ya guardados antes de que un evento
    // pudiera crear más de un documento — se sigue soportando por si el
    // más reciente todavía es uno de esos.
    const paths = eventData.createdRefPaths || (eventData.createdRefPath ? [eventData.createdRefPath] : []);
    for (const p of paths) batch.delete(doc(db, p));
    for (const d of eventData.deletedDocs || []) batch.set(doc(db, d.path), d.data);
    batch.delete(eventDoc.ref);
    await batch.commit();
    return { ok: true };
  }, [eventsCol, matchRef, playerRef, match]);

  const periodDurationMs = match?.periodDurationMs || 20 * 60 * 1000;
  const periodElapsedMs = liveElapsedMs - (match?.periodStartAccumulatedMs || 0);
  const periodRemainingMs = periodDurationMs - periodElapsedMs;

  const state = useMemo(
    () => ({
      lifecycle: match?.lifecycle || 'scheduled',
      canSubstitute: canSubstituteNow(match),
      // Equipo titular de cada periodo y avisos de Alevín (ver utils/lineups.js).
      alevinRules: !!match?.alevinRules,
      lineups: lineupsOf(match),
      convocados: Object.keys(players).length,
      rivalName: match?.rivalName || 'Rival',
      rivalCrestUrl: match?.rivalCrestUrl || '',
      ownTeamName: match?.ownTeamName || 'Mi equipo',
      jornada: match?.jornada ?? null,
      isHome: match?.isHome ?? true,
      venue: match?.venue || '',
      scheduledAt: match?.scheduledAt || null,
      clock: {
        status: match?.status || 'idle',
        period: match?.period || 1,
        periodCount: match?.periodCount === 4 ? 4 : 2,
        periodEnded: !!match?.periodEnded,
        elapsedMs: liveElapsedMs,
        periodDurationMs,
        periodRemainingMs,
      },
      score: match?.score || { own: 0, rival: 0 },
      rivalShots: match?.rivalShots || 0,
      timeouts: match?.timeouts || { own: {}, rival: {} },
      courtSlots: match?.courtSlots || [],
      bench: match?.bench || [],
      startingLineupIds: match?.startingLineupIds || [],
      players: livePlayers,
    }),
    [match, liveElapsedMs, livePlayers]
  );

  return {
    ready: !!match,
    matchId,
    state,
    canUndo,
    lastEvent,
    startPeriod1,
    togglePause,
    endPeriod,
    startNextPeriod,
    setPeriodLineup,
    finishMatch,
    rivalGoal,
    rivalGoalWithDetail,
    rivalShot,
    registerRivalShot,
    rivalMissDec,
    rivalExclusion,
    cancelRivalExclusion,
    rivalSevenMeter,
    cancelRivalSevenMeter,
    rivalYellowCard,
    cancelRivalYellowCard,
    timeout,
    playerGoal,
    playerGoalWithDetail,
    playerShot,
    playerShotWithDetail,
    playerRecovery,
    playerSave,
    playerExclusion,
    cancelExclusion,
    playerYellowCard,
    cancelYellowCard,
    substitute,
    substituteMany,
    substituteDisqualified,
    undo,
  };
}
