import { formatClock } from '../utils/time';
import StatStepper from './StatStepper';
import ExclusionControl from './ExclusionControl';

export default function PlayerRow({ player, onOpenSubstitution, actions }) {
  return (
    <div className={`player-row${player.excluded ? ' player-row--excluded' : ''}`}>
      <span className="player-number">{player.number}</span>

      <div className="player-name-block">
        <span className="player-name">{player.name}{player.isGK ? ' (P)' : ''}</span>
        <span className="player-clock">{formatClock(player.accumulatedMs)}</span>
      </div>

      <StatStepper icon="GOL" label="Goles" count={player.goals} onInc={actions.goalInc} onDec={actions.goalDec} />
      <StatStepper icon="FALLO" label="Lanzamientos fallados" count={player.shots} onInc={actions.shotInc} onDec={actions.shotDec} />
      <StatStepper icon="RECUP" label="Recuperaciones" count={player.recoveries} onInc={actions.recoveryInc} onDec={actions.recoveryDec} />
      <StatStepper icon="PARADA" label="Pérdidas" count={player.losses} onInc={actions.lossInc} onDec={actions.lossDec} />

      <ExclusionControl player={player} onStart={actions.exclusionStart} onCancel={actions.exclusionCancel} />

      <button className="btn-change-icon" onClick={onOpenSubstitution} aria-label="Cambio">
        🔁
      </button>
    </div>
  );
}
