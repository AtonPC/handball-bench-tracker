import { ArrowLeft, Pause, Play, RotateCcw, Square, Undo2 } from 'lucide-react';
import { periodClockDisplay } from '../utils/time';
import { teamInitials } from '../utils/teamColors';
import TimeoutsMenu from './TimeoutsMenu';
import { useClockControls } from '../hooks/useClockControls';

// Cabecera de la consola en directo (2026-09-16, mockup "Consola
// Luminosa" aprobado por el usuario): reloj+parte arriba, escudos+nombres+
// marcador debajo, todo centrado, y los controles del partido (pausar/1T/
// 2T, tiempos muertos, finalizar) siempre visibles — por eso NO lleva
// scroll propio ni depende de position:sticky, es .bench-console quien
// tiene la altura acotada (height:100svh + overflow:hidden) para que solo
// el contenido de cada pestaña scrollee, nunca esta cabecera.
// La lógica de los controles del reloj vive en hooks/useClockControls.js
// (la comparte con la columna derecha de la consola de tablet).
export default function MatchHeader({ store, team, onBack, onFinish, onNeedLineup }) {
  const { clock, score, timeouts, ownTeamName, rivalName, rivalCrestUrl, isHome } = store.state;
  const leftIsOwn = isHome;
  const leftName = leftIsOwn ? ownTeamName : rivalName;
  const rightName = leftIsOwn ? rivalName : ownTeamName;
  const leftCrest = leftIsOwn ? team?.crestUrl : rivalCrestUrl;
  const rightCrest = leftIsOwn ? rivalCrestUrl : team?.crestUrl;
  const leftScore = leftIsOwn ? score.own : score.rival;
  const rightScore = leftIsOwn ? score.rival : score.own;

  const ctl = useClockControls(store, { onNeedLineup, onFinish });
  const { periodCount, isLastPeriod, shortLabel, longLabel, handleUndo, handleEndPeriod, handleFinish } = ctl;

  // Controles del reloj en un espacio mínimo (2026-09-19): el periodo
  // abreviado (1T / 2C…) y dos iconos (ver useClockControls para qué hace cada uno).
  function renderClockControls() {
    const PlayIcon = ctl.running ? Pause : Play;
    return (
      <div className="clock-ctl">
        <span className={`period-chip${ctl.ended ? ' period-chip--next' : ''}`} title={longLabel(ctl.ended ? clock.period + 1 : clock.period)}>
          {ctl.ended ? `→${shortLabel(clock.period + 1)}` : shortLabel(clock.period)}
        </span>
        <button type="button" className={`clock-icon-btn clock-icon-btn--${ctl.playTone}`} onClick={ctl.onPlay} aria-label={ctl.playLabel} title={ctl.playLabel}>
          <PlayIcon size={18} fill="currentColor" />
        </button>
        {ctl.ended ? (
          <button type="button" className="clock-icon-btn clock-icon-btn--resume" onClick={store.togglePause} aria-label={`Reanudar ${shortLabel(clock.period)}`} title={`Reanudar ${shortLabel(clock.period)} (si se terminó por error)`}>
            <RotateCcw size={17} />
          </button>
        ) : (
          <button type="button" className="clock-icon-btn clock-icon-btn--stop" onClick={isLastPeriod ? handleFinish : handleEndPeriod} disabled={ctl.idle} aria-label={ctl.stopLabel} title={ctl.stopLabel}>
            <Square size={16} fill="currentColor" />
          </button>
        )}
      </div>
    );
  }

  const display = periodClockDisplay(clock.periodRemainingMs, clock.periodDurationMs);

  return (
    <header className="match-header">
      <div className="header-bar">
        <button className="icon-btn-sm header-bar-left" onClick={onBack}>
          <ArrowLeft size={14} /> PARTIDOS
        </button>
        <span className="period-pill">{longLabel(clock.period)}</span>
        <button className="icon-btn-sm header-bar-right" onClick={handleUndo} disabled={!store.canUndo}>
          <Undo2 size={14} /> DESHACER
        </button>
      </div>

      <div className="score-block">
        <div className="clock-row">
          <span className="clock-time">
            {display.main}
            {display.extra && (
              <span className="clock-extra" title="Tiempo añadido">
                <span className="clock-extra-label">Extra<br />time</span>
                <span className="clock-extra-value">{display.extra}</span>
              </span>
            )}
          </span>
        </div>
        <div className="teams-score-row">
          <div className="team-block">
            <div className={`crest${leftIsOwn ? ' crest--own' : ' crest--rival'}`}>
              {leftCrest ? <img src={leftCrest} alt="" /> : teamInitials(leftName)}
            </div>
            <span className="team-name-sm">{leftName}</span>
          </div>
          <div className="score-nums">
            <span className={leftIsOwn ? 'score-own' : 'score-rival'}>{leftScore}</span>
            <span className="score-sep">–</span>
            <span className={leftIsOwn ? 'score-rival' : 'score-own'}>{rightScore}</span>
          </div>
          <div className="team-block">
            <div className={`crest${leftIsOwn ? ' crest--rival' : ' crest--own'}`}>
              {rightCrest ? <img src={rightCrest} alt="" /> : teamInitials(rightName)}
            </div>
            <span className="team-name-sm">{rightName}</span>
          </div>
        </div>
      </div>

      <div className="controls-row">
        {renderClockControls()}
        <TimeoutsMenu
          ownName={ownTeamName}
          rivalName={rivalName}
          isHome={isHome}
          timeouts={timeouts}
          period={clock.period}
          periodCount={periodCount}
          onRequest={store.timeout}
        />
        <button className="ctrl-btn ctrl-btn--finish" onClick={handleFinish}>FINALIZAR</button>
      </div>
    </header>
  );
}
