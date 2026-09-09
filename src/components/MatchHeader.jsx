import { formatClock } from '../utils/time';
import StatStepper from './StatStepper';

export default function MatchHeader({ store, onBack, onFinish, onOpenQuickStats }) {
  const { clock, score, timeouts, ownTeamName, rivalName, isHome } = store.state;
  const leftName = isHome ? ownTeamName : rivalName;
  const rightName = isHome ? rivalName : ownTeamName;

  function renderClockButton() {
    if (clock.status === 'idle') {
      return <button className="btn btn-clock btn-start" onClick={store.startPeriod1}>INICIAR 1T</button>;
    }
    if (clock.status === 'running') {
      return <button className="btn btn-clock btn-pause" onClick={store.togglePause}>PAUSAR</button>;
    }
    // paused
    if (clock.period === 1) {
      return (
        <div className="clock-btn-group">
          <button className="btn btn-clock" onClick={store.togglePause}>REANUDAR</button>
          <button className="btn btn-clock btn-start" onClick={store.startPeriod2}>INICIAR 2T</button>
        </div>
      );
    }
    return <button className="btn btn-clock" onClick={store.togglePause}>REANUDAR</button>;
  }

  return (
    <header className="match-header">
      <div className="header-row">
        <button className="btn btn-logout" onClick={onBack}>← PARTIDOS</button>
        <button className="btn btn-timeout" onClick={onOpenQuickStats}>ESTADÍSTICAS</button>
        <button className="btn btn-undo" onClick={store.undo} disabled={!store.canUndo}>
          DESHACER
        </button>
      </div>
      <div className="header-row">
        <div className="scoreboard">
          <span className="team-name team-name--own">{leftName}</span>
          <span className="score-own">{isHome ? score.own : score.rival}</span>
          <span className="score-sep">-</span>
          <span className="score-rival">{isHome ? score.rival : score.own}</span>
          <span className="team-name team-name--rival">{rightName}</span>
        </div>
        <div className="master-clock">
          <span className="period-label">{clock.period}ª parte</span>
          <span className={`clock-time${clock.periodRemainingMs < 0 ? ' clock-time--over' : ''}`}>
            {clock.periodRemainingMs < 0 ? `+${formatClock(-clock.periodRemainingMs)}` : formatClock(clock.periodRemainingMs)}
          </span>
        </div>
      </div>
      <div className="header-row">
        {renderClockButton()}
        <div className="timeouts">
          <div className="stepper-group">
            <span className="stepper-caption">T.M. propio</span>
            <StatStepper
              icon={`P.${clock.period}`}
              label="Tiempo muerto propio"
              count={timeouts.own[clock.period] || 0}
              onInc={() => store.timeout('own', 1)}
              onDec={() => store.timeout('own', -1)}
            />
          </div>
          <div className="stepper-group">
            <span className="stepper-caption">T.M. rival</span>
            <StatStepper
              icon={`P.${clock.period}`}
              label="Tiempo muerto rival"
              count={timeouts.rival[clock.period] || 0}
              onInc={() => store.timeout('rival', 1)}
              onDec={() => store.timeout('rival', -1)}
            />
          </div>
        </div>
        <button className="btn btn-pause" onClick={onFinish}>FINALIZAR</button>
      </div>
    </header>
  );
}
