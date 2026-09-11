import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Recuperaciones propias con su minuto — para la cronología de la vista
// de Seguidor (antes solo era un contador, sin momento en que ocurrió).
export function useRecoveryEvents(matchId) {
  const [recoveryEvents, setRecoveryEvents] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setRecoveryEvents([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'recoveryEvents'), orderBy('minute', 'asc')),
      (snap) => setRecoveryEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return recoveryEvents;
}
