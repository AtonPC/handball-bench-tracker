import { Repeat } from 'lucide-react';
import { formatClock } from '../utils/time';
import StatStepper from './StatStepper';
import ExclusionControl from './ExclusionControl';

function exclusionRowClass(player) {
  if (player.disqualified) return ' player-row--disqualified';
  if ((player.exclusionsCount || 0) >= 2) return ' player-row--excl-2';
  if ((player.exclusionsCount || 0) >= 1) return ' player-row--excl-1';
  return '';
}

export default function PlayerRow({ player, onOpenSubstitution, actions, matchRunning }) {
  // Con el reloj parado no se puede anotar nada, cambio incluido — el
  // usuario confirmó explícitamente que prefiere bloquearlo todo antes que
  // dejar el cambio como única excepción.
  const disabled = !!player.disqualified || !matchRunning;
  const dots = '●'.repeat(Math.min(player.exclusionsCount || 0, 2));

  return (
    <div className={`player-row${player.excluded ? ' player-row--excluded' : ''}${exclusionRowClass(player)}`}>
      <div className="player-row-top">
        <span className="player-number">{player.number}</span>

        <div className="player-name-block">
          <span className="player-name">
            {player.name}
            {player.isGK && <span className="gk-badge">P</span>}
            {dots && <span className="excl-dots"> {dots}</span>}
          </span>
          <span className="player-clock">{formatClock(player.accumulatedMs)}</span>
        </div>

        <ExclusionControl player={player} onStart={actions.exclusionStart} onCancel={actions.exclusionCancel} disabled={!matchRunning} />

        <button className="btn-change-icon" onClick={onOpenSubstitution} disabled={!matchRunning} aria-label="Cambio">
          <Repeat size={20} />
        </button>
      </div>

      <div className="player-row-stats">
        {player.isGK ? (
          <>
            <StatStepper icon="PARADA" label="Paradas" count={player.saves || 0} onInc={actions.saveInc} onDec={actions.saveDec} disabled={disabled} />
            <StatStepper icon="GOL" label="Goles" count={player.goals} onInc={actions.goalInc} onDec={actions.goalDec} disabled={disabled} />
            <StatStepper icon="FALLO" label="Lanzamientos fallados" count={player.shots} onInc={actions.shotInc} onDec={actions.shotDec} disabled={disabled} />
          </>
        ) : (
          <>
            <StatStepper icon="GOL" label="Goles" count={player.goals} onInc={actions.goalInc} onDec={actions.goalDec} disabled={disabled} />
            <StatStepper icon="FALLO" label="Lanzamientos fallados" count={player.shots} onInc={actions.shotInc} onDec={actions.shotDec} disabled={disabled} />
            <StatStepper icon="RECUP" label="Recuperaciones" count={player.recoveries} onInc={actions.recoveryInc} onDec={actions.recoveryDec} disabled={disabled} />
          </>
        )}
        <StatStepper icon="7M" label="7 metros cometidos" count={player.sevenMetersCommitted || 0} onInc={actions.sevenMeterInc} onDec={actions.sevenMeterDec} disabled={disabled} />
      </div>
    </div>
  );
}
