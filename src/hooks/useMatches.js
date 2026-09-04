import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

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

  const createMatch = useCallback(async ({ rivalName, isHome, venue, scheduledAt, ownTeamName, callUpPlayerIds }) => {
    const ref = await addDoc(matchesCol, {
      clubId,
      teamId,
      rivalName,
      isHome,
      venue,
      scheduledAt,
      ownTeamName,
      callUpPlayerIds,
      lifecycle: 'scheduled', // 'scheduled' | 'live' | 'finished'
      status: 'idle', // cronómetro: 'idle' | 'running' | 'paused'
      period: 1,
      accumulatedMs: 0,
      runningSinceMs: null,
      score: { own: 0, rival: 0 },
      rivalShots: 0,
      timeouts: { own: { 1: 0, 2: 0 }, rival: { 1: 0, 2: 0 } },
      courtSlots: [],
      bench: [],
      createdAt: Date.now(),
    });
    return ref.id;
  }, [clubId, teamId]);

  // Convierte un partido programado en el partido en juego: siembra las
  // estadísticas en vivo de cada convocado a partir de la plantilla del equipo.
  const startMatch = useCallback(async (matchId, callUpPlayerIds, rosterById) => {
    // Descarta convocados que ya no existen en la plantilla (p. ej. borrados
    // después de armar la convocatoria) para no dejar ids huérfanos en pista.
    const validIds = callUpPlayerIds.filter((pid) => rosterById[pid]);
    const batch = writeBatch(db);
    const courtSlots = validIds.slice(0, 7);
    const bench = validIds.slice(7);
    batch.update(doc(db, 'matches', matchId), { lifecycle: 'live', courtSlots, bench });
    for (const pid of validIds) {
      const rp = rosterById[pid];
      batch.set(doc(db, 'matches', matchId, 'players', pid), {
        number: rp.number,
        name: rp.displayName || `${rp.firstName} ${rp.lastName}`.trim(),
        isGK: !!rp.isGK,
        photoUrl: rp.photoUrl || null,
        goals: 0,
        shots: 0,
        recoveries: 0,
        losses: 0,
        exclusionsCount: 0,
        accumulatedMs: 0,
        onCourtSinceMs: null,
        excluded: false,
        exclusionEndsAtMs: null,
      });
    }
    await batch.commit();
  }, []);

  return { matches, createMatch, startMatch };
}

// Busca el último lugar registrado para un rival concreto en el histórico de
// partidos de este equipo (sustituye al viejo directorio de "equipos rivales").
export function findLastVenueForRival(matches, rivalName) {
  const needle = rivalName.trim().toLowerCase();
  if (!needle) return '';
  const found = matches.find((m) => m.rivalName?.trim().toLowerCase() === needle && m.venue);
  return found?.venue || '';
}
