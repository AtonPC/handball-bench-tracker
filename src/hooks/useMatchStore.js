import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore';
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

  // Ticker local: solo fuerza el recálculo de los relojes en pantalla, no escribe en Firestore.
  useEffect(() => {
    if (!match || match.status !== 'running') return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
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
    let createdRefPath = null;
    if (extra?.create) {
      batch.set(extra.create.ref, extra.create.data);
      createdRefPath = extra.create.ref.path;
    }
    batch.set(doc(eventsCol), { label, createdAt: Date.now(), period: match.period, snapshot, createdRefPath });
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

  const togglePause = useCallback(async () => {
    if (!match) return;
    const nowMs = Date.now();
    const batch = writeBatch(db);
    if (match.status === 'running') {
      batch.update(matchRef, {
        status: 'paused',
        accumulatedMs: match.accumulatedMs + (nowMs - match.runningSinceMs),
        runningSinceMs: null,
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
    } else {
      batch.update(matchRef, { status: 'running', runningSinceMs: nowMs });
      for (const id of match.courtSlots) {
        if (!players[id]?.excluded) batch.update(playerRef(id), { onCourtSinceMs: nowMs });
      }
    }
    await batch.commit();
  }, [match, players, matchRef, playerRef]);

  const startPeriod2 = useCallback(async () => {
    if (!match) return;
    const nowMs = Date.now();
    const batch = writeBatch(db);
    batch.update(matchRef, { status: 'running', period: 2, runningSinceMs: nowMs });
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
      if (!match) return;
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
      const next = Math.max(0, match.rivalShots + delta);
      recordEvent(delta > 0 ? 'Tiro rival' : 'Tiro rival (-1)', { rivalShots: next }, {});
    },
    [match, recordEvent]
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
      const next = Math.max(0, players[playerId].shots + delta);
      recordEvent(delta > 0 ? 'Lanzamiento' : 'Lanzamiento (-1)', {}, { [playerId]: { shots: next } });
    },
    [players, recordEvent]
  );

  // Gol/Fallo con zona (lanzamiento y, si es gol, entrada a portería), igual
  // que el gol rival: se guarda como documento propio en matches/{id}/shotEvents.
  const playerGoalWithDetail = useCallback(
    (playerId, { shotZone, goalZone }) => {
      if (!match) return;
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
    (playerId, { shotZone }) => {
      if (!match) return;
      const next = Math.max(0, players[playerId].shots + 1);
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'shotEvents'));
      recordEvent('Fallo', {}, { [playerId]: { shots: next } }, {
        create: {
          ref,
          data: { playerId, type: 'miss', minute, period: match.period, shotZone: shotZone || null, goalZone: null, createdAt: Date.now() },
        },
      });
    },
    [match, players, matchId, liveElapsedMs, recordEvent]
  );

  const playerRecovery = useCallback(
    (playerId, delta = 1) => {
      const next = Math.max(0, players[playerId].recoveries + delta);
      recordEvent(delta > 0 ? 'Recuperación' : 'Recuperación (-1)', {}, { [playerId]: { recoveries: next } });
    },
    [players, recordEvent]
  );

  // Solo tiene sentido para quien juega de portero en este partido.
  const playerSave = useCallback(
    (playerId, delta = 1) => {
      const next = Math.max(0, players[playerId].saves + delta);
      recordEvent(delta > 0 ? 'Parada' : 'Parada (-1)', {}, { [playerId]: { saves: next } });
    },
    [players, recordEvent]
  );

  // Parada con zona: se guarda como documento propio en
  // matches/{id}/saveEvents, igual que el gol/fallo propio.
  const playerSaveWithDetail = useCallback(
    (playerId, { goalZone }) => {
      if (!match) return;
      const next = Math.max(0, players[playerId].saves + 1);
      const minute = Math.floor(liveElapsedMs / 60000) + 1;
      const ref = doc(collection(db, 'matches', matchId, 'saveEvents'));
      recordEvent('Parada', {}, { [playerId]: { saves: next } }, {
        create: {
          ref,
          data: { playerId, minute, period: match.period, goalZone: goalZone || null, createdAt: Date.now() },
        },
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
      const nowMs = Date.now();
      const p = players[playerId];
      const nextCount = p.exclusionsCount + 1;
      const accumulatedMs = p.onCourtSinceMs ? p.accumulatedMs + (nowMs - p.onCourtSinceMs) : p.accumulatedMs;
      const willDisqualify = nextCount >= 3;
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
        });
      } else {
        recordEvent('Exclusión 2min', {}, {
          [playerId]: {
            exclusionsCount: nextCount,
            excluded: true,
            exclusionEndsAtMs: nowMs + EXCLUSION_MS,
            accumulatedMs,
            onCourtSinceMs: null,
          },
        });
      }
      return willDisqualify;
    },
    [players, recordEvent]
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

  // --- Sustitución ---
  // Si el que sale es el portero de este partido, el que entra hereda ese
  // rol — el portero es un papel del partido, no de la ficha del jugador.
  const substitute = useCallback(
    (outPlayerId, inPlayerId) => {
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
    if (eventData.createdRefPath) {
      batch.delete(doc(db, eventData.createdRefPath));
    }
    batch.delete(eventDoc.ref);
    await batch.commit();
  }, [eventsCol, matchRef, playerRef]);

  const state = useMemo(
    () => ({
      lifecycle: match?.lifecycle || 'scheduled',
      rivalName: match?.rivalName || 'Rival',
      ownTeamName: match?.ownTeamName || 'Mi equipo',
      isHome: match?.isHome ?? true,
      venue: match?.venue || '',
      scheduledAt: match?.scheduledAt || null,
      clock: { status: match?.status || 'idle', period: match?.period || 1, elapsedMs: liveElapsedMs },
      score: match?.score || { own: 0, rival: 0 },
      rivalShots: match?.rivalShots || 0,
      timeouts: match?.timeouts || { own: { 1: 0, 2: 0 }, rival: { 1: 0, 2: 0 } },
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
    startPeriod2,
    finishMatch,
    rivalGoal,
    rivalGoalWithDetail,
    rivalShot,
    timeout,
    playerGoal,
    playerGoalWithDetail,
    playerShot,
    playerShotWithDetail,
    playerRecovery,
    playerSave,
    playerSaveWithDetail,
    playerExclusion,
    cancelExclusion,
    substitute,
    substituteDisqualified,
    undo,
  };
}
