import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Resumen del equipo: suma sobre la marcha las estadísticas de todos los
// partidos finalizados (lee la subcolección players de cada uno, y el propio
// partido para su duración total y los goles rivales encajados). No guarda
// ningún acumulado aparte — eso es el "histórico" de la Fase 1 (seasonStats),
// que evita releer todo el historial cada vez que crezca.
export function useTeamStats(finishedMatchIds) {
  const [totals, setTotals] = useState({});
  const [teamTotalMs, setTeamTotalMs] = useState(0);
  const [teamRivalGoalsConceded, setTeamRivalGoalsConceded] = useState(0);
  const [loading, setLoading] = useState(false);
  const key = finishedMatchIds.join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) {
      setTotals({});
      setTeamTotalMs(0);
      setTeamRivalGoalsConceded(0);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const acc = {};
      let totalMs = 0;
      let rivalGoalsConceded = 0;
      for (const matchId of ids) {
        const [playersSnap, matchSnap] = await Promise.all([
          getDocs(collection(db, 'matches', matchId, 'players')),
          getDoc(doc(db, 'matches', matchId)),
        ]);
        totalMs += matchSnap.data()?.accumulatedMs || 0;
        rivalGoalsConceded += matchSnap.data()?.score?.rival || 0;
        playersSnap.forEach((d) => {
          const p = d.data();
          const cur = acc[d.id] || {
            number: p.number, name: p.name, isGK: p.isGK,
            goals: 0, shots: 0, saves: 0, recoveries: 0, exclusionsCount: 0, yellowCards: 0, disqualifications: 0, accumulatedMs: 0,
            matchesCalledUp: 0, matchesPlayed: 0,
          };
          cur.number = p.number;
          cur.name = p.name;
          cur.isGK = p.isGK;
          cur.goals += p.goals || 0;
          cur.shots += p.shots || 0;
          cur.saves += p.saves || 0;
          cur.recoveries += p.recoveries || 0;
          cur.exclusionsCount += p.exclusionsCount || 0;
          cur.yellowCards += p.yellowCard ? 1 : 0;
          cur.disqualifications += p.disqualified ? 1 : 0;
          cur.accumulatedMs += p.accumulatedMs || 0;
          // Convocado: tiene documento en este partido. Jugado: además pisó
          // la pista al menos un instante (accumulatedMs > 0).
          cur.matchesCalledUp += 1;
          if ((p.accumulatedMs || 0) > 0) cur.matchesPlayed += 1;
          acc[d.id] = cur;
        });
      }
      if (!cancelled) {
        setTotals(acc);
        setTeamTotalMs(totalMs);
        setTeamRivalGoalsConceded(rivalGoalsConceded);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { totals, teamTotalMs, teamRivalGoalsConceded, loading };
}
