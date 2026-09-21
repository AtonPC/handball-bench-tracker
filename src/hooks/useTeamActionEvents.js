import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Robos del rival, pérdidas y pasivos de cualquier equipo (2026-09-21), con su
// minuto: {kind: 'steal'|'turnover'|'passive', team: 'own'|'rival', playerId?, number?}.
export function useTeamActionEvents(matchId) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setEvents([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'teamActionEvents'), orderBy('minute', 'asc')),
      (snap) => setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return events;
}
