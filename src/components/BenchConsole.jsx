import { useState } from 'react';
import MatchHeader from './MatchHeader';
import PlayerRow from './PlayerRow';
import RivalPanel from './RivalPanel';
import SubstitutionModal from './SubstitutionModal';
import RivalGoalModal from './RivalGoalModal';
import ShotDetailModal from './ShotDetailModal';
import MatchQuickStats from './MatchQuickStats';

export default function BenchConsole({ store, onBack, onFinish }) {
  const { state } = store;
  const [substitution, setSubstitution] = useState(null); // { outPlayerId, forced }
  const [showRivalGoalModal, setShowRivalGoalModal] = useState(false);
  const [shotDetailFor, setShotDetailFor] = useState(null); // { playerId, kind: 'goal'|'miss' }
  const [showQuickStats, setShowQuickStats] = useState(false);

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
    <div className="bench-console">
      <MatchHeader store={store} onBack={onBack} onFinish={onFinish} onOpenQuickStats={() => setShowQuickStats(true)} />

      <div className="player-panel">
        {courtPlayers.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            onOpenSubstitution={() => setSubstitution({ outPlayerId: player.id, forced: false })}
            actions={{
              goalInc: () => setShotDetailFor({ playerId: player.id, kind: 'goal' }),
              goalDec: () => store.playerGoal(player.id, -1),
              shotInc: () => setShotDetailFor({ playerId: player.id, kind: 'miss' }),
              shotDec: () => store.playerShot(player.id, -1),
              recoveryInc: () => store.playerRecovery(player.id, 1),
              recoveryDec: () => store.playerRecovery(player.id, -1),
              saveInc: () => store.playerSave(player.id, 1),
              saveDec: () => store.playerSave(player.id, -1),
              exclusionStart: () => handleExclusionStart(player.id),
              exclusionCancel: () => store.cancelExclusion(player.id),
            }}
          />
        ))}
      </div>

      <RivalPanel
        rivalGoals={state.score.rival}
        rivalShots={state.rivalShots}
        onGoal={store.rivalGoal}
        onShot={store.rivalShot}
        onOpenGoalDetail={() => setShowRivalGoalModal(true)}
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

      {showQuickStats && <MatchQuickStats state={state} onClose={() => setShowQuickStats(false)} />}
    </div>
  );
}
