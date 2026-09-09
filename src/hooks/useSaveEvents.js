import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Detalle de cada parada del portero en un partido: jugador, minuto y zona.
export function useSaveEvents(matchId) {
  const [saveEvents, setSaveEvents] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setSaveEvents([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'saveEvents'), orderBy('minute', 'asc')),
      (snap) => setSaveEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return saveEvents;
}
