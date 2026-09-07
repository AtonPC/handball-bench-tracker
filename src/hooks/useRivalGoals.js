import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Detalle de los goles del rival en un partido: dorsal, minuto y zonas.
export function useRivalGoals(matchId) {
  const [rivalGoals, setRivalGoals] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setRivalGoals([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'rivalGoals'), orderBy('minute', 'asc')),
      (snap) => setRivalGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return rivalGoals;
}
