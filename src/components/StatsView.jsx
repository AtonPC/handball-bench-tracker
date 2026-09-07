import { useMemo } from 'react';
import { formatClock } from '../utils/time';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useShotEvents } from '../hooks/useShotEvents';

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

export default function StatsView({ store }) {
  const { state, matchId } = store;
  const rivalGoals = useRivalGoals(matchId);
  const rivalGoalsByNumber = useMemo(() => {
    const map = {};
    for (const g of rivalGoals) {
      map[g.number] = (map[g.number] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [rivalGoals]);

  const shotEvents = useShotEvents(matchId);
  const nameById = useMemo(() => {
    const map = {};
    for (const p of Object.values(state.players)) map[p.id] = p.name;
    return map;
  }, [state.players]);

  const players = Object.values(state.players)
    .map((p) => ({ ...p, attempts: p.goals + p.shots }))
    .sort((a, b) => a.number - b.number);

  const teamGoals = players.reduce((sum, p) => sum + p.goals, 0);
  const teamMisses = players.reduce((sum, p) => sum + p.shots, 0);
  const teamAttempts = teamGoals + teamMisses;
  const teamRecoveries = players.reduce((sum, p) => sum + p.recoveries, 0);
  const teamExclusions = players.reduce((sum, p) => sum + (p.exclusionsCount || 0), 0);
  const teamDisqualifications = players.filter((p) => p.disqualified).length;

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
        <div className="stats-summary-item">
          <span className="stats-summary-label">Exclusiones</span>
          <span className="stats-summary-value">{teamExclusions}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Expulsiones</span>
          <span className="stats-summary-value">{teamDisqualifications}</span>
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
              <th>Excl.</th>
              <th>Expulsado</th>
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
                <td>{p.exclusionsCount || 0}</td>
                <td>{p.disqualified ? 'Sí' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rivalGoals.length > 0 && (
        <>
          <h3 className="stats-section-title">Goles rivales</h3>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Min.</th>
                  <th>Dorsal</th>
                  <th>Zona de lanzamiento</th>
                  <th>Zona de entrada</th>
                </tr>
              </thead>
              <tbody>
                {rivalGoals.map((g) => (
                  <tr key={g.id}>
                    <td>{g.minute}'</td>
                    <td>#{g.number}</td>
                    <td>{g.shotZone || '—'}</td>
                    <td>{g.goalZone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="modal-hint">
            Por dorsal: {rivalGoalsByNumber.map(([number, count]) => `#${number} (${count})`).join(' · ')}
          </p>
        </>
      )}

      {shotEvents.length > 0 && (
        <>
          <h3 className="stats-section-title">Lanzamientos propios (con zona)</h3>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Min.</th>
                  <th>Jugador</th>
                  <th>Resultado</th>
                  <th>Zona de lanzamiento</th>
                  <th>Zona de entrada</th>
                </tr>
              </thead>
              <tbody>
                {shotEvents.map((s) => (
                  <tr key={s.id}>
                    <td>{s.minute}'</td>
                    <td>{nameById[s.playerId] || s.playerId}</td>
                    <td>{s.type === 'goal' ? 'Gol' : 'Fallo'}</td>
                    <td>{s.shotZone || '—'}</td>
                    <td>{s.goalZone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
