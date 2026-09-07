import { useState } from 'react';
import MatchHeader from './MatchHeader';
import PlayerRow from './PlayerRow';
import RivalPanel from './RivalPanel';
import SubstitutionModal from './SubstitutionModal';
import RivalGoalModal from './RivalGoalModal';
import ShotDetailModal from './ShotDetailModal';

export default function BenchConsole({ store, onBack, onFinish }) {
  const { state } = store;
  const [substitutionForId, setSubstitutionForId] = useState(null);
  const [showRivalGoalModal, setShowRivalGoalModal] = useState(false);
  const [shotDetailFor, setShotDetailFor] = useState(null); // { playerId, kind: 'goal'|'miss' }

  const courtPlayers = state.courtSlots.map((id) => state.players[id]).filter(Boolean);
  const benchPlayers = state.bench.map((id) => state.players[id]).filter(Boolean);

  function handleSelectIncoming(inPlayerId) {
    store.substitute(substitutionForId, inPlayerId);
    setSubstitutionForId(null);
  }

  return (
    <div className="bench-console">
      <MatchHeader store={store} onBack={onBack} onFinish={onFinish} />

      <div className="player-panel">
        {courtPlayers.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            onOpenSubstitution={() => setSubstitutionForId(player.id)}
            actions={{
              goalInc: () => setShotDetailFor({ playerId: player.id, kind: 'goal' }),
              goalDec: () => store.playerGoal(player.id, -1),
              shotInc: () => setShotDetailFor({ playerId: player.id, kind: 'miss' }),
              shotDec: () => store.playerShot(player.id, -1),
              recoveryInc: () => store.playerRecovery(player.id, 1),
              recoveryDec: () => store.playerRecovery(player.id, -1),
              lossInc: () => store.playerLoss(player.id, 1),
              lossDec: () => store.playerLoss(player.id, -1),
              exclusionStart: () => store.playerExclusion(player.id),
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

      {substitutionForId && (
        <SubstitutionModal
          outPlayer={state.players[substitutionForId]}
          benchPlayers={benchPlayers}
          onSelect={handleSelectIncoming}
          onCancel={() => setSubstitutionForId(null)}
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
    </div>
  );
}
