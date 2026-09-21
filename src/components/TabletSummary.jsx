import { missKindOf } from '../shotZones';
import { fieldPlayerZoneStats, rivalShotZoneStats } from '../utils/zoneStats';

// Resumen de la columna derecha de la consola de tablet (mockup aprobado,
// 2026-09-21): una fila por estadística, lo nuestro a la izquierda y lo del
// rival a la derecha, con el detalle (aciertos/total) debajo del número grande.
// Se calcula aquí mismo con los datos en bruto del partido, igual que
// MatchSummaryView, para no duplicar contadores.

const pct = (made, total) => (total ? `${Math.round((made / total) * 100)}%` : '—');

// «made/total» de zoneStats (viene como ["4/6", "67%"]) de vuelta a números.
function madeTotal(statLine) {
  if (!statLine) return { made: 0, total: 0 };
  const [made, total] = statLine[0].split('/').map(Number);
  return { made, total };
}

const countBy = (list, fn) => list.filter(fn).length;

export default function TabletSummary({
  statePlayers = {}, shotEvents = [], rivalGoals = [], rivalMisses = [], rivalExclusions = [],
  rivalYellowCards = [], teamActions = [], possessions = { own: 0, rival: 0 },
}) {
  const players = Object.values(statePlayers);
  const sum = (key) => players.reduce((s, p) => s + (p[key] || 0), 0);

  const ownGoals = sum('goals');
  const ownAttempts = ownGoals + sum('shots');
  const rivalAttempts = rivalGoals.length + rivalMisses.length;

  const own7m = madeTotal(fieldPlayerZoneStats(shotEvents).origin['7 metros']);
  const rival7m = madeTotal(rivalShotZoneStats(rivalGoals, rivalMisses).origin['7 metros']);

  const ownSteals = sum('recoveries') + countBy(teamActions, (a) => a.kind === 'steal' && a.team === 'own');
  const rivalSteals = countBy(teamActions, (a) => a.kind === 'steal' && a.team === 'rival');
  // El pasivo cuenta como pérdida del equipo al que se le pita.
  const lost = (team) => countBy(teamActions, (a) => a.team === team && (a.kind === 'turnover' || a.kind === 'passive'));

  // Un fallo nuestro que no se va fuera ni da en el palo es una parada del portero rival.
  const ownSaves = sum('saves');
  const rivalSaves = countBy(shotEvents, (e) => e.type === 'miss' && missKindOf(e.goalZone) === 'saved');
  const ownPosts = countBy(shotEvents, (e) => e.type === 'miss' && missKindOf(e.goalZone) === 'post');
  const rivalPosts = countBy(rivalMisses, (e) => missKindOf(e.goalZone) === 'post');

  const ownCounterGoals = countBy(shotEvents, (e) => e.counter && e.type === 'goal');
  const ownCounterAll = countBy(shotEvents, (e) => e.counter);
  const rivalCounterGoals = countBy(rivalGoals, (e) => e.counter);
  const rivalCounterAll = rivalCounterGoals + countBy(rivalMisses, (e) => e.counter);

  const ownYellow = countBy(players, (p) => p.yellowCard);
  const ownExcl = sum('exclusionsCount');
  const ownRed = countBy(players, (p) => p.disqualified);
  // Roja rival: 3ª exclusión de un dorsal o roja directa (`red`, que no cuenta como exclusión).
  const rivalExcl = rivalExclusions.filter((e) => !e.red);
  const rivalExclCounts = {};
  for (const e of rivalExcl) rivalExclCounts[e.number] = (rivalExclCounts[e.number] || 0) + 1;
  const rivalRed = new Set([...Object.keys(rivalExclCounts).filter((n) => rivalExclCounts[n] >= 3), ...rivalExclusions.filter((e) => e.red).map((e) => String(e.number))]).size;

  const rows = [
    { label: 'Efectividad de tiro', a: pct(ownGoals, ownAttempts), as: `${ownGoals}/${ownAttempts}`, b: pct(rivalGoals.length, rivalAttempts), bs: `${rivalGoals.length}/${rivalAttempts}` },
    { label: '7 m', a: pct(own7m.made, own7m.total), as: `${own7m.made}/${own7m.total}`, b: pct(rival7m.made, rival7m.total), bs: `${rival7m.made}/${rival7m.total}` },
    { label: 'Robos', a: ownSteals, b: rivalSteals },
    { label: 'Pérdidas', a: lost('own'), b: lost('rival') },
    { label: 'Paradas', a: ownSaves, b: rivalSaves },
    { label: 'Tiros al palo', a: ownPosts, b: rivalPosts },
    { label: 'Contraataque', a: `${ownCounterGoals}/${ownCounterAll}`, b: `${rivalCounterGoals}/${rivalCounterAll}` },
    { label: 'Posesiones', a: possessions.own, b: possessions.rival },
    { label: 'Amarillas', a: ownYellow, b: rivalYellowCards.length },
    { label: 'Exclusiones', a: ownExcl, b: rivalExcl.length },
    { label: 'Rojas', a: ownRed, b: rivalRed },
  ];

  return (
    <div className="tsum">
      {rows.map((r) => (
        <div key={r.label} className="tsum-row">
          <span className="tsum-v tsum-v--own"><b>{r.a}</b>{r.as && <small>{r.as}</small>}</span>
          <span className="tsum-l">{r.label}</span>
          <span className="tsum-v tsum-v--rival"><b>{r.b}</b>{r.bs && <small>{r.bs}</small>}</span>
        </div>
      ))}
    </div>
  );
}
