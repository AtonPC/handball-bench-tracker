import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const EXCLUSION_MS = 2 * 60 * 1000;

function buildSnapshot(match, players) {
  const playersSnap = {};
  for (const id of Object.keys(players)) {
    const p = players[id];
    playersSnap[id] = {
      accumulatedMs: p.accumulatedMs,
      onCourtSinceMs: p.onCourtSinceMs,
      excluded: p.excluded,
      exclusionEndsAtMs: p.exclusionEndsAtMs,
      goals: p.goals,
      shots: p.shots,
      saves: p.saves,
      recoveries: p.recoveries,
      exclusionsCount: p.exclusionsCount,
      disqualified: p.disqualified,
      yellowCard: p.yellowCard,
      isGK: p.isGK,
    };
  }
  return {
    match: {
      status: match.status,
      period: match.period,
      accumulatedMs: match.accumulatedMs,
      runningSinceMs: match.runningSinceMs,
      score: match.score,
      rivalShots: match.rivalShots,
      timeouts: match.timeouts,
      courtSlots: match.courtSlots,
      bench: match.bench,
    },
    players: playersSnap,
  };
}

// Store de un partido concreto (matchId): cronómetro, marcador, jugadores en
// vivo, sustituciones y el log de eventos para deshacer. El partido y su
// convocatoria ya deben existir (creados desde Gestión de Partidos).
export function useMatchStore(matchId, enabled) {
  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState({});
  const [now, setNow] = useState(Date.now());
  const [canUndo, setCanUndo] = useState(false);
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

  // `extra.create` permite que un evento, además de los cambios habituales,
  // cree un documento aparte (p. ej. el detalle de un gol rival) — se guarda
  // su ruta en el propio evento para que el deshacer también lo borre.
  const recordEvent = useCallback(async (label, matchUpdate, playerUpdates, extra) => {
    if (!match) return;
    const snapshot = buildSnapshot(match, players);
    const batch = writeBatch(db);
    if (matchUpdate && Object.keys(matchUpdate).length > 0) batch.update(matchRef, matchUpdate);
    for (const id of Object.keys(playerUpdates || {})) {
      batch.update(playerRef(id), playerUpdates[id]);
    }
    // extra.creates (array) es lo normal ahora — un evento puede crear más
    // de un documento de detalle a la vez (p. ej. una Parada crea también
    // su Fallo rival emparejado, ver playerSaveWithDetail). extra.create
    // (singular) se sigue aceptando por compatibilidad con quien ya lo usa.
    const creates = extra?.creates || (extra?.create ? [extra.create] : []);
    for (const c of creates) batch.set(c.ref, c.data);
    const createdRefPaths = creates.map((c) => c.ref.path);
    batch.set(doc(eventsCol), { label, createdAt: Date.now(), period: match.period, snapshot, createdRefPaths });
    await batch.commit();
  }, [match, players, matchRef, playerRef, eventsCol]);

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

  const endPeriod = useCallback(() => pauseClock(true), [pauseClock]);

  // periodStartAccumulatedMs guarda cuánto llevaba el partido en total al
  // empezar este periodo, para poder mostrar la cuenta atrás del periodo en
  // curso (no del partido completo) restando ese punto de partida. Vale
  // igual para la 2ª parte que para el 2º, 3er o 4º cuarto. Solo se puede
  // empezar tras terminar el anterior con "FIN" (periodEnded) y si aún
  // queda un periodo por jugar.
  const startNextPeriod = useCallback(async () => {
    if (!match || match.status !== 'paused' || !match.periodEnded) return;
    if (match.period >= (match.periodCount === 4 ? 4 : 2)) return;
    const nowMs = Date.now();
    const batch = writeBatch(db);
    batch.update(matchRef, {
      status: 'running',
      period: match.period + 1,
      runningSinceMs: nowMs,
      periodStartAccumulatedMs: match.accumulatedMs,
      periodEnded: false,
    });
    for (const id of match.courtSlots) {
      if (!players[id]?.excluded) batch.update(playerRef(id), { onCourtSinceMs: nowMs });
    }
    await batch.commit();
  }, [match, players, matchRef, playerRef]);

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
  const rivalGoal = useCallback(
    (delta = 1) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, match.score.rival + delta);
      recordEvent(delta > 0 ? 'Gol rival' : 'Gol rival (-1)', { 'score.rival': next }, {});
    },
    [match, recordEvent]
  );

  // Gol rival con detalle: dorsal de quien marca, minuto (del propio reloj
  // del partido) y, si se rellenan, zona de lanzamiento y de entrada a
  // portería. Se guarda como documento propio en matches/{id}/rivalGoals,
  // no solo como un +1 al marcador.
  const rivalGoalWithDetail = useCallback(
    ({ number, shotZone, goalZone }) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, match.score.rival + 1);
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'rivalGoals'));
      recordEvent(`Gol rival #${number}`, { 'score.rival': next }, {}, {
        create: {
          ref,
          data: {
            number,
            minute,
            period: match.period,
            shotZone: shotZone || null,
            goalZone: goalZone || null,
            createdAt: Date.now(),
          },
        },
      });
    },
    [match, matchId, liveElapsedMs, recordEvent]
  );

  const rivalShot = useCallback(
    (delta = 1) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, match.rivalShots + delta);
      recordEvent(delta > 0 ? 'Tiro rival' : 'Tiro rival (-1)', { rivalShots: next }, {});
    },
    [match, recordEvent]
  );

  // Fallo rival: tiró y se fue fuera, sin que el portero parara nada — no
  // cambia el marcador. Se guarda en matches/{id}/rivalMisses, con dorsal y
  // zonas (opcional), igual que un gol rival. Sin esto, "Tiros del rival"
  // solo podía contar sus goles + nuestras paradas, quedándose corto (un
  // tiro que se va fuera no pasa por ninguno de los dos).
  const rivalMiss = useCallback(
    ({ number, shotZone, goalZone }) => {
      if (!match || match.status !== 'running') return;
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'rivalMisses'));
      recordEvent(`Fallo rival #${number}`, {}, {}, {
        create: {
          ref,
          data: { number, minute, period: match.period, shotZone: shotZone || null, goalZone: goalZone || null, createdAt: Date.now() },
        },
      });
    },
    [match, matchId, liveElapsedMs, recordEvent]
  );

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
  const rivalSevenMeter = useCallback(
    (number) => {
      if (!match || match.status !== 'running') return;
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'rivalSevenMeters'));
      recordEvent(`7 metros cometido por rival #${number}`, {}, {}, {
        create: { ref, data: { number, minute, period: match.period, createdAt: Date.now() } },
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
  const playerGoal = useCallback(
    (playerId, delta = 1) => {
      if (!match || match.status !== 'running') return;
      const nextGoals = Math.max(0, players[playerId].goals + delta);
      const nextScore = Math.max(0, match.score.own + delta);
      recordEvent(delta > 0 ? 'Gol' : 'Gol (-1)', { 'score.own': nextScore }, {
        [playerId]: { goals: nextGoals },
      });
    },
    [match, players, recordEvent]
  );

  const playerShot = useCallback(
    (playerId, delta = 1) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, players[playerId].shots + delta);
      recordEvent(delta > 0 ? 'Lanzamiento' : 'Lanzamiento (-1)', {}, { [playerId]: { shots: next } });
    },
    [match, players, recordEvent]
  );

  // Gol/Fallo con zona (lanzamiento y, si es gol, entrada a portería), igual
  // que el gol rival: se guarda como documento propio en matches/{id}/shotEvents.
  const playerGoalWithDetail = useCallback(
    (playerId, { shotZone, goalZone }) => {
      if (!match || match.status !== 'running') return;
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
  // (para la cronología de la vista de Seguidor); el "-1" es una corrección
  // de un toque accidental, no un suceso nuevo, así que no crea evento.
  const playerRecovery = useCallback(
    (playerId, delta = 1) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, players[playerId].recoveries + delta);
      if (delta > 0 && match) {
        const minute = Math.floor(liveElapsedMs / 60000) + 1;
        const ref = doc(collection(db, 'matches', matchId, 'recoveryEvents'));
        recordEvent('Recuperación', {}, { [playerId]: { recoveries: next } }, {
          create: { ref, data: { playerId, minute, period: match.period, createdAt: Date.now() } },
        });
      } else {
        recordEvent('Recuperación (-1)', {}, { [playerId]: { recoveries: next } });
      }
    },
    [match, players, matchId, liveElapsedMs, recordEvent]
  );

  // Falta propia que provoca un lanzamiento de 7 metros para el rival —
  // contador simple por jugador, igual que las recuperaciones, sin zona ni
  // documento de detalle propio.
  const playerSevenMeterCommitted = useCallback(
    (playerId, delta = 1) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, (players[playerId].sevenMetersCommitted || 0) + delta);
      recordEvent(delta > 0 ? '7 metros cometido' : '7 metros cometido (-1)', {}, { [playerId]: { sevenMetersCommitted: next } });
    },
    [match, players, recordEvent]
  );

  // Solo tiene sentido para quien juega de portero en este partido.
  const playerSave = useCallback(
    (playerId, delta = 1) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, players[playerId].saves + delta);
      recordEvent(delta > 0 ? 'Parada' : 'Parada (-1)', {}, { [playerId]: { saves: next } });
    },
    [match, players, recordEvent]
  );

  // Parada con zona: se guarda como documento propio en
  // matches/{id}/saveEvents, igual que el gol/fallo propio. Una parada
  // nuestra es, a la vez y por definición, un tiro fallado del rival — así
  // que también se crea a la vez su documento gemelo en rivalMisses (2026-
  // 09-16, antes había que anotarlo aparte a mano con "FALLO RIVAL" y casi
  // nunca se hacía, dejando las estadísticas del rival cortas). rivalNumber
  // (opcional) es el dorsal de quien tiró, se usa en los dos documentos.
  // Por eso rivalShotZoneStats() en zoneStats.js ya NO suma saveEvents
  // aparte — contarlo dos veces (aquí y en rivalMisses) doblaría el total.
  const playerSaveWithDetail = useCallback(
    (playerId, { shotZone, goalZone, rivalNumber }) => {
      if (!match || match.status !== 'running') return;
      const next = Math.max(0, players[playerId].saves + 1);
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const period = match.period;
      const createdAt = Date.now();
      const saveRef = doc(collection(db, 'matches', matchId, 'saveEvents'));
      const missRef = doc(collection(db, 'matches', matchId, 'rivalMisses'));
      recordEvent('Parada', {}, { [playerId]: { saves: next } }, {
        creates: [
          {
            ref: saveRef,
            data: {
              playerId, minute, period,
              shotZone: shotZone || null, goalZone: goalZone || null,
              rivalNumber: rivalNumber || null,
              createdAt,
            },
          },
          {
            ref: missRef,
            data: {
              number: rivalNumber || null, minute, period,
              shotZone: shotZone || null, goalZone: goalZone || null,
              createdAt,
            },
          },
        ],
      });
    },
    [match, players, matchId, liveElapsedMs, recordEvent]
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
  const cancelExclusion = useCallback(
    (playerId) => {
      const nowMs = Date.now();
      const p = players[playerId];
      if (!p.excluded) return;
      recordEvent('Cancelar exclusión', {}, {
        [playerId]: {
          exclusionsCount: Math.max(0, p.exclusionsCount - 1),
          excluded: false,
          exclusionEndsAtMs: null,
          onCourtSinceMs: match.status === 'running' ? nowMs : null,
        },
      });
    },
    [match, players, recordEvent]
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
  // cancelExclusion (solo se corrige el campo del jugador, sin borrar el
  // documento de detalle; el "Deshacer" general sí lo borra si es la
  // última acción).
  const cancelYellowCard = useCallback(
    (playerId) => {
      if (!players[playerId]?.yellowCard) return;
      recordEvent('Cancelar tarjeta amarilla', {}, { [playerId]: { yellowCard: false } });
    },
    [players, recordEvent]
  );

  // --- Sustitución ---
  // Si el que sale es el portero de este partido, el que entra hereda ese
  // rol — el portero es un papel del partido, no de la ficha del jugador.
  const substitute = useCallback(
    (outPlayerId, inPlayerId) => {
      if (!match || match.status !== 'running') return;
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

  // Cambio por expulsión: el expulsado no vuelve al banquillo (no puede
  // volver a jugar en lo que queda de partido), a diferencia de un cambio
  // normal — solo se actualiza el reloj de quien entra. También transfiere
  // el rol de portero si el expulsado lo tenía.
  const substituteDisqualified = useCallback(
    (outPlayerId, inPlayerId) => {
      if (!match || match.status !== 'running') return;
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
  const undo = useCallback(async () => {
    const snap = await getDocs(query(eventsCol, orderBy('createdAt', 'desc'), limit(1)));
    if (snap.empty) return;
    const eventDoc = snap.docs[0];
    const eventData = eventDoc.data();
    const { match: matchSnap, players: playersSnap } = eventData.snapshot;
    const batch = writeBatch(db);
    batch.update(matchRef, matchSnap);
    for (const id of Object.keys(playersSnap)) {
      batch.update(playerRef(id), playersSnap[id]);
    }
    // createdRefPaths (array) es el formato actual; createdRefPath
    // (singular) es el de eventos ya guardados antes de que un evento
    // pudiera crear más de un documento — se sigue soportando por si el
    // más reciente todavía es uno de esos.
    const paths = eventData.createdRefPaths || (eventData.createdRefPath ? [eventData.createdRefPath] : []);
    for (const p of paths) batch.delete(doc(db, p));
    batch.delete(eventDoc.ref);
    await batch.commit();
  }, [eventsCol, matchRef, playerRef]);

  const periodDurationMs = match?.periodDurationMs || 20 * 60 * 1000;
  const periodElapsedMs = liveElapsedMs - (match?.periodStartAccumulatedMs || 0);
  const periodRemainingMs = periodDurationMs - periodElapsedMs;

  const state = useMemo(
    () => ({
      lifecycle: match?.lifecycle || 'scheduled',
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
    startPeriod1,
    togglePause,
    endPeriod,
    startNextPeriod,
    finishMatch,
    rivalGoal,
    rivalGoalWithDetail,
    rivalShot,
    rivalMiss,
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
    playerSevenMeterCommitted,
    playerSave,
    playerSaveWithDetail,
    playerExclusion,
    cancelExclusion,
    playerYellowCard,
    cancelYellowCard,
    substitute,
    substituteDisqualified,
    undo,
  };
}
