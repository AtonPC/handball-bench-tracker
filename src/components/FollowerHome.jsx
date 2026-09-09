import { useEffect, useMemo, useRef, useState } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useMatchStore } from '../hooks/useMatchStore';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useShotEvents } from '../hooks/useShotEvents';
import { usePlayers } from '../hooks/usePlayers';
import { useTeamStats } from '../hooks/useTeamStats';
import { formatClock } from '../utils/time';
import { teamColorStyle } from '../utils/teamColors';
import GoalCelebration from './GoalCelebration';

// Nombre a mostrar de un jugador propio, respetando imageAuthorized: si el
// club no ha autorizado a mostrar su nombre, solo se ve el dorsal.
function ownPlayerLabel(playersById, authorizedById, playerId) {
  const p = playersById[playerId];
  if (!p) return 'Jugador/a';
  if (authorizedById[playerId] === false) return `Jugador/a #${p.number ?? '?'}`;
  return p.name || `#${p.number ?? '?'}`;
}

function LiveMatchSection({ clubId, teamId, team }) {
  const { matches } = useMatches(clubId, teamId);
  const liveMatch = useMemo(() => matches.find((m) => m.lifecycle === 'live') || null, [matches]);
  const store = useMatchStore(liveMatch?.id || null, !!liveMatch);
  const rivalGoals = useRivalGoals(liveMatch?.id || null);
  const shotEvents = useShotEvents(liveMatch?.id || null);
  const { players } = usePlayers(clubId, teamId);

  const authorizedById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.imageAuthorized !== false])),
    [players]
  );
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const ownGoals = useMemo(() => shotEvents.filter((e) => e.type === 'goal'), [shotEvents]);

  const [celebrationKey, setCelebrationKey] = useState(null);
  const prevOwnGoals = useRef(ownGoals.length);
  useEffect(() => {
    if (ownGoals.length > prevOwnGoals.current) setCelebrationKey(Date.now());
    prevOwnGoals.current = ownGoals.length;
  }, [ownGoals.length]);

  if (!liveMatch || !store.ready) {
    return <p className="modal-hint">Ahora mismo no hay ningún partido en directo.</p>;
  }

  const { state } = store;
  const leftName = state.isHome ? state.ownTeamName : state.rivalName;
  const rightName = state.isHome ? state.rivalName : state.ownTeamName;
  const courtExclusions = state.courtSlots.map((id) => state.players[id]).filter((p) => p?.excluded);

  return (
    <div>
      {celebrationKey && (
        <GoalCelebration
          key={celebrationKey}
          crestUrl={team?.crestUrl}
          goalPhrase={team?.goalPhrase}
          onDone={() => setCelebrationKey(null)}
        />
      )}

      <header className="match-header">
        <div className="header-row">
          <div className="scoreboard">
            <span className="team-name team-name--own">{leftName}</span>
            <span className="score-own">{state.isHome ? state.score.own : state.score.rival}</span>
            <span className="score-sep">-</span>
            <span className="score-rival">{state.isHome ? state.score.rival : state.score.own}</span>
            <span className="team-name team-name--rival">{rightName}</span>
          </div>
          <div className="master-clock">
            <span className="period-label">{state.clock.period}ª parte</span>
            <span className={`clock-time${state.clock.periodRemainingMs < 0 ? ' clock-time--over' : ''}`}>
              {state.clock.periodRemainingMs < 0
                ? `+${formatClock(-state.clock.periodRemainingMs)}`
                : formatClock(state.clock.periodRemainingMs)}
            </span>
          </div>
        </div>
      </header>

      {courtExclusions.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <h4>Exclusiones en pista</h4>
          {courtExclusions.map((p) => (
            <p key={p.id}>
              #{p.number} {authorizedById[p.id] === false ? '' : p.name} — {formatClock(p.exclusionRemainingMs)}
            </p>
          ))}
        </div>
      )}

      <div className="card-grid" style={{ marginTop: 'var(--space-4)' }}>
        <div className="card">
          <h4>Goles de {state.ownTeamName}</h4>
          {ownGoals.length === 0 && <p>Todavía no ha marcado nadie.</p>}
          {ownGoals.map((g) => (
            <p key={g.id}>Min. {g.minute} — {ownPlayerLabel(playersById, authorizedById, g.playerId)}</p>
          ))}
        </div>
        <div className="card">
          <h4>Goles de {state.rivalName}</h4>
          {rivalGoals.length === 0 && <p>Todavía no ha marcado nadie.</p>}
          {rivalGoals.map((g) => (
            <p key={g.id}>Min. {g.minute} — Dorsal {g.number}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccumulatedSection({ clubId, teamId }) {
  const { matches } = useMatches(clubId, teamId);
  const finishedMatches = useMemo(() => matches.filter((m) => m.lifecycle === 'finished'), [matches]);
  const finishedIds = useMemo(() => finishedMatches.map((m) => m.id), [finishedMatches]);
  const { totals, loading } = useTeamStats(finishedIds);
  const { players } = usePlayers(clubId, teamId);
  const authorizedById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.imageAuthorized !== false])),
    [players]
  );

  const rows = useMemo(
    () => Object.entries(totals).map(([id, p]) => ({
      id,
      ...p,
      displayName: authorizedById[id] === false ? `Jugador/a #${p.number ?? '?'}` : p.name,
    })),
    [totals, authorizedById]
  );

  const topScorers = useMemo(
    () => [...rows].filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5),
    [rows]
  );
  const topRecoverers = useMemo(
    () => [...rows].filter((p) => p.recoveries > 0).sort((a, b) => b.recoveries - a.recoveries).slice(0, 5),
    [rows]
  );

  if (loading) return <p className="modal-hint">Calculando…</p>;
  if (finishedMatches.length === 0) {
    return <p className="modal-hint">Todavía no hay partidos finalizados.</p>;
  }

  return (
    <div style={{ marginTop: 'var(--space-5)' }}>
      <p className="modal-hint">
        {finishedMatches.length} partido{finishedMatches.length === 1 ? '' : 's'} finalizado{finishedMatches.length === 1 ? '' : 's'}
      </p>
      <div className="card-grid" style={{ marginTop: 'var(--space-3)' }}>
        <div className="card">
          <h4>Máximos goleadores</h4>
          {topScorers.length === 0 && <p>Todavía nadie ha marcado.</p>}
          {topScorers.map((p, i) => (
            <p key={p.id}>{i + 1}. #{p.number} {p.displayName} — {p.goals} gol{p.goals === 1 ? '' : 'es'}</p>
          ))}
        </div>
        <div className="card">
          <h4>Máximas recuperadoras</h4>
          {topRecoverers.length === 0 && <p>Todavía nadie ha recuperado.</p>}
          {topRecoverers.map((p, i) => (
            <p key={p.id}>{i + 1}. #{p.number} {p.displayName} — {p.recoveries} recup.</p>
          ))}
        </div>
      </div>
      <div className="stats-table-wrap" style={{ marginTop: 'var(--space-4)' }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador/a</th>
              <th>Jugados</th>
              <th>Convocados</th>
              <th>Goles</th>
              <th>Recup.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.number}</td>
                <td>{p.displayName}{p.isGK ? ' (P)' : ''}</td>
                <td>{p.matchesPlayed}</td>
                <td>{p.matchesCalledUp}</td>
                <td>{p.goals}</td>
                <td>{p.recoveries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Vista de Seguidor/tutor: marcador y goles en directo del equipo aprobado,
// y estadísticas acumuladas de los partidos finalizados. Nunca muestra el
// nombre de un jugador propio con imageAuthorized === false.
export default function FollowerHome({ identity, approvedTeamIds, user, onLogout }) {
  const teams = (identity.allTeams || []).filter((t) => approvedTeamIds.includes(t.id));
  const [teamId, setTeamId] = useState(teams[0]?.id || '');

  useEffect(() => {
    if (!teams.some((t) => t.id === teamId)) setTeamId(teams[0]?.id || '');
  }, [teams, teamId]);

  const activeTeam = teams.find((t) => t.id === teamId) || null;

  return (
    <div className="app-shell" style={teamColorStyle(activeTeam)}>
      <nav className="admin-nav">
        <span className="admin-nav-role">{user.displayName || user.email}</span>
        {teams.length > 1 && (
          <select
            className="admin-role-select"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            title="Equipo seguido"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <button className="btn btn-logout" onClick={onLogout}>SALIR</button>
      </nav>
      <div className="admin-panel">
        {activeTeam ? (
          <>
            <LiveMatchSection clubId={activeTeam.clubId} teamId={activeTeam.id} team={activeTeam} />
            <AccumulatedSection clubId={activeTeam.clubId} teamId={activeTeam.id} />
          </>
        ) : (
          <p className="modal-hint">No se encuentra el equipo aprobado.</p>
        )}
      </div>
    </div>
  );
}
