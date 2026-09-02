import { formatClock } from '../utils/time';

export default function FamilyView({ store, onLogout }) {
  const { state } = store;
  const courtPlayers = state.courtSlots.map((id) => state.players[id]).filter(Boolean);
  const leftName = state.isHome ? state.ownTeamName : state.rivalName;
  const rightName = state.isHome ? state.rivalName : state.ownTeamName;

  return (
    <div className="family-view">
      <header className="match-header">
        <div className="header-row">
          <div className="scoreboard">
            <span className="team-name team-name--own">{leftName}</span>
            <span className="score-own">{state.isHome ? state.score.own : state.score.rival}</span>
            <span className="score-sep">-</span>
            <span className="score-rival">{state.isHome ? state.score.rival : state.score.own}</span>
            <span className="team-name team-name--rival">{rightName}</span>
          </div>
          <div className="master-clock">
            <span className="period-label">{state.clock.period}ª parte</span>
            <span className="clock-time">{formatClock(state.clock.elapsedMs)}</span>
          </div>
          <button className="btn btn-undo" onClick={onLogout}>SALIR</button>
        </div>
      </header>

      <div className="player-panel">
        <p className="modal-hint family-hint">Minutos jugados</p>
        {courtPlayers.map((player) => (
          <div key={player.id} className="player-row family-row">
            <div className="player-identity">
              <span className="player-number">{player.number}</span>
              <div className="player-name-block">
                <span className="player-name">{player.name}{player.isGK ? ' (P)' : ''}</span>
                <span className="player-clock">{formatClock(player.accumulatedMs)}</span>
              </div>
            </div>
            {player.excluded && (
              <div className="exclusion-badge">EXCL. {formatClock(player.exclusionRemainingMs)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
