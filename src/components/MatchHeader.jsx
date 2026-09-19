import { ArrowLeft, Pause, Play, RotateCcw, Square, Undo2 } from 'lucide-react';
import { periodClockDisplay } from '../utils/time';
import { teamInitials } from '../utils/teamColors';
import TimeoutsMenu from './TimeoutsMenu';
import { periodLongLabel, periodShortLabel } from '../utils/periods';

// Cabecera de la consola en directo (2026-09-16, mockup "Consola
// Luminosa" aprobado por el usuario): reloj+parte arriba, escudos+nombres+
// marcador debajo, todo centrado, y los controles del partido (pausar/1T/
// 2T, tiempos muertos, finalizar) siempre visibles — por eso NO lleva
// scroll propio ni depende de position:sticky, es .bench-console quien
// tiene la altura acotada (height:100svh + overflow:hidden) para que solo
// el contenido de cada pestaña scrollee, nunca esta cabecera.
export default function MatchHeader({ store, team, onBack, onFinish, onNeedLineup }) {
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

  // Iniciar el siguiente periodo. Con las reglas de Alevín puestas hay que PASAR
  // por el equipo titular antes: si aún no se ha elegido, ▶ abre el diálogo en
  // vez de iniciar (y el store tampoco deja iniciar sin él). Lo que NO bloquea
  // es lo que se elija ahí: repetir jugadores solo avisa, y los cambios no
  // tienen ninguna restricción.
  function handleStartNext() {
    const { alevinRules, lineups } = store.state;
    if (alevinRules && !lineups[clock.period + 1]) {
      onNeedLineup();
      return;
    }
    store.startNextPeriod();
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

  // Controles del reloj en un espacio mínimo (2026-09-19): el periodo
  // abreviado (1T / 2C…) y dos iconos.
  //  - ▶ / ⏸: iniciar el primer periodo, pausar, reanudar — y, tras terminar un
  //    periodo, iniciar el siguiente (entonces la etiqueta enseña "→2C").
  //  - ■ (Stop): terminar el periodo, exactamente lo que hacía "FIN 1T/1C",
  //    con el mismo aviso. En el último periodo no hay siguiente: termina el
  //    partido, con el mismo aviso que FINALIZAR.
  //  - ↺ (solo tras terminar un periodo, en lugar de Stop): volver a poner en
  //    marcha el periodo que se acaba de terminar, por si fue un error — lo que
  //    antes hacía el botón REANUDAR.
  function renderClockControls() {
    const idle = clock.status === 'idle';
    const running = clock.status === 'running';
    const ended = clock.status === 'paused' && periodEnded && !isLastPeriod;

    let PlayIcon = Play;
    let playLabel = 'Reanudar';
    let playTone = 'start';
    let onPlay = store.togglePause;
    if (idle) {
      playLabel = `Iniciar ${shortLabel(1)}`;
      onPlay = store.startPeriod1;
    } else if (running) {
      PlayIcon = Pause;
      playLabel = 'Pausar';
      playTone = 'pause';
    } else if (ended) {
      const lineupPending = store.state.alevinRules && !store.state.lineups[clock.period + 1];
      playLabel = lineupPending
        ? `Primero elige el equipo titular del ${shortLabel(clock.period + 1)}`
        : `Iniciar ${shortLabel(clock.period + 1)}`;
      onPlay = handleStartNext;
    }

    const stopLabel = isLastPeriod ? `Terminar ${shortLabel(clock.period)} y finalizar el partido` : `Terminar ${shortLabel(clock.period)} (FIN)`;

    return (
      <div className="clock-ctl">
        <span className={`period-chip${ended ? ' period-chip--next' : ''}`} title={longLabel(ended ? clock.period + 1 : clock.period)}>
          {ended ? `→${shortLabel(clock.period + 1)}` : shortLabel(clock.period)}
        </span>
        <button type="button" className={`clock-icon-btn clock-icon-btn--${playTone}`} onClick={onPlay} aria-label={playLabel} title={playLabel}>
          <PlayIcon size={18} fill="currentColor" />
        </button>
        {ended ? (
          <button type="button" className="clock-icon-btn clock-icon-btn--resume" onClick={store.togglePause} aria-label={`Reanudar ${shortLabel(clock.period)}`} title={`Reanudar ${shortLabel(clock.period)} (si se terminó por error)`}>
            <RotateCcw size={17} />
          </button>
        ) : (
          <button type="button" className="clock-icon-btn clock-icon-btn--stop" onClick={isLastPeriod ? handleFinish : handleEndPeriod} disabled={idle} aria-label={stopLabel} title={stopLabel}>
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
