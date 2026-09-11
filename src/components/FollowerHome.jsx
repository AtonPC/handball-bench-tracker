import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, BarChart3, History } from 'lucide-react';
import { useMatches } from '../hooks/useMatches';
import { useMatchStore } from '../hooks/useMatchStore';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useShotEvents } from '../hooks/useShotEvents';
import { useRecoveryEvents } from '../hooks/useRecoveryEvents';
import { useExclusionEvents } from '../hooks/useExclusionEvents';
import { useRivalExclusions, rivalExclusionCountsByNumber } from '../hooks/useRivalExclusions';
import { usePlayers } from '../hooks/usePlayers';
import { useTeamStats } from '../hooks/useTeamStats';
import { formatClock } from '../utils/time';
import { teamColorStyle } from '../utils/teamColors';
import GoalCelebration from './GoalCelebration';

// Nombre a mostrar de un jugador propio, respetando imageAuthorized: si el
// club no ha autorizado a mostrar su nombre, solo se ve el dorsal. Nunca se
// muestra el tiempo jugado individual — solo quién está en pista.
function ownPlayerLabel(playersById, authorizedById, playerId) {
  const p = playersById[playerId];
  if (!p) return 'Jugador/a';
  if (authorizedById[playerId] === false) return `#${p.number ?? '?'}`;
  return p.name || `#${p.number ?? '?'}`;
}

// Cronología unificada: goles, fallos y recuperaciones propias, y goles y
// exclusiones de ambos equipos, ordenados de más reciente a más antiguo.
// Las exclusiones rivales no traen guardado si fueron la 3ª de ese dorsal
// (a diferencia de las propias) — se calcula aquí, en orden cronológico.
function buildChronology({ ownGoals, ownMisses, ownRecoveries, ownExclusions, rivalGoals, rivalExclusions }) {
  const entries = [];
  for (const g of ownGoals) entries.push({ id: `og-${g.id}`, minute: g.minute, type: 'goal', side: 'own', playerId: g.playerId });
  for (const m of ownMisses) entries.push({ id: `om-${m.id}`, minute: m.minute, type: 'miss', side: 'own', playerId: m.playerId });
  for (const r of ownRecoveries) entries.push({ id: `or-${r.id}`, minute: r.minute, type: 'recovery', side: 'own', playerId: r.playerId });
  for (const e of ownExclusions) entries.push({ id: `oe-${e.id}`, minute: e.minute, type: 'exclusion', side: 'own', playerId: e.playerId, disqualified: e.disqualified });
  for (const g of rivalGoals) entries.push({ id: `rg-${g.id}`, minute: g.minute, type: 'goal', side: 'rival', number: g.number });

  const rivalCounts = {};
  const sortedRivalExclusions = [...rivalExclusions].sort((a, b) => a.minute - b.minute);
  for (const e of sortedRivalExclusions) {
    rivalCounts[e.number] = (rivalCounts[e.number] || 0) + 1;
    entries.push({ id: `re-${e.id}`, minute: e.minute, type: 'exclusion', side: 'rival', number: e.number, disqualified: rivalCounts[e.number] >= 3 });
  }

  return entries.sort((a, b) => b.minute - a.minute);
}

function ChronologyRow({ entry, playersById, authorizedById, compact }) {
  const who = entry.side === 'own'
    ? ownPlayerLabel(playersById, authorizedById, entry.playerId)
    : `Rival #${entry.number}`;
  const label = {
    goal: 'Gol',
    miss: 'Fallo',
    recovery: 'Recuperación',
    exclusion: entry.disqualified ? 'Expulsión' : 'Exclusión',
  }[entry.type];

  if (compact) {
    return (
      <p>
        {entry.minute}' {label}
        {entry.type === 'exclusion' && (
          <span className={`ref-card ref-card--${entry.disqualified ? 'red' : 'amber'}`} style={{ margin: '0 4px' }} />
        )}
        {' '}{who}
      </p>
    );
  }

  return (
    <p>
      Min. {entry.minute}' — {label}
      {entry.type === 'exclusion' && (
        <span className={`ref-card ref-card--${entry.disqualified ? 'red' : 'amber'}`} style={{ margin: '0 4px' }} />
      )}
      {' '}{who}
    </p>
  );
}

// Estadísticas del partido EN CURSO (no las acumuladas de temporada),
// construidas directamente de state.players — sin tiempo jugado.
function MatchStatsTable({ statePlayers, playersById, authorizedById }) {
  const rows = Object.values(statePlayers).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  return (
    <div className="stats-table-wrap">
      <table className="stats-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador/a</th>
            <th>Goles</th>
            <th>Fallos</th>
            <th>Paradas</th>
            <th>Recup.</th>
            <th>Excl.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.number}</td>
              <td>{ownPlayerLabel(playersById, authorizedById, p.id)}{p.isGK ? ' (P)' : ''}</td>
              <td>{p.goals}</td>
              <td>{p.shots}</td>
              <td>{p.saves || 0}</td>
              <td>{p.recoveries}</td>
              <td>{p.exclusionsCount || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveMatchSection({ clubId, teamId, team }) {
  const { matches } = useMatches(clubId, teamId);
  const liveMatch = useMemo(() => matches.find((m) => m.lifecycle === 'live') || null, [matches]);
  const store = useMatchStore(liveMatch?.id || null, !!liveMatch);
  const rivalGoals = useRivalGoals(liveMatch?.id || null);
  const rivalExclusions = useRivalExclusions(liveMatch?.id || null);
  const shotEvents = useShotEvents(liveMatch?.id || null);
  const recoveryEvents = useRecoveryEvents(liveMatch?.id || null);
  const exclusionEvents = useExclusionEvents(liveMatch?.id || null);
  const { players } = usePlayers(clubId, teamId);

  const authorizedById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.imageAuthorized !== false])),
    [players]
  );
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const ownGoals = useMemo(() => shotEvents.filter((e) => e.type === 'goal'), [shotEvents]);
  const ownMisses = useMemo(() => shotEvents.filter((e) => e.type === 'miss'), [shotEvents]);

  const chronology = useMemo(
    () => buildChronology({ ownGoals, ownMisses, ownRecoveries: recoveryEvents, ownExclusions: exclusionEvents, rivalGoals, rivalExclusions }),
    [ownGoals, ownMisses, recoveryEvents, exclusionEvents, rivalGoals, rivalExclusions]
  );

  const [celebrationKey, setCelebrationKey] = useState(null);
  const prevOwnGoals = useRef(ownGoals.length);
  useEffect(() => {
    if (ownGoals.length > prevOwnGoals.current) setCelebrationKey(Date.now());
    prevOwnGoals.current = ownGoals.length;
  }, [ownGoals.length]);

  const [detailView, setDetailView] = useState(null); // null | 'stats' | 'chronology'

  const rivalExclCounts = useMemo(() => rivalExclusionCountsByNumber(rivalExclusions), [rivalExclusions]);
  const rivalExclNumbers = useMemo(() => Object.keys(rivalExclCounts).map(Number).sort((a, b) => a - b), [rivalExclCounts]);

  if (!liveMatch || !store.ready) {
    return <p className="modal-hint">Ahora mismo no hay ningún partido en directo.</p>;
  }

  const { state } = store;
  const leftName = state.isHome ? state.ownTeamName : state.rivalName;
  const rightName = state.isHome ? state.rivalName : state.ownTeamName;
  const leftCrest = state.isHome ? team?.crestUrl : state.rivalCrestUrl;
  const rightCrest = state.isHome ? state.rivalCrestUrl : team?.crestUrl;
  const onCourt = state.courtSlots.map((id) => state.players[id]).filter(Boolean);
  const leftOnCourt = state.isHome ? onCourt : null;
  const rightOnCourt = state.isHome ? null : onCourt;
  const recentEvents = chronology.slice(0, 4);

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

      <div className="follower-scoreboard">
        {state.jornada != null && <p className="follower-jornada">Jornada {state.jornada}</p>}
        <span className="follower-clock">
          {state.clock.period}ª · {state.clock.periodRemainingMs < 0
            ? `+${formatClock(-state.clock.periodRemainingMs)}`
            : formatClock(state.clock.periodRemainingMs)}
        </span>

        <div className="follower-teams-row">
          <span className="follower-team-pill follower-team-pill--own">
            {leftCrest && <img src={leftCrest} alt="" className="team-crest" />}{leftName}
          </span>
          <ArrowLeftRight size={16} className="follower-swap-icon" />
          <span className="follower-team-pill follower-team-pill--rival">
            {rightCrest && <img src={rightCrest} alt="" className="team-crest" />}{rightName}
          </span>
        </div>

        <div className="follower-score-row">
          <span className="follower-score">{state.isHome ? state.score.own : state.score.rival}</span>
          <div className="follower-ticker">
            {recentEvents.length === 0 && <p>Todavía no ha pasado nada.</p>}
            {recentEvents.map((entry) => (
              <ChronologyRow key={entry.id} entry={entry} playersById={playersById} authorizedById={authorizedById} compact />
            ))}
          </div>
          <span className="follower-score">{state.isHome ? state.score.rival : state.score.own}</span>
        </div>

        <div className="follower-oncourt-row">
          <div className="follower-oncourt">
            {(leftOnCourt || []).map((p) => (
              <span key={p.id} className={`follower-oncourt-badge${p.disqualified ? ' follower-oncourt-badge--disqualified' : p.excluded ? ' follower-oncourt-badge--excluded' : ''}`}>
                {p.number}
                {p.excluded && <span className="follower-oncourt-timer">{formatClock(p.exclusionRemainingMs)}</span>}
              </span>
            ))}
            {!leftOnCourt && rivalExclNumbers.map((n) => (
              <span key={n} className={`follower-oncourt-badge${rivalExclCounts[n] >= 3 ? ' follower-oncourt-badge--disqualified' : ' follower-oncourt-badge--excluded'}`}>
                {n}
              </span>
            ))}
          </div>
          <div className="follower-oncourt follower-oncourt--right">
            {(rightOnCourt || []).map((p) => (
              <span key={p.id} className={`follower-oncourt-badge${p.disqualified ? ' follower-oncourt-badge--disqualified' : p.excluded ? ' follower-oncourt-badge--excluded' : ''}`}>
                {p.number}
                {p.excluded && <span className="follower-oncourt-timer">{formatClock(p.exclusionRemainingMs)}</span>}
              </span>
            ))}
            {!rightOnCourt && rivalExclNumbers.map((n) => (
              <span key={n} className={`follower-oncourt-badge${rivalExclCounts[n] >= 3 ? ' follower-oncourt-badge--disqualified' : ' follower-oncourt-badge--excluded'}`}>
                {n}
              </span>
            ))}
          </div>
        </div>

        <div className="follower-actions-row">
          <button
            className={`follower-icon-btn${detailView === 'stats' ? ' follower-icon-btn--active' : ''}`}
            onClick={() => setDetailView(detailView === 'stats' ? null : 'stats')}
            title="Estadísticas del partido"
            aria-label="Estadísticas del partido"
          >
            <BarChart3 size={18} />
          </button>
          <button
            className={`follower-icon-btn${detailView === 'chronology' ? ' follower-icon-btn--active' : ''}`}
            onClick={() => setDetailView(detailView === 'chronology' ? null : 'chronology')}
            title="Cronología completa"
            aria-label="Cronología completa"
          >
            <History size={18} />
          </button>
        </div>
      </div>

      {detailView === 'stats' && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <h4>Estadísticas del partido</h4>
          <MatchStatsTable statePlayers={state.players} playersById={playersById} authorizedById={authorizedById} />
        </div>
      )}

      {detailView === 'chronology' && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <h4>Cronología completa</h4>
          {chronology.length === 0 && <p>Todavía no ha pasado nada.</p>}
          {chronology.map((entry) => (
            <ChronologyRow key={entry.id} entry={entry} playersById={playersById} authorizedById={authorizedById} />
          ))}
        </div>
      )}
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
      attempts: p.goals + p.shots,
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
              <th>Fallos</th>
              <th>Tiros</th>
              <th>Recup.</th>
              <th>Excl.</th>
              <th>Expulsado</th>
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
                <td>{p.shots}</td>
                <td>{p.attempts}</td>
                <td>{p.recoveries}</td>
                <td>{p.exclusionsCount || 0}</td>
                <td>{p.disqualifications ? 'Sí' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Vista de Seguidor/tutor: información del partido en directo (marcador,
// escudos, minuto, alineación en pista y cronología de goles/fallos/
// recuperaciones/exclusiones) y estadísticas acumuladas de los partidos
// finalizados. Nunca muestra el tiempo jugado individual de un jugador
// (para no dar munición a fricciones familia/entrenador), ni el nombre de
// un jugador propio con imageAuthorized === false.
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
