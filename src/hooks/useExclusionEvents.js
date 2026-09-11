import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Exclusiones propias con su minuto (disqualified=true en la 3ª, que es
// expulsión) — para la cronología de la vista de Seguidor.
export function useExclusionEvents(matchId) {
  const [exclusionEvents, setExclusionEvents] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setExclusionEvents([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'exclusionEvents'), orderBy('minute', 'asc')),
      (snap) => setExclusionEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return exclusionEvents;
}
