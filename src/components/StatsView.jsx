import { formatClock } from '../utils/time';

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

export default function StatsView({ store }) {
  const { state } = store;
  const players = Object.values(state.players)
    .map((p) => ({ ...p, attempts: p.goals + p.shots }))
    .sort((a, b) => a.number - b.number);

  const teamGoals = players.reduce((sum, p) => sum + p.goals, 0);
  const teamMisses = players.reduce((sum, p) => sum + p.shots, 0);
  const teamAttempts = teamGoals + teamMisses;
  const teamRecoveries = players.reduce((sum, p) => sum + p.recoveries, 0);

  return (
    <div className="stats-view">
      <div className="stats-summary">
        <div className="stats-summary-item">
          <span className="stats-summary-label">Marcador</span>
          <span className="stats-summary-value">{state.score.own} - {state.score.rival}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Tiempo de partido</span>
          <span className="stats-summary-value">{formatClock(state.clock.elapsedMs)}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Tiros totales (goles + fallos)</span>
          <span className="stats-summary-value">{teamAttempts}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">% de acierto</span>
          <span className="stats-summary-value">{pct(teamGoals, teamAttempts)}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Recuperaciones</span>
          <span className="stats-summary-value">{teamRecoveries}</span>
        </div>
      </div>

      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Tiempo</th>
              <th>% tiempo</th>
              <th>Goles</th>
              <th>Fallos</th>
              <th>Tiros</th>
              <th>% acierto</th>
              <th>Recup.</th>
              <th>% recup. equipo</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>{p.number}</td>
                <td>{p.name}{p.isGK ? ' (P)' : ''}</td>
                <td>{formatClock(p.accumulatedMs)}</td>
                <td>{pct(p.accumulatedMs, state.clock.elapsedMs)}</td>
                <td>{p.goals}</td>
                <td>{p.shots}</td>
                <td>{p.attempts}</td>
                <td>{pct(p.goals, p.attempts)}</td>
                <td>{p.recoveries}</td>
                <td>{pct(p.recoveries, teamRecoveries)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
