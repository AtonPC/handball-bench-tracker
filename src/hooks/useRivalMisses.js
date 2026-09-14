import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Detalle de los fallos del rival en un partido (tiró y se fue fuera, sin
// que el portero parara nada): dorsal, minuto y zonas. Necesario para que
// "Tiros del rival" (goles + nuestras paradas + esto) y su % de acierto
// sean datos reales, no una aproximación.
export function useRivalMisses(matchId) {
  const [rivalMisses, setRivalMisses] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setRivalMisses([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'rivalMisses'), orderBy('minute', 'asc')),
      (snap) => setRivalMisses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return rivalMisses;
}
