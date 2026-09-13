import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// 7 metros provocados por el rival (falta suya) en un partido: solo dorsal
// y minuto, igual que una exclusión rival — sin cuenta atrás, no es una
// sanción temporal.
export function useRivalSevenMeters(matchId) {
  const [rivalSevenMeters, setRivalSevenMeters] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setRivalSevenMeters([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'rivalSevenMeters'), orderBy('minute', 'asc')),
      (snap) => setRivalSevenMeters(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return rivalSevenMeters;
}

// Resumen por dorsal: cuántos 7m ha cometido cada uno, más el id del más
// reciente para poder anularlo si se marcó por error.
export function summarizeRivalSevenMeters(rivalSevenMeters) {
  const byNumber = {};
  for (const e of rivalSevenMeters) {
    const cur = byNumber[e.number] || { number: e.number, count: 0, lastEventId: null, lastMinute: -1 };
    cur.count += 1;
    if (e.minute >= cur.lastMinute) {
      cur.lastMinute = e.minute;
      cur.lastEventId = e.id;
    }
    byNumber[e.number] = cur;
  }
  return Object.values(byNumber).sort((a, b) => a.number - b.number);
}
