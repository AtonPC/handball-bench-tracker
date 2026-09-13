import { useState } from 'react';
import MatchHeader from './MatchHeader';
import PlayerRow from './PlayerRow';
import RivalPanel from './RivalPanel';
import SubstitutionModal from './SubstitutionModal';
import RivalGoalModal from './RivalGoalModal';
import DorsalNumberModal from './DorsalNumberModal';
import ShotDetailModal from './ShotDetailModal';
import SaveDetailModal from './SaveDetailModal';
import MatchQuickStats from './MatchQuickStats';
import { useRivalExclusionsLive } from '../hooks/useRivalExclusions';
import { useRivalSevenMeters } from '../hooks/useRivalSevenMeters';
import { teamColorStyle } from '../utils/teamColors';

export default function BenchConsole({ store, onBack, onFinish, team }) {
  const { state, matchId } = store;
  const isRunning = state.clock.status === 'running';
  const [substitution, setSubstitution] = useState(null); // { outPlayerId, forced }
  const [showRivalGoalModal, setShowRivalGoalModal] = useState(false);
  const [showRivalExclusionModal, setShowRivalExclusionModal] = useState(false);
  const [showRivalSevenMeterModal, setShowRivalSevenMeterModal] = useState(false);
  const [shotDetailFor, setShotDetailFor] = useState(null); // { playerId, kind: 'goal'|'miss' }
  const [saveDetailForId, setSaveDetailForId] = useState(null);
  const [showQuickStats, setShowQuickStats] = useState(false);
  const rivalExclusionsLive = useRivalExclusionsLive(matchId);
  const rivalSevenMeters = useRivalSevenMeters(matchId);

  const courtPlayers = state.courtSlots.map((id) => state.players[id]).filter(Boolean);
  const benchPlayers = state.bench.map((id) => state.players[id]).filter(Boolean);
  const disqualifiedPlayers = Object.values(state.players).filter((p) => p.disqualified);

  // Al llegar a la 3ª exclusión, se abre el cambio en el acto — nadie sale
  // de pista sin que se pregunte quién entra.
  function handleExclusionStart(playerId) {
    const willDisqualify = store.playerExclusion(playerId);
    if (willDisqualify) {
      setSubstitution({ outPlayerId: playerId, forced: true });
    }
  }

  function handleSelectIncoming(inPlayerId) {
    if (substitution.forced) {
      store.substituteDisqualified(substitution.outPlayerId, inPlayerId);
    } else {
      store.substitute(substitution.outPlayerId, inPlayerId);
    }
    setSubstitution(null);
  }

  return (
    <div className="bench-console" style={teamColorStyle(team)}>
      <MatchHeader store={store} onBack={onBack} onFinish={onFinish} onOpenQuickStats={() => setShowQuickStats(true)} />

      {!isRunning && (
        <div className="match-not-running-banner">
          {state.clock.status === 'idle'
            ? '⏸ PARTIDO NO INICIADO — pulsa INICIAR 1T arriba para poder anotar'
            : '⏸ PARTIDO EN PAUSA — pulsa REANUDAR arriba para poder seguir anotando'}
        </div>
      )}

      <div className="player-panel">
        {courtPlayers.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            matchRunning={isRunning}
            onOpenSubstitution={() => setSubstitution({ outPlayerId: player.id, forced: false })}
            actions={{
              goalInc: () => setShotDetailFor({ playerId: player.id, kind: 'goal' }),
              goalDec: () => store.playerGoal(player.id, -1),
              shotInc: () => setShotDetailFor({ playerId: player.id, kind: 'miss' }),
              shotDec: () => store.playerShot(player.id, -1),
              recoveryInc: () => store.playerRecovery(player.id, 1),
              recoveryDec: () => store.playerRecovery(player.id, -1),
              saveInc: () => setSaveDetailForId(player.id),
              saveDec: () => store.playerSave(player.id, -1),
              exclusionStart: () => handleExclusionStart(player.id),
              exclusionCancel: () => store.cancelExclusion(player.id),
              sevenMeterInc: () => store.playerSevenMeterCommitted(player.id, 1),
              sevenMeterDec: () => store.playerSevenMeterCommitted(player.id, -1),
            }}
          />
        ))}
      </div>

      <RivalPanel
        rivalGoals={state.score.rival}
        rivalShots={state.rivalShots}
        rivalExclusionsLive={rivalExclusionsLive}
        rivalSevenMeters={rivalSevenMeters}
        onGoal={store.rivalGoal}
        onShot={store.rivalShot}
        onOpenGoalDetail={() => setShowRivalGoalModal(true)}
        onOpenExclusion={() => setShowRivalExclusionModal(true)}
        onCancelExclusion={store.cancelRivalExclusion}
        onOpenSevenMeter={() => setShowRivalSevenMeterModal(true)}
        onCancelSevenMeter={store.cancelRivalSevenMeter}
        matchRunning={isRunning}
      />

      {substitution && (
        <SubstitutionModal
          outPlayer={state.players[substitution.outPlayerId]}
          benchPlayers={benchPlayers}
          disqualifiedPlayers={disqualifiedPlayers.filter((p) => p.id !== substitution.outPlayerId)}
          forced={substitution.forced}
          onSelect={handleSelectIncoming}
          onCancel={() => setSubstitution(null)}
        />
      )}

      {showRivalGoalModal && (
        <RivalGoalModal
          onConfirm={(detail) => {
            store.rivalGoalWithDetail(detail);
            setShowRivalGoalModal(false);
          }}
          onCancel={() => setShowRivalGoalModal(false)}
        />
      )}

      {showRivalExclusionModal && (
        <DorsalNumberModal
          title="Exclusión rival — ¿qué dorsal?"
          confirmLabel="REGISTRAR EXCLUSIÓN"
          onConfirm={(detail) => {
            store.rivalExclusion(detail.number);
            setShowRivalExclusionModal(false);
          }}
          onCancel={() => setShowRivalExclusionModal(false)}
        />
      )}

      {showRivalSevenMeterModal && (
        <DorsalNumberModal
          title="7 metros rival — ¿qué dorsal ha cometido la falta?"
          confirmLabel="REGISTRAR 7 METROS"
          onConfirm={(detail) => {
            store.rivalSevenMeter(detail.number);
            setShowRivalSevenMeterModal(false);
          }}
          onCancel={() => setShowRivalSevenMeterModal(false)}
        />
      )}

      {shotDetailFor && (
        <ShotDetailModal
          playerName={state.players[shotDetailFor.playerId]?.name}
          kind={shotDetailFor.kind}
          onConfirm={(detail) => {
            if (shotDetailFor.kind === 'goal') {
              store.playerGoalWithDetail(shotDetailFor.playerId, detail);
            } else {
              store.playerShotWithDetail(shotDetailFor.playerId, detail);
            }
            setShotDetailFor(null);
          }}
          onCancel={() => setShotDetailFor(null)}
        />
      )}

      {saveDetailForId && (
        <SaveDetailModal
          playerName={state.players[saveDetailForId]?.name}
          onConfirm={(detail) => {
            store.playerSaveWithDetail(saveDetailForId, detail);
            setSaveDetailForId(null);
          }}
          onCancel={() => setSaveDetailForId(null)}
        />
      )}

      {showQuickStats && <MatchQuickStats state={state} onClose={() => setShowQuickStats(false)} />}
    </div>
  );
}
