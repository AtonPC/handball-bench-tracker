import { useMemo, useState } from 'react';
import { formatClock } from '../utils/time';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useRivalMisses } from '../hooks/useRivalMisses';
import { useRivalExclusions, rivalExclusionCountsByNumber } from '../hooks/useRivalExclusions';
import { useMatchEvents } from '../hooks/useMatchEvents';
import { useShotEvents } from '../hooks/useShotEvents';
import { useSaveEvents } from '../hooks/useSaveEvents';
import { hasCapability } from '../permissions';
import PlayerStatsTable from './PlayerStatsTable';
import ActionStatsView from './ActionStatsView';
import MatchSummaryView from './MatchSummaryView';

const SUBSTITUTION_LABELS = new Set(['Cambio', 'Cambio por expulsión']);

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

function exclusionRowClass(p) {
  if (p.disqualified) return 'stats-row--danger';
  if ((p.exclusionsCount || 0) >= 1) return 'stats-row--warning';
  return undefined;
}

// Top N por un criterio, solo entre quienes tienen algo que mostrar (evita
// listas llenas de ceros cuando casi nadie ha marcado o recuperado todavía).
function topN(players, value, n, { allowZero } = {}) {
  return [...players]
    .filter((p) => allowZero || value(p) > 0)
    .sort((a, b) => value(b) - value(a))
    .slice(0, n);
}

export default function StatsView({ store, identity, teamId }) {
  const { state, matchId } = store;
  const rivalGoals = useRivalGoals(matchId);
  const rivalGoalsByNumber = useMemo(() => {
    const map = {};
    for (const g of rivalGoals) {
      map[g.number] = (map[g.number] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [rivalGoals]);

  const rivalExclusions = useRivalExclusions(matchId);
  const rivalExclusionCounts = useMemo(() => rivalExclusionCountsByNumber(rivalExclusions), [rivalExclusions]);
  const matchEvents = useMatchEvents(matchId);
  const substitutionsCount = useMemo(
    () => matchEvents.filter((e) => SUBSTITUTION_LABELS.has(e.label)).length,
    [matchEvents]
  );
  const canCoachPanel = hasCapability(identity, teamId, 'coachPanel');
  const [search, setSearch] = useState('');
  const shotEvents = useShotEvents(matchId);
  const saveEvents = useSaveEvents(matchId);
  const rivalMisses = useRivalMisses(matchId);

  const players = Object.values(state.players)
    .map((p) => ({ ...p, attempts: p.goals + p.shots, shotsFaced: (p.saves || 0) + state.score.rival }))
    .sort((a, b) => a.number - b.number);

  const searchNeedle = search.trim().toLowerCase();
  const visiblePlayers = searchNeedle
    ? players.filter((p) => `${p.name || ''} ${p.number ?? ''}`.toLowerCase().includes(searchNeedle))
    : players;

  const teamGoals = players.reduce((sum, p) => sum + p.goals, 0);
  const teamMisses = players.reduce((sum, p) => sum + p.shots, 0);
  const teamAttempts = teamGoals + teamMisses;
  const teamRecoveries = players.reduce((sum, p) => sum + p.recoveries, 0);
  const teamSaves = players.reduce((sum, p) => sum + (p.saves || 0), 0);
  const teamShotsFaced = teamSaves + state.score.rival;
  const teamExclusions = players.reduce((sum, p) => sum + (p.exclusionsCount || 0), 0);
  const teamDisqualifications = players.filter((p) => p.disqualified).length;

  const topScorers = topN(players, (p) => p.goals, 5);
  const topRecoverers = topN(players, (p) => p.recoveries, 5);
  const topSavers = topN(players.filter((p) => p.isGK), (p) => p.saves || 0, 5);

  // Para el entrenador (capacidad "coachPanel"): cómo se han repartido los
  // minutos, para detectar rotación desigual de un vistazo. Los máximos
  // goleadores/recuperadores/paradores ya se ven arriba, para todo el staff.
  const mostMinutes = topN(players, (p) => p.accumulatedMs, 5, { allowZero: true });
  const leastMinutes = [...players].sort((a, b) => a.accumulatedMs - b.accumulatedMs).slice(0, 5);

  return (
    <div className="stats-view">
      <div className="list-search">
        <input
          className="player-form-input"
          placeholder="Filtrar por jugador o dorsal…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <h3 className="stats-section-title">Resumen del partido</h3>
        <MatchSummaryView
          statePlayers={state.players}
          shotEvents={shotEvents}
          saveEvents={saveEvents}
          rivalGoals={rivalGoals}
          rivalMisses={rivalMisses}
          rivalExclusions={rivalExclusions}
          ownTeamName={state.ownTeamName}
          rivalName={state.rivalName}
        />
      </div>

      <div className="stats-summary" style={{ marginTop: 'var(--space-4)' }}>
        {state.jornada != null && (
          <div className="stats-summary-item">
            <span className="stats-summary-label">Jornada</span>
            <span className="stats-summary-value">{state.jornada}</span>
          </div>
        )}
        <div className="stats-summary-item stats-summary-item--score">
          <span className="stats-summary-label">Resultado</span>
          <span className="stats-summary-value">{state.score.own} - {state.score.rival}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Goles/Tiros</span>
          <span className="stats-summary-value">{teamGoals}/{teamAttempts}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">% Acierto</span>
          <span className="stats-summary-value">{pct(teamGoals, teamAttempts)}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Paradas/Tiros</span>
          <span className="stats-summary-value">{teamSaves}/{teamShotsFaced}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">% Paradas</span>
          <span className="stats-summary-value">{pct(teamSaves, teamShotsFaced)}</span>
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
          <span className="stats-summary-label">Rojas</span>
          <span className="stats-summary-value">{teamDisqualifications}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Cambios</span>
          <span className="stats-summary-value">{substitutionsCount}</span>
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: 'var(--space-4)' }}>
        <div className="card">
          <h4>Máximos goleadores</h4>
          {topScorers.length === 0 && <p>Todavía nadie ha marcado.</p>}
          {topScorers.map((p, i) => <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.goals} gol{p.goals === 1 ? '' : 'es'} · {pct(p.goals, p.attempts)} acierto</p>)}
        </div>
        <div className="card">
          <h4>Máximos recuperadores</h4>
          {topRecoverers.length === 0 && <p>Todavía nadie ha recuperado.</p>}
          {topRecoverers.map((p, i) => <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.recoveries} recup.</p>)}
        </div>
        <div className="card">
          <h4>Más paradas</h4>
          {topSavers.length === 0 && <p>Todavía nadie ha parado.</p>}
          {topSavers.map((p, i) => <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.saves} paradas · {pct(p.saves, p.shotsFaced)} paradas</p>)}
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-5)' }}>
        <h3 className="stats-section-title">Estadísticas de Acciones</h3>
        <ActionStatsView
          shotEvents={shotEvents}
          saveEvents={saveEvents}
          rivalGoals={rivalGoals}
          rivalMisses={rivalMisses}
          players={players}
          ownTeamName={state.ownTeamName}
          rivalName={state.rivalName}
        />
      </div>

      {(rivalGoals.length > 0 || rivalExclusions.length > 0) && (
        <div className="card-grid" style={{ marginTop: 'var(--space-4)' }}>
          {rivalGoals.length > 0 && (
            <div className="card">
              <h4>Goles rivales por dorsal</h4>
              <p>{rivalGoalsByNumber.map(([number, count]) => `#${number} (${count})`).join(' · ')}</p>
            </div>
          )}
          {rivalExclusions.length > 0 && (
            <div className="card">
              <h4>Exclusiones rivales por dorsal</h4>
              <p>
                {Object.keys(rivalExclusionCounts)
                  .sort((a, b) => a - b)
                  .map((n) => `#${n} (${rivalExclusionCounts[n]}${rivalExclusionCounts[n] >= 3 ? ' — roja' : ''})`)
                  .join(' · ')}
              </p>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 'var(--space-4)' }}>
        <PlayerStatsTable
          rows={visiblePlayers}
          minutesTotalMs={state.clock.elapsedMs}
          showMinutes
          rowClassName={exclusionRowClass}
          emptyMessage="Ningún jugador coincide con el filtro."
        />
      </div>

      {canCoachPanel && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <h3 className="stats-section-title">Reparto de minutos (Entrenador)</h3>
          <div className="card-grid" style={{ marginTop: 'var(--space-3)' }}>
            <div className="card">
              <h4>Más minutos jugados</h4>
              {mostMinutes.map((p, i) => <p key={p.id}>{i + 1}. #{p.number} {p.name} — {formatClock(p.accumulatedMs)} ({pct(p.accumulatedMs, state.clock.elapsedMs)})</p>)}
            </div>
            <div className="card">
              <h4>Menos minutos jugados</h4>
              {leastMinutes.map((p, i) => <p key={p.id}>{i + 1}. #{p.number} {p.name} — {formatClock(p.accumulatedMs)} ({pct(p.accumulatedMs, state.clock.elapsedMs)})</p>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
