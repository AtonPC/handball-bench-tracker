import { useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, GitCompare, History, Target } from 'lucide-react';
import { useMatchStore } from '../hooks/useMatchStore';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useRivalMisses } from '../hooks/useRivalMisses';
import { useRivalExclusions } from '../hooks/useRivalExclusions';
import { useRivalSevenMeters } from '../hooks/useRivalSevenMeters';
import { useShotEvents } from '../hooks/useShotEvents';
import { useSaveEvents } from '../hooks/useSaveEvents';
import { useRecoveryEvents } from '../hooks/useRecoveryEvents';
import { useExclusionEvents } from '../hooks/useExclusionEvents';
import { useYellowCardEvents } from '../hooks/useYellowCardEvents';
import { useRivalYellowCards } from '../hooks/useRivalYellowCards';
import { usePlayers } from '../hooks/usePlayers';
import { buildChronology } from '../utils/followerHelpers';
import ChronologyRow from './ChronologyRow';
import MatchStatsTable from './FollowerMatchStatsTable';
import ActionStatsView from './ActionStatsView';
import TabletSummary from './TabletSummary';
import { useTeamActionEvents } from '../hooks/useTeamActionEvents';
import TeamTotalsCard from './TeamTotalsCard';
import { isProTier } from '../utils/followerTier';

// Detalle de UN partido concreto (en directo o ya finalizado — la consola
// solo se usa para partidos en directo desde el marcador, pero un Seguidor
// también puede querer revisar uno ya jugado). useMatchStore funciona
// igual en ambos casos: un partido finalizado deja de tener el reloj en
// marcha, así que sus estadísticas quedan congeladas en su valor final.
export default function FollowerMatchDetail({ clubId, teamId, team, tier, matchId, onBack }) {
  const pro = isProTier(tier);
  const store = useMatchStore(matchId, !!matchId);
  const rivalGoals = useRivalGoals(matchId);
  const rivalMisses = useRivalMisses(matchId);
  const rivalExclusions = useRivalExclusions(matchId);
  const rivalSevenMeters = useRivalSevenMeters(matchId);
  const shotEvents = useShotEvents(matchId);
  const saveEvents = useSaveEvents(matchId);
  const recoveryEvents = useRecoveryEvents(matchId);
  const exclusionEvents = useExclusionEvents(matchId);
  const yellowCardEvents = useYellowCardEvents(matchId);
  const rivalYellowCards = useRivalYellowCards(matchId);
  const teamActions = useTeamActionEvents(matchId);
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

  // Jugadores del PARTIDO, no de la plantilla — igual que en el partido en
  // directo, es lo que espera ActionStatsView para filtrar por playerId.
  const actionPlayers = useMemo(
    () => Object.values(store.state?.players || {}).sort((a, b) => a.number - b.number),
    [store.state]
  );

  const [detailView, setDetailView] = useState('summary'); // 'summary' | 'actionStats' | 'stats' | 'chronology'

  return (
    <div>
      <button type="button" className="btn btn-timeout" onClick={onBack} style={{ marginBottom: 'var(--space-3)' }}>
        <ArrowLeft size={16} /> Partidos
      </button>

      {!store.ready ? (
        <p className="modal-hint">Cargando…</p>
      ) : (
        <>
          <div className="stats-summary">
            {store.state.jornada != null && (
              <div className="stats-summary-item">
                <span className="stats-summary-label">Jornada</span>
                <span className="stats-summary-value">{store.state.jornada}</span>
              </div>
            )}
            <div className="stats-summary-item stats-summary-item--score">
              <span className="stats-summary-label">{store.state.isHome ? store.state.ownTeamName : store.state.rivalName} vs {store.state.isHome ? store.state.rivalName : store.state.ownTeamName}</span>
              <span className="stats-summary-value">{store.state.score.own} - {store.state.score.rival}</span>
            </div>
          </div>

          <div className="follower-actions-row" style={{ marginTop: 'var(--space-3)' }}>
            <button
              className={`follower-icon-btn${detailView === 'summary' ? ' follower-icon-btn--active' : ''}`}
              onClick={() => setDetailView('summary')}
              title="Resumen del partido"
              aria-label="Resumen del partido"
            >
              <GitCompare size={18} />
            </button>
            <button
              className={`follower-icon-btn${detailView === 'actionStats' ? ' follower-icon-btn--active' : ''}`}
              onClick={() => setDetailView('actionStats')}
              title="Estadísticas de Acciones"
              aria-label="Estadísticas de Acciones"
            >
              <Target size={18} />
            </button>
            <button
              className={`follower-icon-btn${detailView === 'stats' ? ' follower-icon-btn--active' : ''}`}
              onClick={() => setDetailView('stats')}
              title="Estadísticas del partido"
              aria-label="Estadísticas del partido"
            >
              <BarChart3 size={18} />
            </button>
            <button
              className={`follower-icon-btn${detailView === 'chronology' ? ' follower-icon-btn--active' : ''}`}
              onClick={() => setDetailView('chronology')}
              title="Cronología completa"
              aria-label="Cronología completa"
            >
              <History size={18} />
            </button>
          </div>

          {detailView === 'summary' && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <h3 className="stats-section-title">Resumen del partido</h3>
              <TabletSummary
                statePlayers={store.state.players}
                shotEvents={shotEvents}
                rivalGoals={rivalGoals}
                rivalMisses={rivalMisses}
                rivalExclusions={rivalExclusions}
                rivalYellowCards={rivalYellowCards}
                teamActions={teamActions}
                possessions={store.state.possessions}
                ownTeamName={store.state.ownTeamName}
                rivalName={store.state.rivalName}
              />
            </div>
          )}

          {detailView === 'stats' && (
            pro ? (
              <div className="card" style={{ marginTop: 'var(--space-4)' }}>
                <h4>Estadísticas del partido</h4>
                <MatchStatsTable
                  statePlayers={store.state.players}
                  playersById={playersById}
                  authorizedById={authorizedById}
                  rivalGoalsConceded={store.state.score.rival}
                  matchElapsedMs={store.state.clock.elapsedMs}
                />
              </div>
            ) : (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <TeamTotalsCard
                  title="Estadísticas del equipo en el partido"
                  rows={Object.values(store.state.players)}
                  rivalGoalsConceded={store.state.score.rival}
                />
              </div>
            )
          )}

          {detailView === 'chronology' && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="chrono-team-banners">
                <div className="chrono-team-banner chrono-team-banner--own">{store.state.ownTeamName}</div>
                <div className="chrono-team-banner chrono-team-banner--rival">{store.state.rivalName}</div>
              </div>
              {chronology.length === 0 ? (
                <p className="modal-hint">Todavía no ha pasado nada.</p>
              ) : (
                <div className="chrono-rows">
                  {chronology.map((entry) => (
                    <ChronologyRow key={entry.id} entry={entry} playersById={playersById} authorizedById={authorizedById} anonymize={!pro} />
                  ))}
                </div>
              )}
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
                ownTeamName={store.state.ownTeamName}
                rivalName={store.state.rivalName}
                ownPrimaryColor={team?.primaryColor}
                ownSecondaryColor={team?.secondaryColor}
                showPlayerFilter={pro}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
