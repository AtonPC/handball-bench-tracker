import { useEffect, useMemo, useRef, useState } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useMatchStore } from '../hooks/useMatchStore';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useShotEvents } from '../hooks/useShotEvents';
import { usePlayers } from '../hooks/usePlayers';
import { formatClock } from '../utils/time';
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

// Vista de Seguidor/tutor: marcador y goles en directo del equipo aprobado,
// y (en una fase posterior) estadísticas acumuladas. Nunca muestra el
// nombre de un jugador propio con imageAuthorized === false.
export default function FollowerHome({ identity, approvedTeamIds, user, onLogout }) {
  const teams = (identity.allTeams || []).filter((t) => approvedTeamIds.includes(t.id));
  const [teamId, setTeamId] = useState(teams[0]?.id || '');

  useEffect(() => {
    if (!teams.some((t) => t.id === teamId)) setTeamId(teams[0]?.id || '');
  }, [teams, teamId]);

  const activeTeam = teams.find((t) => t.id === teamId) || null;

  return (
    <div className="app-shell">
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
          <LiveMatchSection clubId={activeTeam.clubId} teamId={activeTeam.id} team={activeTeam} />
        ) : (
          <p className="modal-hint">No se encuentra el equipo aprobado.</p>
        )}
      </div>
    </div>
  );
}
