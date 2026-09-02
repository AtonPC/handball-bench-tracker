import { useState } from 'react';
import MatchHeader from './MatchHeader';
import PlayerRow from './PlayerRow';
import RivalPanel from './RivalPanel';
import SubstitutionModal from './SubstitutionModal';

export default function BenchConsole({ store, onBack, onFinish }) {
  const { state } = store;
  const [substitutionForId, setSubstitutionForId] = useState(null);

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
              goalInc: () => store.playerGoal(player.id, 1),
              goalDec: () => store.playerGoal(player.id, -1),
              shotInc: () => store.playerShot(player.id, 1),
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
      />

      {substitutionForId && (
        <SubstitutionModal
          outPlayer={state.players[substitutionForId]}
          benchPlayers={benchPlayers}
          onSelect={handleSelectIncoming}
          onCancel={() => setSubstitutionForId(null)}
        />
      )}
    </div>
  );
}
