import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const MATCH_SUBCOLLECTIONS = [
  'players', 'events', 'rivalGoals', 'rivalMisses', 'shotEvents', 'saveEvents', 'rivalExclusions', 'recoveryEvents', 'exclusionEvents', 'rivalSevenMeters',
  'yellowCardEvents', 'rivalYellowCards',
];

const matchesCol = collection(db, 'matches');

// Partidos de un equipo concreto: cada uno tiene su propia convocatoria y
// sus propias estadísticas (subcolecciones players/events bajo matches/{id}).
export function useMatches(clubId, teamId) {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!teamId) {
      setMatches([]);
      return undefined;
    }
    const unsub = onSnapshot(query(matchesCol, where('teamId', '==', teamId)), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setMatches(list);
    });
    return unsub;
  }, [teamId]);

  const createMatch = useCallback(async ({ rivalName, isHome, venue, scheduledAt, ownTeamName, jornada, rivalCrestUrl, callUpPlayerIds, startingLineupIds, startingGoalkeeperId, periodDurationMs, periodCount }) => {
    const count = periodCount === 4 ? 4 : 2;
    const zeroTimeouts = Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, 0]));
    const ref = await addDoc(matchesCol, {
      clubId,
      teamId,
      rivalName,
      isHome,
      venue,
      scheduledAt,
      ownTeamName,
      jornada: jornada || null,
      rivalCrestUrl: rivalCrestUrl || '',
      callUpPlayerIds,
      startingLineupIds: startingLineupIds || [],
      startingGoalkeeperId: startingGoalkeeperId || null,
      periodDurationMs: periodDurationMs || (count === 4 ? 10 : 20) * 60000,
      periodCount: count,
      periodEnded: false,
      lifecycle: 'scheduled', // 'scheduled' | 'live' | 'finished'
      status: 'idle', // cronómetro: 'idle' | 'running' | 'paused'
      period: 1,
      accumulatedMs: 0,
      periodStartAccumulatedMs: 0,
      runningSinceMs: null,
      score: { own: 0, rival: 0 },
      rivalShots: 0,
      timeouts: { own: { ...zeroTimeouts }, rival: { ...zeroTimeouts } },
      courtSlots: [],
      bench: [],
      createdAt: Date.now(),
    });
    return ref.id;
  }, [clubId, teamId]);

  // Editar un partido programado permite tocar convocatoria y titulares;
  // uno finalizado solo los datos del propio partido (rival, lugar, fecha) —
  // ya jugó con quien jugó, así que MatchesAdmin no manda esos campos.
  const updateMatch = useCallback((matchId, data) => updateDoc(doc(db, 'matches', matchId), data), []);

  // Borra el partido y, si ya se jugó, también sus subcolecciones (Firestore
  // no las borra solas al borrar el documento padre) — si no, quedarían
  // estadísticas huérfanas sin ningún partido que las referencie. La lógica
  // vive en `deleteMatchById` (fuera del hook) para poder borrar desde un
  // sitio que no quiere suscribirse a la lista completa de partidos —p. ej.
  // el botón de borrar dentro de la propia pantalla de Estadísticas.
  const removeMatch = useCallback((matchId) => deleteMatchById(matchId), []);

  // Convierte un partido programado en el partido en juego: siembra las
  // estadísticas en vivo de cada convocado a partir de la plantilla del equipo.
  // El portero es quien se haya elegido para ESTE partido (startingGoalkeeperId),
  // no lo que diga la ficha del jugador — si no se eligió a nadie, nadie
  // empieza como portero y habrá que asignarlo a mano si hace falta.
  const startMatch = useCallback(async (matchId, callUpPlayerIds, rosterById, startingLineupIds, startingGoalkeeperId) => {
    // Descarta convocados que ya no existen en la plantilla (p. ej. borrados
    // después de armar la convocatoria) para no dejar ids huérfanos en pista.
    const validIds = callUpPlayerIds.filter((pid) => rosterById[pid]);
    const validStarters = (startingLineupIds || []).filter((pid) => validIds.includes(pid));
    // Si se eligieron titulares explícitamente (6+1), se respetan; si no, se
    // usan los 7 primeros de la convocatoria, como antes.
    const courtSlots = validStarters.length === 7 ? validStarters : validIds.slice(0, 7);
    const bench = validIds.filter((pid) => !courtSlots.includes(pid));
    const batch = writeBatch(db);
    batch.update(doc(db, 'matches', matchId), { lifecycle: 'live', courtSlots, bench });
    for (const pid of validIds) {
      const rp = rosterById[pid];
      batch.set(doc(db, 'matches', matchId, 'players', pid), {
        number: rp.number,
        name: rp.displayName || `${rp.firstName} ${rp.lastName}`.trim(),
        isGK: pid === startingGoalkeeperId,
        photoUrl: rp.photoUrl || null,
        goals: 0,
        shots: 0,
        saves: 0,
        recoveries: 0,
        exclusionsCount: 0,
        disqualified: false,
        yellowCard: false,
        accumulatedMs: 0,
        onCourtSinceMs: null,
        excluded: false,
        exclusionEndsAtMs: null,
      });
    }
    await batch.commit();
  }, []);

  return { matches, createMatch, updateMatch, removeMatch, startMatch };
}

// Borra un partido y, si ya se jugó, también sus subcolecciones — misma
// lógica que usaba `removeMatch` del hook, extraída para poder llamarla sin
// necesitar la suscripción completa a la lista de partidos (p. ej. el botón
// de borrar dentro de la propia pantalla de Estadísticas, en App.jsx).
export async function deleteMatchById(matchId) {
  const batch = writeBatch(db);
  for (const sub of MATCH_SUBCOLLECTIONS) {
    const snap = await getDocs(collection(db, 'matches', matchId, sub));
    snap.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(doc(db, 'matches', matchId));
  await batch.commit();
}

// Busca el último lugar registrado para un rival concreto en el histórico de
// partidos de este equipo (sustituye al viejo directorio de "equipos rivales").
export function findLastVenueForRival(matches, rivalName) {
  const needle = rivalName.trim().toLowerCase();
  if (!needle) return '';
  const found = matches.find((m) => m.rivalName?.trim().toLowerCase() === needle && m.venue);
  return found?.venue || '';
}
