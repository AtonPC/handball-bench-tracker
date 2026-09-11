import StatStepper from './StatStepper';
import { rivalExclusionCountsByNumber } from '../hooks/useRivalExclusions';

// Los badges de exclusión rival dejan ver, sin salir de la consola, qué
// dorsales ya no pueden seguir jugando (3 exclusiones = expulsión, misma
// regla que el propio equipo) — importante para que el delegado no deje
// que un rival expulsado siga en pista por despiste.
export default function RivalPanel({ rivalGoals, rivalShots, rivalExclusions, onGoal, onShot, onOpenGoalDetail, onOpenExclusion }) {
  const counts = rivalExclusionCountsByNumber(rivalExclusions);
  const numbers = Object.keys(counts).map(Number).sort((a, b) => a - b);

  return (
    <div className="rival-panel">
      <span className="rival-panel-label">Equipo rival</span>
      <div className="stepper-group">
        <span className="stepper-caption">Goles</span>
        <StatStepper icon="GOL" label="Goles rival" count={rivalGoals} onInc={onOpenGoalDetail} onDec={() => onGoal(-1)} />
      </div>
      <div className="stepper-group">
        <span className="stepper-caption">Tiros</span>
        <StatStepper icon="TIRO" label="Tiros rival" count={rivalShots} onInc={() => onShot(1)} onDec={() => onShot(-1)} />
      </div>
      <button className="btn btn-timeout" onClick={onOpenExclusion}>EXCLUSIÓN RIVAL</button>
      {numbers.length > 0 && (
        <div className="rival-excl-badges">
          {numbers.map((n) => (
            <span key={n} className={`rival-excl-badge${counts[n] >= 3 ? ' rival-excl-badge--disqualified' : ''}`}>
              #{n} · {Math.min(counts[n], 3)}/3{counts[n] >= 3 ? ' EXPULSADO' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
