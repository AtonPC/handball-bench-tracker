import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Tarjetas amarillas propias en un partido: jugador y minuto, como mucho
// una por jugador — para la cronología de la vista de Seguidor.
export function useYellowCardEvents(matchId) {
  const [yellowCardEvents, setYellowCardEvents] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setYellowCardEvents([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'yellowCardEvents'), orderBy('minute', 'asc')),
      (snap) => setYellowCardEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return yellowCardEvents;
}
