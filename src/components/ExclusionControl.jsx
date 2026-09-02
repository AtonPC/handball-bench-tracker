import { formatClock } from '../utils/time';

export default function ExclusionControl({ player, onStart, onCancel }) {
  if (player.excluded) {
    return (
      <button className="excl-btn excl-btn--active" onClick={onCancel} aria-label="Cancelar exclusión">
        🟥 {formatClock(player.exclusionRemainingMs)}
      </button>
    );
  }
  return (
    <button className="excl-btn" onClick={onStart} aria-label="Exclusión 2 minutos">
      🟥
    </button>
  );
}
