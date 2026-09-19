import { ArrowLeft, Pause, Play, RotateCcw, Square, Undo2 } from 'lucide-react';
import { formatClock } from '../utils/time';
import { teamInitials } from '../utils/teamColors';
import TimeoutsMenu from './TimeoutsMenu';
import { periodLongLabel, periodShortLabel } from '../utils/periods';
import { lineupAdvice, orderLineup, validateLineup } from '../utils/lineups';

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

  // Iniciar el siguiente periodo. Con los avisos de Alevín puestos, si no se ha
  // elegido su equipo titular, avisa (y de quien repite del periodo anterior)
  // antes de empezar. Es SOLO un aviso: aceptar inicia el periodo igualmente y
  // nunca se impide empezar (la app se usa también en entrenamientos).
  function handleStartNext() {
    const { alevinRules, lineups, courtSlots, players, convocados } = store.state;
    const next = clock.period + 1;
    if (alevinRules && !lineups[next]) {
      const goalkeeper = courtSlots.find((id) => players[id]?.isGK);
      const check = validateLineup({ ids: orderLineup(courtSlots, goalkeeper), prevIds: lineups[clock.period] || [] });
      const advice = lineupAdvice({ repeated: check.repeated, convocados });
      const dorsales = (advice?.repeated || []).map((id) => '#' + (players[id]?.number ?? '?')).join(', ');
      let message = `Aún no has elegido el equipo titular del ${shortLabel(next)} (botón «ELEGIR EQUIPO TITULAR» de la barra roja).`;
      if (advice?.level === 'warn') {
        message += `\n\nAviso: ${dorsales} ya empezó el ${shortLabel(clock.period)}; con ${convocados} convocados no se debería repetir.`;
      } else if (advice) {
        message += `\n\nAviso: repites ${advice.repeated.length} del ${shortLabel(clock.period)} (${dorsales}); con ${convocados} convocados hay que repetir como mínimo ${advice.needed}.`;
      }
      message += `\n\n¿Iniciar el ${shortLabel(next)} igualmente?`;
      if (!confirm(message)) return;
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
      playLabel = `Iniciar ${shortLabel(clock.period + 1)}`;
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
