import { ArrowLeft, Undo2 } from 'lucide-react';
import { formatClock } from '../utils/time';
import { teamInitials } from '../utils/teamColors';
import StatStepper from './StatStepper';
import { periodLongLabel, periodShortLabel } from '../utils/periods';

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

  const { periodCount, periodEnded } = clock;
  const isLastPeriod = clock.period >= periodCount;
  const shortLabel = (p) => periodShortLabel(p, periodCount);
  const longLabel = (p) => periodLongLabel(p, periodCount);

  async function handleUndo() {
    const result = await store.undo();
    if (result && !result.ok && result.reason === 'clock') {
      alert('No se puede deshacer esta acción porque el reloj ha cambiado desde entonces (pausa, reanudación u otro periodo): los minutos de los jugadores saldrían mal. Corrígela a mano — por ejemplo, con el cambio inverso.');
    }
  }

  // "Pausar" es solo para paradas del árbitro durante el juego (una lesión,
  // lo que sea) — nunca termina el periodo por sí sola. Terminar el periodo
  // es una acción aparte, explícita y con aviso, para no confundir una cosa
  // con la otra. En el último periodo no hay "FIN": se termina con
  // FINALIZAR, que cierra el partido.
  function handleEndPeriod() {
    const ok = confirm(`¿Terminar el periodo «${longLabel(clock.period)}»? El cronómetro se detiene; podréis iniciar «${longLabel(clock.period + 1)}» cuando estéis listos.`);
    if (ok) store.endPeriod();
  }

  function handleFinish() {
    const message = isLastPeriod
      ? `¿Terminar «${longLabel(clock.period)}» y dar el partido por finalizado? Esto es definitivo y no se puede deshacer.`
      : '¿Finalizar el partido ahora, sin jugar el resto de periodos? Esto da el partido por terminado de forma definitiva y no se puede deshacer.';
    if (confirm(message)) onFinish();
  }

  function renderClockButton() {
    if (clock.status === 'idle') {
      return <button className="ctrl-btn ctrl-btn--start" onClick={store.startPeriod1}>INICIAR {shortLabel(1)}</button>;
    }
    if (clock.status === 'running') {
      if (!isLastPeriod) {
        return (
          <div className="clock-btn-group">
            <button className="ctrl-btn ctrl-btn--pause" onClick={store.togglePause}>PAUSAR</button>
            <button className="ctrl-btn" onClick={handleEndPeriod}>FIN {shortLabel(clock.period)}</button>
          </div>
        );
      }
      return <button className="ctrl-btn ctrl-btn--pause" onClick={store.togglePause}>PAUSAR</button>;
    }
    // paused: solo tras "FIN del periodo" se ofrece empezar el siguiente;
    // una pausa normal solo deja reanudar.
    if (periodEnded && !isLastPeriod) {
      return (
        <div className="clock-btn-group">
          <button className="ctrl-btn" onClick={store.togglePause}>REANUDAR</button>
          <button className="ctrl-btn ctrl-btn--start" onClick={store.startNextPeriod}>INICIAR {shortLabel(clock.period + 1)}</button>
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
        <button className="icon-btn-sm" onClick={handleUndo} disabled={!store.canUndo}>
          <Undo2 size={14} /> DESHACER
        </button>
      </div>

      <div className="score-block">
        <div className="clock-row">
          <span className="period-pill">{longLabel(clock.period)}</span>
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
