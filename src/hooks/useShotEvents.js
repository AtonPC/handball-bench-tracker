import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Detalle de cada gol/fallo propio en un partido: jugador, minuto y zonas.
export function useShotEvents(matchId) {
  const [shotEvents, setShotEvents] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setShotEvents([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'shotEvents'), orderBy('minute', 'asc')),
      (snap) => setShotEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return shotEvents;
}
