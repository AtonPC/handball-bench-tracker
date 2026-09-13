import StatStepper from './StatStepper';
import { summarizeRivalExclusions } from '../hooks/useRivalExclusions';
import { summarizeRivalSevenMeters } from '../hooks/useRivalSevenMeters';
import { formatClock } from '../utils/time';

// Los badges de exclusión rival dejan ver, sin salir de la consola, qué
// dorsales ya no pueden seguir jugando (3 exclusiones = expulsión, misma
// regla que el propio equipo) — importante para que el delegado no deje
// que un rival expulsado siga en pista por despiste. Mientras una
// exclusión está en marcha se ve la cuenta atrás, igual que en el propio
// equipo. Tocar un badge permite anularla si se marcó por error. Los
// badges de 7 metros son iguales pero más simples (sin cuenta atrás ni
// expulsión, un 7m no es una sanción temporal).
export default function RivalPanel({
  rivalGoals, rivalShots, rivalExclusionsLive, rivalSevenMeters,
  onGoal, onShot, onOpenGoalDetail, onOpenExclusion, onCancelExclusion,
  onOpenSevenMeter, onCancelSevenMeter, matchRunning,
}) {
  const exclusionSummary = summarizeRivalExclusions(rivalExclusionsLive);
  const sevenMeterSummary = summarizeRivalSevenMeters(rivalSevenMeters);

  function handleExclusionBadgeClick(entry) {
    const ok = confirm(`¿Anular la última exclusión del dorsal #${entry.number}? (marcada por error)`);
    if (ok) onCancelExclusion(entry.lastEventId);
  }

  function handleSevenMeterBadgeClick(entry) {
    const ok = confirm(`¿Anular el último 7 metros del dorsal #${entry.number}? (marcado por error)`);
    if (ok) onCancelSevenMeter(entry.lastEventId);
  }

  return (
    <div className="rival-panel">
      <span className="rival-panel-label">Equipo rival</span>
      <div className="stepper-group">
        <span className="stepper-caption">Goles</span>
        <StatStepper icon="GOL" label="Goles rival" count={rivalGoals} onInc={onOpenGoalDetail} onDec={() => onGoal(-1)} disabled={!matchRunning} />
      </div>
      <div className="stepper-group">
        <span className="stepper-caption">Tiros</span>
        <StatStepper icon="TIRO" label="Tiros rival" count={rivalShots} onInc={() => onShot(1)} onDec={() => onShot(-1)} disabled={!matchRunning} />
      </div>
      <button className="btn btn-timeout" onClick={onOpenExclusion} disabled={!matchRunning}>EXCLUSIÓN RIVAL</button>
      {exclusionSummary.length > 0 && (
        <div className="rival-excl-badges">
          {exclusionSummary.map((entry) => (
            <button
              key={entry.number}
              type="button"
              className={`rival-excl-badge${entry.disqualified ? ' rival-excl-badge--disqualified' : entry.activeRemainingMs > 0 ? ' rival-excl-badge--active' : ''}`}
              onClick={() => handleExclusionBadgeClick(entry)}
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
      <button className="btn btn-timeout" onClick={onOpenSevenMeter} disabled={!matchRunning}>7 METROS RIVAL</button>
      {sevenMeterSummary.length > 0 && (
        <div className="rival-excl-badges">
          {sevenMeterSummary.map((entry) => (
            <button
              key={entry.number}
              type="button"
              className="rival-excl-badge"
              onClick={() => handleSevenMeterBadgeClick(entry)}
              title="Tocar para anular el último 7 metros de este dorsal"
            >
              #{entry.number} · {entry.count}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
