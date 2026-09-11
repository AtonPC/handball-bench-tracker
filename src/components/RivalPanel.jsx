import StatStepper from './StatStepper';
import { summarizeRivalExclusions } from '../hooks/useRivalExclusions';
import { formatClock } from '../utils/time';

// Los badges de exclusión rival dejan ver, sin salir de la consola, qué
// dorsales ya no pueden seguir jugando (3 exclusiones = expulsión, misma
// regla que el propio equipo) — importante para que el delegado no deje
// que un rival expulsado siga en pista por despiste. Mientras una
// exclusión está en marcha se ve la cuenta atrás, igual que en el propio
// equipo. Tocar un badge permite anularla si se marcó por error.
export default function RivalPanel({ rivalGoals, rivalShots, rivalExclusionsLive, onGoal, onShot, onOpenGoalDetail, onOpenExclusion, onCancelExclusion }) {
  const summary = summarizeRivalExclusions(rivalExclusionsLive);

  function handleBadgeClick(entry) {
    const ok = confirm(`¿Anular la última exclusión del dorsal #${entry.number}? (marcada por error)`);
    if (ok) onCancelExclusion(entry.lastEventId);
  }

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
      {summary.length > 0 && (
        <div className="rival-excl-badges">
          {summary.map((entry) => (
            <button
              key={entry.number}
              type="button"
              className={`rival-excl-badge${entry.disqualified ? ' rival-excl-badge--disqualified' : entry.activeRemainingMs > 0 ? ' rival-excl-badge--active' : ''}`}
              onClick={() => handleBadgeClick(entry)}
              title="Tocar para anular la última exclusión de este dorsal"
            >
              #{entry.number} · {entry.disqualified
                ? 'EXPULSADO'
                : entry.activeRemainingMs > 0
                  ? formatClock(entry.activeRemainingMs)
                  : `${entry.count}/3`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
