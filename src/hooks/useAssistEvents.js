import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Asistencias propias con su minuto (2026-09-21), enlazadas a un gol (shotEventId).
export function useAssistEvents(matchId) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setEvents([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'assistEvents'), orderBy('minute', 'asc')),
      (snap) => setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return events;
}
