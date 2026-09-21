import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Últimas `n` acciones anotadas del partido (más reciente primero), para la
// lista «Últimas» de la consola de móvil: { id, label, period, createdAt, playerIds }.
export function useRecentEvents(matchId, n = 3) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setEvents([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'events'), orderBy('createdAt', 'desc'), limit(n)),
      (snap) => setEvents(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, label: data.label, period: data.period, createdAt: data.createdAt, playerIds: (data.undo?.players || []).map((p) => p.id) };
      }))
    );
    return unsub;
  }, [matchId, n]);

  return events;
}
