import { formatClock } from '../utils/time';

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

export default function StatsView({ store }) {
  const { state } = store;
  const players = Object.values(state.players).sort((a, b) => a.number - b.number);

  const teamShots = players.reduce((sum, p) => sum + p.shots, 0);
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
          <span className="stats-summary-label">Tiros totales</span>
          <span className="stats-summary-value">{teamShots}</span>
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
              <th>% goles equipo</th>
              <th>Tiros</th>
              <th>% tiros equipo</th>
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
                <td>{pct(p.goals, state.score.own)}</td>
                <td>{p.shots}</td>
                <td>{pct(p.shots, teamShots)}</td>
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
