import { computeTeamTotals } from '../utils/teamTotals';

const pct = (ratio) => (ratio == null ? '—' : `${Math.round(ratio * 100)}%`);

// Estadísticas globales del equipo, sin ningún desglose por jugador — lo que
// ve un Seguidor Estándar en lugar de la tabla por jugador (partido en
// directo, partido finalizado y temporada).
export default function TeamTotalsCard({ rows, rivalGoalsConceded = 0, title = 'El equipo', matchesCount }) {
  const t = computeTeamTotals(rows, rivalGoalsConceded);
  const items = [
    ...(matchesCount != null ? [['Partidos', matchesCount]] : []),
    ['Goles/Tiros', `${t.goals}/${t.attempts}`],
    ['% Acierto', pct(t.accuracy)],
    ['Goles en contra', t.conceded],
    ['Paradas/Tiros', `${t.saves}/${t.shotsFaced}`],
    ['% Paradas', pct(t.savePct)],
    ['Robos', t.recoveries],
    ['Exclusiones', t.exclusions],
    ['Amarillas', t.yellow],
    ['Rojas', t.red],
  ];
  return (
    <div className="card">
      <h4>{title}</h4>
      <div className="stats-summary">
        {items.map(([label, value]) => (
          <div key={label} className="stats-summary-item">
            <span className="stats-summary-label">{label}</span>
            <span className="stats-summary-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
