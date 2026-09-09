import { formatClock } from '../utils/time';
import StatStepper from './StatStepper';
import ExclusionControl from './ExclusionControl';

function exclusionRowClass(player) {
  if (player.disqualified) return ' player-row--disqualified';
  if ((player.exclusionsCount || 0) >= 2) return ' player-row--excl-2';
  if ((player.exclusionsCount || 0) >= 1) return ' player-row--excl-1';
  return '';
}

export default function PlayerRow({ player, onOpenSubstitution, actions }) {
  const disabled = !!player.disqualified;
  const dots = '●'.repeat(Math.min(player.exclusionsCount || 0, 2));

  return (
    <div className={`player-row${player.excluded ? ' player-row--excluded' : ''}${exclusionRowClass(player)}`}>
      <span className="player-number">{player.number}</span>

      <div className="player-name-block">
        <span className="player-name">
          {player.name}{player.isGK ? ' (P)' : ''}{dots && <span className="excl-dots"> {dots}</span>}
        </span>
        <span className="player-clock">{formatClock(player.accumulatedMs)}</span>
      </div>

      <StatStepper icon="GOL" label="Goles" count={player.goals} onInc={actions.goalInc} onDec={actions.goalDec} disabled={disabled} />
      <StatStepper icon="FALLO" label="Lanzamientos fallados" count={player.shots} onInc={actions.shotInc} onDec={actions.shotDec} disabled={disabled} />
      <StatStepper icon="RECUP" label="Recuperaciones" count={player.recoveries} onInc={actions.recoveryInc} onDec={actions.recoveryDec} disabled={disabled} />
      <StatStepper icon="PÉRDIDA" label="Pérdidas" count={player.losses} onInc={actions.lossInc} onDec={actions.lossDec} disabled={disabled} />

      <ExclusionControl player={player} onStart={actions.exclusionStart} onCancel={actions.exclusionCancel} />

      <button className="btn-change-icon" onClick={onOpenSubstitution} aria-label="Cambio">
        🔁
      </button>
    </div>
  );
}
