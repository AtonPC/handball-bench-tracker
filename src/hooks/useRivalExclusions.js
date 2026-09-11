import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Exclusiones del rival en un partido: solo dorsal y minuto (sin zonas).
export function useRivalExclusions(matchId) {
  const [rivalExclusions, setRivalExclusions] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setRivalExclusions([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'rivalExclusions'), orderBy('minute', 'asc')),
      (snap) => setRivalExclusions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return rivalExclusions;
}

// Conteo acumulado de exclusiones por dorsal rival — a partir de 3 ese
// dorsal queda "expulsado" (misma regla que el propio equipo), para que
// el delegado sepa en directo que ya no puede seguir jugando.
export function rivalExclusionCountsByNumber(rivalExclusions) {
  const counts = {};
  for (const e of rivalExclusions) counts[e.number] = (counts[e.number] || 0) + 1;
  return counts;
}
