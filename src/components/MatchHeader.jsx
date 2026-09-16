import { ArrowLeft, Undo2 } from 'lucide-react';
import { formatClock } from '../utils/time';
import { teamInitials } from '../utils/teamColors';
import StatStepper from './StatStepper';

// Cabecera de la consola en directo (2026-09-16, mockup "Consola
// Luminosa" aprobado por el usuario): reloj+parte arriba, escudos+nombres+
// marcador debajo, todo centrado, y los controles del partido (pausar/1T/
// 2T, tiempos muertos, finalizar) siempre visibles — por eso NO lleva
// scroll propio ni depende de position:sticky, es .bench-console quien
// tiene la altura acotada (height:100svh + overflow:hidden) para que solo
// el contenido de cada pestaña scrollee, nunca esta cabecera.
export default function MatchHeader({ store, team, onBack, onFinish }) {
  const { clock, score, timeouts, ownTeamName, rivalName, rivalCrestUrl, isHome } = store.state;
  const leftIsOwn = isHome;
  const leftName = leftIsOwn ? ownTeamName : rivalName;
  const rightName = leftIsOwn ? rivalName : ownTeamName;
  const leftCrest = leftIsOwn ? team?.crestUrl : rivalCrestUrl;
  const rightCrest = leftIsOwn ? rivalCrestUrl : team?.crestUrl;
  const leftScore = leftIsOwn ? score.own : score.rival;
  const rightScore = leftIsOwn ? score.rival : score.own;

  // "Pausar" es solo para paradas del árbitro durante el juego (una lesión,
  // lo que sea) — nunca termina la parte por sí sola. Terminar la parte es
  // una acción aparte, explícita y con aviso, para no confundir una cosa
  // con la otra.
  function handleEndPeriod1() {
    const ok = confirm('¿Dar por finalizado el primer tiempo? El cronómetro se detiene; podréis iniciar el segundo tiempo cuando estéis listos.');
    if (ok) store.togglePause();
  }

  function handleFinish() {
    const message = clock.period === 1
      ? '¿Finalizar el partido ahora, sin jugar el segundo tiempo? Esto da el partido por terminado de forma definitiva y no se puede deshacer.'
      : '¿Dar por finalizado el segundo tiempo? Esto da el partido por terminado de forma definitiva y no se puede deshacer.';
    if (confirm(message)) onFinish();
  }

  function renderClockButton() {
    if (clock.status === 'idle') {
      return <button className="ctrl-btn ctrl-btn--start" onClick={store.startPeriod1}>INICIAR 1T</button>;
    }
    if (clock.status === 'running') {
      if (clock.period === 1) {
        return (
          <div className="clock-btn-group">
            <button className="ctrl-btn ctrl-btn--pause" onClick={store.togglePause}>PAUSAR</button>
            <button className="ctrl-btn" onClick={handleEndPeriod1}>FIN 1T</button>
          </div>
        );
      }
      return <button className="ctrl-btn ctrl-btn--pause" onClick={store.togglePause}>PAUSAR</button>;
    }
    // paused
    if (clock.period === 1) {
      return (
        <div className="clock-btn-group">
          <button className="ctrl-btn" onClick={store.togglePause}>REANUDAR</button>
          <button className="ctrl-btn ctrl-btn--start" onClick={store.startPeriod2}>INICIAR 2T</button>
        </div>
      );
    }
    return <button className="ctrl-btn" onClick={store.togglePause}>REANUDAR</button>;
  }

  return (
    <header className="match-header">
      <div className="header-bar">
        <button className="icon-btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> PARTIDOS
        </button>
        <button className="icon-btn-sm" onClick={store.undo} disabled={!store.canUndo}>
          <Undo2 size={14} /> DESHACER
        </button>
      </div>

      <div className="score-block">
        <div className="clock-row">
          <span className="period-pill">{clock.period}ª parte</span>
          <span className={`clock-time${clock.periodRemainingMs < 0 ? ' clock-time--over' : ''}`}>
            {clock.periodRemainingMs < 0 ? `+${formatClock(-clock.periodRemainingMs)}` : formatClock(clock.periodRemainingMs)}
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
        {renderClockButton()}
        <div className="tm-group">
          <span className="tm-group-label">T.M. propio</span>
          <StatStepper compact icon={`P.${clock.period}`} label="Tiempo muerto propio" count={timeouts.own[clock.period] || 0} onInc={() => store.timeout('own', 1)} onDec={() => store.timeout('own', -1)} />
        </div>
        <div className="tm-group">
          <span className="tm-group-label">T.M. rival</span>
          <StatStepper compact icon={`P.${clock.period}`} label="Tiempo muerto rival" count={timeouts.rival[clock.period] || 0} onInc={() => store.timeout('rival', 1)} onDec={() => store.timeout('rival', -1)} />
        </div>
        <button className="ctrl-btn ctrl-btn--finish" onClick={handleFinish}>FINALIZAR</button>
      </div>
    </header>
  );
}
