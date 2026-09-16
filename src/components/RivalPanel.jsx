import { RectangleVertical, Timer } from 'lucide-react';
import StatStepper from './StatStepper';
import { summarizeRivalExclusions } from '../hooks/useRivalExclusions';
import { summarizeRivalSevenMeters } from '../hooks/useRivalSevenMeters';
import { summarizeRivalYellowCards } from '../hooks/useRivalYellowCards';
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
  rivalName, rivalGoals, rivalMissesCount, rivalExclusionsLive, rivalSevenMeters, rivalYellowCards,
  onGoal, onOpenGoalDetail, onOpenMissDetail, onOpenExclusion, onCancelExclusion,
  onOpenSevenMeter, onCancelSevenMeter, onOpenYellowCard, onCancelYellowCard, matchRunning,
}) {
  const exclusionSummary = summarizeRivalExclusions(rivalExclusionsLive);
  const sevenMeterSummary = summarizeRivalSevenMeters(rivalSevenMeters);
  const yellowCardSummary = summarizeRivalYellowCards(rivalYellowCards);

  function handleExclusionBadgeClick(entry) {
    const ok = confirm(`¿Anular la última exclusión del dorsal #${entry.number}? (marcada por error)`);
    if (ok) onCancelExclusion(entry.lastEventId);
  }

  function handleSevenMeterBadgeClick(entry) {
    const ok = confirm(`¿Anular el último 7 metros del dorsal #${entry.number}? (marcado por error)`);
    if (ok) onCancelSevenMeter(entry.lastEventId);
  }

  function handleYellowCardBadgeClick(entry) {
    const ok = confirm(`¿Anular la tarjeta amarilla del dorsal #${entry.number}? (marcada por error)`);
    if (ok) onCancelYellowCard(entry.lastEventId);
  }

  return (
    <div className="player-row player-row--rival rival-panel">
      <div className="rival-panel-header">
        <span className="player-number player-number--rival">R</span>
        <span className="rival-panel-label">{rivalName || 'Equipo rival'}</span>
      </div>
      <div className="stepper-group">
        <span className="stepper-caption">Goles</span>
        <StatStepper icon="GOL" label="Goles rival" count={rivalGoals} onInc={onOpenGoalDetail} onDec={() => onGoal(-1)} disabled={!matchRunning} />
      </div>
      <div className="stepper-group">
        <span className="stepper-caption">Fallos</span>
        <StatStepper icon="FALLO" label="Fallo rival" count={rivalMissesCount} onInc={onOpenMissDetail} disabled={!matchRunning} />
      </div>
      <div className="stepper-group">
        <span className="stepper-caption">Exclusión</span>
        <button className="excl-btn" onClick={onOpenExclusion} disabled={!matchRunning} aria-label="Exclusión rival">
          <Timer size={14} /> 2'
        </button>
      </div>
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
                ? 'ROJA'
                : entry.activeRemainingMs > 0
                  ? formatClock(entry.activeRemainingMs)
                  : `${entry.count}/3`}
            </button>
          ))}
        </div>
      )}
      <div className="stepper-group">
        <span className="stepper-caption">7 metros</span>
        <StatStepper compact icon="7M" label="7 metros rival" count={rivalSevenMeters.length} onInc={onOpenSevenMeter} disabled={!matchRunning} />
      </div>
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
      <div className="stepper-group">
        <span className="stepper-caption">Amarilla</span>
        <button className="excl-btn" onClick={onOpenYellowCard} disabled={!matchRunning} aria-label="Tarjeta amarilla rival">
          <RectangleVertical size={18} fill="var(--card-yellow)" stroke="var(--card-yellow)" />
        </button>
      </div>
      {yellowCardSummary.length > 0 && (
        <div className="rival-excl-badges">
          {yellowCardSummary.map((entry) => (
            <button
              key={entry.number}
              type="button"
              className="rival-excl-badge rival-excl-badge--yellow"
              onClick={() => handleYellowCardBadgeClick(entry)}
              title="Tocar para anular la tarjeta amarilla de este dorsal"
            >
              #{entry.number} · AM
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
