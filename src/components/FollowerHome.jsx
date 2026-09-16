import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, BarChart3, CalendarDays, GitCompare, History, Radio, Shield, Target, Users } from 'lucide-react';
import { useMatches } from '../hooks/useMatches';
import { useMatchStore } from '../hooks/useMatchStore';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useRivalMisses } from '../hooks/useRivalMisses';
import { useShotEvents } from '../hooks/useShotEvents';
import { useSaveEvents } from '../hooks/useSaveEvents';
import { useRecoveryEvents } from '../hooks/useRecoveryEvents';
import { useExclusionEvents } from '../hooks/useExclusionEvents';
import { useRivalExclusionsLive, summarizeRivalExclusions } from '../hooks/useRivalExclusions';
import { useRivalSevenMeters } from '../hooks/useRivalSevenMeters';
import { useYellowCardEvents } from '../hooks/useYellowCardEvents';
import { useRivalYellowCards } from '../hooks/useRivalYellowCards';
import { usePlayers } from '../hooks/usePlayers';
import { useTeamStats } from '../hooks/useTeamStats';
import { useFollowerSession } from '../hooks/useFollowerSession';
import { formatClock } from '../utils/time';
import { teamColorStyle } from '../utils/teamColors';
import GoalCelebration from './GoalCelebration';
import PlayerStatsTable from './PlayerStatsTable';
import AppSidebar from './AppSidebar';
import FollowerRoster from './FollowerRoster';
import FollowerMatches from './FollowerMatches';
import FollowerClub from './FollowerClub';
import ChronologyRow from './ChronologyRow';
import MatchStatsTable from './FollowerMatchStatsTable';
import ActionStatsView from './ActionStatsView';
import MatchSummaryView from './MatchSummaryView';
import { rosterDisplayName, buildChronology } from '../utils/followerHelpers';

function LiveMatchSection({ clubId, teamId, team, logView }) {
  const { matches } = useMatches(clubId, teamId);
  const liveMatch = useMemo(() => matches.find((m) => m.lifecycle === 'live') || null, [matches]);
  const store = useMatchStore(liveMatch?.id || null, !!liveMatch);
  const rivalGoals = useRivalGoals(liveMatch?.id || null);
  const rivalMisses = useRivalMisses(liveMatch?.id || null);
  const rivalExclusions = useRivalExclusionsLive(liveMatch?.id || null);
  const rivalSevenMeters = useRivalSevenMeters(liveMatch?.id || null);
  const rivalYellowCards = useRivalYellowCards(liveMatch?.id || null);
  const shotEvents = useShotEvents(liveMatch?.id || null);
  const saveEvents = useSaveEvents(liveMatch?.id || null);
  const recoveryEvents = useRecoveryEvents(liveMatch?.id || null);
  const exclusionEvents = useExclusionEvents(liveMatch?.id || null);
  const yellowCardEvents = useYellowCardEvents(liveMatch?.id || null);
  const { players } = usePlayers(clubId, teamId);

  const authorizedById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.imageAuthorized !== false])),
    [players]
  );
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const ownGoals = useMemo(() => shotEvents.filter((e) => e.type === 'goal'), [shotEvents]);
  const ownMisses = useMemo(() => shotEvents.filter((e) => e.type === 'miss'), [shotEvents]);

  const chronology = useMemo(
    () => buildChronology({
      ownGoals, ownMisses, ownSaves: saveEvents, ownRecoveries: recoveryEvents, ownExclusions: exclusionEvents, ownYellowCards: yellowCardEvents,
      rivalGoals, rivalMisses, rivalExclusions, rivalSevenMeters, rivalYellowCards,
    }),
    [ownGoals, ownMisses, saveEvents, recoveryEvents, exclusionEvents, yellowCardEvents, rivalGoals, rivalMisses, rivalExclusions, rivalSevenMeters, rivalYellowCards]
  );

  // Jugadores del PARTIDO (con id/nombre/dorsal ya resueltos por
  // useMatchStore), no de la plantilla — es lo que espera ActionStatsView
  // para filtrar shotEvents/saveEvents por playerId.
  const actionPlayers = useMemo(
    () => Object.values(store.state.players).sort((a, b) => a.number - b.number),
    [store.state.players]
  );

  const [celebrationKey, setCelebrationKey] = useState(null);
  const prevOwnGoals = useRef(ownGoals.length);
  useEffect(() => {
    if (ownGoals.length > prevOwnGoals.current) setCelebrationKey(Date.now());
    prevOwnGoals.current = ownGoals.length;
  }, [ownGoals.length]);

  // Aviso de gol rival, completamente aparte del propio — nunca comparten
  // datos ni disparador, para que un gol rival no pueda salir jamás con el
  // escudo/color propios ni al revés.
  const [rivalCelebrationKey, setRivalCelebrationKey] = useState(null);
  const prevRivalGoals = useRef(rivalGoals.length);
  useEffect(() => {
    if (rivalGoals.length > prevRivalGoals.current) setRivalCelebrationKey(Date.now());
    prevRivalGoals.current = rivalGoals.length;
  }, [rivalGoals.length]);

  // Por defecto se ve directamente el Resumen del partido (no la estadística
  // acumulada de temporada, que va aparte y más abajo) — antes había que
  // saber que existía el botón para encontrarla.
  const [detailView, setDetailView] = useState('summary'); // null | 'summary' | 'actionStats' | 'stats' | 'chronology'

  // El más reciente por createdAt, no el último del array: shotEvents/
  // rivalGoals se piden ordenados por "minute", y dos goles en el mismo
  // minuto pueden llegar en cualquier orden entre sí (el desempate de
  // Firestore no es el de inserción) — eso hacía que la celebración
  // mostrara a veces al goleador anterior en vez del que acaba de marcar.
  const lastOwnGoal = ownGoals.length
    ? ownGoals.reduce((a, b) => (b.createdAt > a.createdAt ? b : a))
    : null;
  const celebrationRosterPlayer = lastOwnGoal ? playersById[lastOwnGoal.playerId] : null;
  const celebrationPlayer = celebrationRosterPlayer
    ? { ...celebrationRosterPlayer, name: rosterDisplayName(celebrationRosterPlayer) }
    : null;
  const celebrationAuthorized = lastOwnGoal ? authorizedById[lastOwnGoal.playerId] : true;
  const lastRivalGoal = rivalGoals.length
    ? rivalGoals.reduce((a, b) => (b.createdAt > a.createdAt ? b : a))
    : null;

  const rivalExclSummary = useMemo(() => summarizeRivalExclusions(rivalExclusions), [rivalExclusions]);

  const liveReady = !!liveMatch && store.ready;
  useEffect(() => {
    if (liveReady) logView('live');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveReady, liveMatch?.id]);

  if (!liveMatch || !store.ready) {
    return <p className="modal-hint">Ahora mismo no hay ningún partido en directo.</p>;
  }

  const { state } = store;
  const leftName = state.isHome ? state.ownTeamName : state.rivalName;
  const rightName = state.isHome ? state.rivalName : state.ownTeamName;
  const leftCrest = state.isHome ? team?.crestUrl : state.rivalCrestUrl;
  const rightCrest = state.isHome ? state.rivalCrestUrl : team?.crestUrl;
  const leftScore = state.isHome ? state.score.own : state.score.rival;
  const rightScore = state.isHome ? state.score.rival : state.score.own;
  const onCourt = state.courtSlots.map((id) => state.players[id]).filter(Boolean);
  // "En pista" son quienes están jugando de verdad ahora mismo — un excluido
  // no está físicamente en la cancha esos 2 minutos, aunque el modelo lo
  // siga contando como parte de los 7. Su estado va aparte, junto con las
  // expulsiones (que si son permanentes ya no vuelven a "en pista").
  const ownOnCourtActive = onCourt.filter((p) => !p.excluded && !p.disqualified);
  // Incluye también a quien ya cumplió una exclusión y volvió a pista (no
  // solo a quien está excluido ahora mismo): así se ve de un vistazo quién
  // va acumulando exclusiones de cara a una posible expulsión, no solo
  // quién está sentado en este preciso momento.
  const ownPenalized = Object.values(state.players).filter((p) => (p.exclusionsCount || 0) > 0 || p.disqualified);
  const isOwnLeft = state.isHome;
  const recentEvents = chronology.slice(0, 4);

  return (
    <div>
      {celebrationKey && (
        <GoalCelebration
          key={celebrationKey}
          crestUrl={team?.crestUrl}
          goalPhrase={team?.goalPhrase}
          player={celebrationPlayer}
          playerAuthorized={celebrationAuthorized}
          minute={lastOwnGoal?.minute}
          leftName={leftName}
          rightName={rightName}
          leftScore={leftScore}
          rightScore={rightScore}
          onDone={() => setCelebrationKey(null)}
        />
      )}

      {rivalCelebrationKey && (
        <GoalCelebration
          key={rivalCelebrationKey}
          variant="rival"
          crestUrl={state.rivalCrestUrl}
          player={lastRivalGoal ? { number: lastRivalGoal.number } : null}
          minute={lastRivalGoal?.minute}
          leftName={leftName}
          rightName={rightName}
          leftScore={leftScore}
          rightScore={rightScore}
          onDone={() => setRivalCelebrationKey(null)}
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
          <div className={`follower-oncourt-col${isOwnLeft ? '' : ' follower-oncourt-col--right'}`}>
            <span className="follower-oncourt-label">Equipo en pista</span>
            <div className="follower-oncourt">
              {ownOnCourtActive.map((p) => (
                <span key={p.id} className={`follower-oncourt-badge${p.isGK ? ' follower-oncourt-badge--gk' : ''}`}>
                  {p.number}
                </span>
              ))}
              {ownOnCourtActive.length === 0 && <span className="follower-oncourt-empty">—</span>}
            </div>
          </div>
          <div className={`follower-oncourt-col${isOwnLeft ? ' follower-oncourt-col--right' : ''}`} />
        </div>

        <div className="follower-oncourt-row">
          <div className={`follower-oncourt-col${isOwnLeft ? '' : ' follower-oncourt-col--right'}`}>
            <span className="follower-oncourt-label">Jugadores con exclusión o roja</span>
            <div className={`follower-oncourt${isOwnLeft ? '' : ' follower-oncourt--right'}`}>
              {ownPenalized.map((p) => {
                const state3 = p.disqualified ? 'disqualified' : p.excluded ? 'active' : 'past';
                return (
                  <span
                    key={p.id}
                    className={`follower-oncourt-badge follower-oncourt-badge--${state3 === 'disqualified' ? 'disqualified' : state3 === 'active' ? 'excluded' : 'excluded-past'}`}
                  >
                    {p.number}
                    <span className="follower-oncourt-sub">
                      {state3 === 'disqualified' ? 'ROJA' : state3 === 'active' ? formatClock(p.exclusionRemainingMs) : `${p.exclusionsCount}/3`}
                    </span>
                  </span>
                );
              })}
              {ownPenalized.length === 0 && <span className="follower-oncourt-empty">Ninguno</span>}
            </div>
          </div>
          <div className={`follower-oncourt-col${isOwnLeft ? ' follower-oncourt-col--right' : ''}`}>
            <span className="follower-oncourt-label">Jugadores con exclusión o roja</span>
            <div className={`follower-oncourt${isOwnLeft ? ' follower-oncourt--right' : ''}`}>
              {rivalExclSummary.map((entry) => {
                const cls = entry.disqualified
                  ? 'follower-oncourt-badge--disqualified'
                  : entry.activeRemainingMs > 0
                    ? 'follower-oncourt-badge--excluded'
                    : 'follower-oncourt-badge--excluded-past';
                return (
                  <span key={entry.number} className={`follower-oncourt-badge ${cls}`}>
                    {entry.number}
                    <span className="follower-oncourt-sub">
                      {entry.disqualified ? 'ROJA' : entry.activeRemainingMs > 0 ? formatClock(entry.activeRemainingMs) : `${entry.count}/3`}
                    </span>
                  </span>
                );
              })}
              {rivalExclSummary.length === 0 && <span className="follower-oncourt-empty">Ninguno</span>}
            </div>
          </div>
        </div>

        <div className="follower-legend">
          <span><span className="follower-legend-dot" /> En pista</span>
          <span><span className="follower-legend-dot follower-legend-dot--gk" /> Portero</span>
          <span><span className="follower-legend-dot follower-legend-dot--excluded" /> Excluido ahora (cuenta atrás)</span>
          <span><span className="follower-legend-dot follower-legend-dot--excluded-past" /> Ya cumplió una exclusión (nº de exclusiones)</span>
          <span><span className="follower-legend-dot follower-legend-dot--disqualified" /> Roja</span>
        </div>

        <div className="follower-actions-row">
          <button
            className={`follower-icon-btn${detailView === 'summary' ? ' follower-icon-btn--active' : ''}`}
            onClick={() => {
              const next = detailView === 'summary' ? null : 'summary';
              setDetailView(next);
              if (next) logView('match-summary');
            }}
            title="Resumen del partido"
            aria-label="Resumen del partido"
          >
            <GitCompare size={18} />
          </button>
          <button
            className={`follower-icon-btn${detailView === 'actionStats' ? ' follower-icon-btn--active' : ''}`}
            onClick={() => {
              const next = detailView === 'actionStats' ? null : 'actionStats';
              setDetailView(next);
              if (next) logView('action-stats');
            }}
            title="Estadísticas de Acciones"
            aria-label="Estadísticas de Acciones"
          >
            <Target size={18} />
          </button>
          <button
            className={`follower-icon-btn${detailView === 'stats' ? ' follower-icon-btn--active' : ''}`}
            onClick={() => {
              const next = detailView === 'stats' ? null : 'stats';
              setDetailView(next);
              if (next) logView('match-stats');
            }}
            title="Estadísticas del partido"
            aria-label="Estadísticas del partido"
          >
            <BarChart3 size={18} />
          </button>
          <button
            className={`follower-icon-btn${detailView === 'chronology' ? ' follower-icon-btn--active' : ''}`}
            onClick={() => {
              const next = detailView === 'chronology' ? null : 'chronology';
              setDetailView(next);
              if (next) logView('chronology');
            }}
            title="Cronología completa"
            aria-label="Cronología completa"
          >
            <History size={18} />
          </button>
        </div>
      </div>

      {detailView === 'summary' && (
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
      )}

      {detailView === 'actionStats' && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <h3 className="stats-section-title">Estadísticas de Acciones</h3>
          <ActionStatsView
            shotEvents={shotEvents}
            saveEvents={saveEvents}
            rivalGoals={rivalGoals}
            rivalMisses={rivalMisses}
            players={actionPlayers}
            ownTeamName={state.ownTeamName}
            rivalName={state.rivalName}
            ownPrimaryColor={team?.primaryColor}
            ownSecondaryColor={team?.secondaryColor}
          />
        </div>
      )}

      {detailView === 'stats' && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <h4>Estadísticas del partido</h4>
          <MatchStatsTable
            statePlayers={state.players}
            playersById={playersById}
            authorizedById={authorizedById}
            rivalGoalsConceded={state.score.rival}
            matchElapsedMs={state.clock.elapsedMs}
          />
        </div>
      )}

      {detailView === 'chronology' && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <div className="chrono-team-banners">
            <div className="chrono-team-banner chrono-team-banner--own">{state.ownTeamName}</div>
            <div className="chrono-team-banner chrono-team-banner--rival">{state.rivalName}</div>
          </div>
          {chronology.length === 0 ? (
            <p className="modal-hint">Todavía no ha pasado nada.</p>
          ) : (
            <div className="chrono-rows">
              {chronology.map((entry) => (
                <ChronologyRow key={entry.id} entry={entry} playersById={playersById} authorizedById={authorizedById} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccumulatedSection({ clubId, teamId }) {
  const { matches } = useMatches(clubId, teamId);
  const finishedMatches = useMemo(() => matches.filter((m) => m.lifecycle === 'finished'), [matches]);
  const finishedIds = useMemo(() => finishedMatches.map((m) => m.id), [finishedMatches]);
  const { totals, teamTotalMs, teamRivalGoalsConceded, loading } = useTeamStats(finishedIds);
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
      shotsFaced: (p.saves || 0) + teamRivalGoalsConceded,
      disqualified: p.disqualifications || 0,
      name: authorizedById[id] === false ? `Jugador/a #${p.number ?? '?'}` : p.name,
    })),
    [totals, authorizedById, teamRivalGoalsConceded]
  );

  const topScorers = useMemo(
    () => [...rows].filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5),
    [rows]
  );
  const topRecoverers = useMemo(
    () => [...rows].filter((p) => p.recoveries > 0).sort((a, b) => b.recoveries - a.recoveries).slice(0, 5),
    [rows]
  );

  return (
    <div style={{ marginTop: 'var(--space-5)' }}>
      <h3 className="stats-section-title">Estadísticas de la temporada</h3>
      {loading && <p className="modal-hint">Calculando…</p>}
      {!loading && finishedMatches.length === 0 && (
        <p className="modal-hint">Todavía no hay partidos finalizados.</p>
      )}
      {!loading && finishedMatches.length > 0 && (
        <>
      <p className="modal-hint">
        Histórico de {finishedMatches.length} partido{finishedMatches.length === 1 ? '' : 's'} finalizado{finishedMatches.length === 1 ? '' : 's'} — no del partido en directo
      </p>
      <div className="card-grid" style={{ marginTop: 'var(--space-3)' }}>
        <div className="card">
          <h4>Máximos goleadores</h4>
          {topScorers.length === 0 && <p>Todavía nadie ha marcado.</p>}
          {topScorers.map((p, i) => (
            <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.goals} gol{p.goals === 1 ? '' : 'es'}</p>
          ))}
        </div>
        <div className="card">
          <h4>Máximas recuperadoras</h4>
          {topRecoverers.length === 0 && <p>Todavía nadie ha recuperado.</p>}
          {topRecoverers.map((p, i) => (
            <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.recoveries} recup.</p>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 'var(--space-4)' }}>
        <PlayerStatsTable rows={rows} minutesTotalMs={teamTotalMs} showMatches />
      </div>
        </>
      )}
    </div>
  );
}

// Con un partido en directo, las estadísticas de temporada quedan ocultas
// por defecto — lo que se pidió explícitamente es que se vea SOLO lo del
// partido, no lo acumulado del equipo — pero siguen a un clic si hace
// falta consultarlas. Sin partido en directo no tiene sentido esconderlas:
// son lo único que hay que mostrar en ese momento.
function FollowerLiveTab({ clubId, teamId, team, logView }) {
  const { matches } = useMatches(clubId, teamId);
  const hasLiveMatch = matches.some((m) => m.lifecycle === 'live');
  const [showSeason, setShowSeason] = useState(!hasLiveMatch);

  useEffect(() => {
    setShowSeason(!hasLiveMatch);
  }, [hasLiveMatch]);

  function toggleSeason() {
    setShowSeason((v) => {
      if (!v) logView('season');
      return !v;
    });
  }

  return (
    <>
      <LiveMatchSection clubId={clubId} teamId={teamId} team={team} logView={logView} />
      {hasLiveMatch && (
        <button
          type="button"
          className="btn btn-timeout"
          style={{ marginTop: 'var(--space-3)' }}
          onClick={toggleSeason}
        >
          {showSeason ? 'Ocultar' : 'Ver'} estadísticas de temporada
        </button>
      )}
      {showSeason && <AccumulatedSection clubId={clubId} teamId={teamId} />}
    </>
  );
}

const FOLLOWER_TABS = [
  { key: 'live', label: 'Partido en Directo', icon: Radio },
  { key: 'roster', label: 'Plantilla', icon: Users },
  { key: 'matches', label: 'Partidos', icon: CalendarDays },
  { key: 'club', label: 'Club', icon: Shield },
];

// Vista de Seguidor/tutor: mismo patrón de menú lateral que el staff, pero
// con solo cuatro secciones de solo lectura — partido en directo (marcador,
// escudos, minuto, alineación en pista y cronología), plantilla, partidos
// (pasados y programados, con estadísticas de los finalizados) y club.
// Nunca muestra el tiempo jugado individual de un jugador (para no dar
// munición a fricciones familia/entrenador), ni el nombre de un jugador
// propio con imageAuthorized === false.
export default function FollowerHome({ identity, approvedTeamIds, user, onLogout, previewMode }) {
  const teams = (identity.allTeams || []).filter((t) => approvedTeamIds.includes(t.id));
  const [teamId, setTeamId] = useState(teams[0]?.id || '');
  const [view, setView] = useState('live');

  useEffect(() => {
    if (!teams.some((t) => t.id === teamId)) setTeamId(teams[0]?.id || '');
  }, [teams, teamId]);

  const activeTeam = teams.find((t) => t.id === teamId) || null;

  // No se registra sesión en previewMode: es el staff comprobando qué ven
  // las familias, no una visita real de un Seguidor.
  const { logView } = useFollowerSession({
    enabled: !previewMode,
    personUid: user.uid,
    personDisplayName: user.displayName,
    personEmail: user.email,
    teamId: activeTeam?.id,
    teamName: activeTeam?.name,
    clubId: activeTeam?.clubId,
  });

  if (!activeTeam) {
    return (
      <div className="app-shell">
        <nav className="admin-nav">
          <span className="admin-nav-role">{previewMode ? 'Vista de Seguidor (previsualización)' : (user.displayName || user.email)}</span>
          <button className="btn btn-logout" onClick={onLogout}>{previewMode ? '← VOLVER' : 'SALIR'}</button>
        </nav>
        <div className="admin-panel">
          <p className="modal-hint">No se encuentra el equipo aprobado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout" style={teamColorStyle(activeTeam)}>
      <AppSidebar
        roleLabel={previewMode ? 'Vista de Seguidor (previsualización)' : (user.displayName || user.email)}
        clubOptions={[]}
        teamsInActiveClub={!previewMode && teams.length > 1 ? teams : []}
        activeTeamId={teamId}
        onTeamChange={setTeamId}
        tabs={FOLLOWER_TABS}
        view={view}
        onViewChange={setView}
        onLogout={onLogout}
        logoutLabel={previewMode ? 'VOLVER' : 'SALIR'}
      />
      <main className="app-main">
        <div className="admin-panel">
          {view === 'live' && (
            <FollowerLiveTab clubId={activeTeam.clubId} teamId={activeTeam.id} team={activeTeam} logView={logView} />
          )}
          {view === 'roster' && <FollowerRoster clubId={activeTeam.clubId} teamId={activeTeam.id} />}
          {view === 'matches' && <FollowerMatches clubId={activeTeam.clubId} teamId={activeTeam.id} team={activeTeam} />}
          {view === 'club' && <FollowerClub clubId={activeTeam.clubId} teamId={activeTeam.id} team={activeTeam} />}
        </div>
      </main>
    </div>
  );
}
