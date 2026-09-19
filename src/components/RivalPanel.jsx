import { RectangleVertical, Timer } from 'lucide-react';
import StatStepper from './StatStepper';
import { summarizeRivalExclusions } from '../hooks/useRivalExclusions';
import { summarizeRivalYellowCards } from '../hooks/useRivalYellowCards';
import { formatClock } from '../utils/time';

// Los badges de exclusión rival dejan ver, sin salir de la consola, qué
// dorsales ya no pueden seguir jugando (3 exclusiones = expulsión, misma
// regla que el propio equipo) — importante para que el delegado no deje
// que un rival expulsado siga en pista por despiste. Mientras una
// exclusión está en marcha se ve la cuenta atrás, igual que en el propio
// equipo. Tocar un badge permite anularla si se marcó por error.
// El 7 metros rival NO tiene entrada aquí: solo se registra cuando
// NOSOTROS marcamos un gol de 7m (ver BenchConsole), como estadística del
// rival derivada del gol propio.
export default function RivalPanel({
  rivalName, rivalGoals, rivalMissesCount, rivalSavedCount, rivalExclusionsLive, rivalYellowCards,
  onGoal, onOpenGoalDetail, onOpenMissDetail, onMissDec, onOpenExclusion, onCancelExclusion,
  onOpenYellowCard, onCancelYellowCard, matchRunning,
}) {
  const exclusionSummary = summarizeRivalExclusions(rivalExclusionsLive);
  const yellowCardSummary = summarizeRivalYellowCards(rivalYellowCards);

  function handleExclusionBadgeClick(entry) {
    const ok = confirm(`¿Anular la última exclusión del dorsal #${entry.number}? (marcada por error)`);
    if (ok) onCancelExclusion(entry.lastEventId);
  }

  function handleYellowCardBadgeClick(entry) {
    const ok = confirm(`¿Anular la tarjeta amarilla del dorsal #${entry.number}? (marcada por error)`);
    if (ok) onCancelYellowCard(entry.lastEventId);
  }

  return (
    <div className="player-row player-row--rival">
      {/* Mismo esquema exacto que un jugador (.player-row-top +
          .player-row-stats), pedido explícito del usuario: dorsal, nombre,
          2 minutos y amarilla arriba — gol y fallo abajo. Sin "cambio" (no
          aplica al rival) ni reloj de tiempo en pista. El 7 metros no
          tiene botón propio aquí: se pide (opcional) justo después de
          marcar nosotros un gol de 7m. */}
      <div className="player-row-top">
        <span className="player-number player-number--rival">R</span>
        <div className="player-name-block">
          <span className="player-name">
            <span className="player-name-text">{rivalName || 'Equipo rival'}</span>
          </span>
        </div>
        <button className="excl-btn" onClick={onOpenExclusion} disabled={!matchRunning} aria-label="Exclusión rival">
          <Timer size={14} /> 2'
        </button>
        <button className="excl-btn" onClick={onOpenYellowCard} disabled={!matchRunning} aria-label="Tarjeta amarilla rival">
          <RectangleVertical size={18} fill="var(--card-yellow)" stroke="var(--card-yellow)" />
        </button>
      </div>

      <div className="player-row-stats">
        <StatStepper icon="GOL" label="Goles rival" count={rivalGoals} onInc={onOpenGoalDetail} onDec={() => onGoal(-1)} disabled={!matchRunning} />
        <StatStepper icon="FALLO" label="Fallo rival" count={rivalMissesCount} onInc={onOpenMissDetail} onDec={onMissDec} disabled={!matchRunning} />
      </div>
      {/* Un fallo rival puede haberlo parado nuestro portero (cuenta también
          como su parada) o haberse ido fuera: se desglosa para que el
          número de arriba no confunda. */}
      {rivalMissesCount > 0 && (
        <p className="rival-miss-breakdown">
          Fallos: {rivalSavedCount} parado{rivalSavedCount === 1 ? '' : 's'} · {rivalMissesCount - rivalSavedCount} fuera / sin zona
        </p>
      )}

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
