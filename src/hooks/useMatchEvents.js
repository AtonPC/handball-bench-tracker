import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Log completo de eventos de un partido (goles, cambios, exclusiones…), el
// mismo que usa el deshacer — aquí solo para derivar cosas como el número
// de cambios realizados, no para mostrarlo entero.
export function useMatchEvents(matchId) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setEvents([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'events'), orderBy('createdAt', 'asc')),
      (snap) => setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return events;
}
