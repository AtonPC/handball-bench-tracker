import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Exclusiones del rival en un partido: solo dorsal y minuto (sin zonas).
// Cada una lleva su propia cuenta atrás (endsAtMs).
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

// Igual que useRivalExclusions, pero con un "reloj" que va marcando cuánto
// falta de cada exclusión (remainingMs/active) — el tick solo corre
// mientras haya alguna exclusión todavía activa, para no consumir CPU de
// más el resto del tiempo.
export function useRivalExclusionsLive(matchId) {
  const rivalExclusions = useRivalExclusions(matchId);
  const [now, setNow] = useState(Date.now());
  const hasActive = rivalExclusions.some((e) => e.endsAtMs && e.endsAtMs > now);

  useEffect(() => {
    if (!hasActive) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasActive]);

  return rivalExclusions.map((e) => {
    const remainingMs = e.endsAtMs ? Math.max(0, e.endsAtMs - now) : 0;
    return { ...e, remainingMs, active: remainingMs > 0 };
  });
}

// Conteo acumulado de exclusiones por dorsal rival — a partir de 3 ese
// dorsal queda "expulsado" (misma regla que el propio equipo), para que
// el delegado sepa en directo que ya no puede seguir jugando.
export function rivalExclusionCountsByNumber(rivalExclusions) {
  const counts = {};
  // Una roja directa (`red`) no es una exclusión: no cuenta para el 1/3, 2/3...
  for (const e of rivalExclusions) if (!e.red) counts[e.number] = (counts[e.number] || 0) + 1;
  return counts;
}

// Resumen por dorsal a partir de useRivalExclusionsLive: cuántas exclusiones
// lleva, si alguna sigue activa ahora mismo (con cuánto le queda) y si ya
// está expulsado — más el id de la más reciente, para poder anularla si se
// marcó por error.
export function summarizeRivalExclusions(liveRivalExclusions) {
  const byNumber = {};
  for (const e of liveRivalExclusions) {
    const cur = byNumber[e.number] || { number: e.number, count: 0, red: false, activeRemainingMs: 0, lastEventId: null, lastMinute: -1 };
    if (e.red) cur.red = true; else cur.count += 1;
    if (e.active && e.remainingMs > cur.activeRemainingMs) cur.activeRemainingMs = e.remainingMs;
    if (e.minute >= cur.lastMinute) {
      cur.lastMinute = e.minute;
      cur.lastEventId = e.id;
    }
    byNumber[e.number] = cur;
  }
  return Object.values(byNumber)
    .map((x) => ({ ...x, disqualified: x.red || x.count >= 3 }))
    .sort((a, b) => a.number - b.number);
}
