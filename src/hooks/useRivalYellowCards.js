import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Tarjetas amarillas del rival en un partido: solo dorsal y minuto, igual
// que un 7 metros rival — sin cuenta atrás, no es una sanción temporal.
export function useRivalYellowCards(matchId) {
  const [rivalYellowCards, setRivalYellowCards] = useState([]);

  useEffect(() => {
    if (!matchId) {
      setRivalYellowCards([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'matches', matchId, 'rivalYellowCards'), orderBy('minute', 'asc')),
      (snap) => setRivalYellowCards(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [matchId]);

  return rivalYellowCards;
}

// Resumen por dorsal: si ya tiene tarjeta amarilla este partido, más el id
// del evento para poder anularla si se marcó por error. Como mucho una
// por dorsal — si por lo que sea hay más de un documento (no debería), se
// queda con el más reciente para el botón de anular.
export function summarizeRivalYellowCards(rivalYellowCards) {
  const byNumber = {};
  for (const e of rivalYellowCards) {
    const cur = byNumber[e.number] || { number: e.number, lastEventId: null, lastMinute: -1 };
    if (e.minute >= cur.lastMinute) {
      cur.lastMinute = e.minute;
      cur.lastEventId = e.id;
    }
    byNumber[e.number] = cur;
  }
  return Object.values(byNumber).sort((a, b) => a.number - b.number);
}
