import { Timer } from 'lucide-react';
import { formatClock } from '../utils/time';

// La tarjeta roja se reserva para la expulsión definitiva (3ª exclusión) —
// una exclusión normal de 2 minutos usa la tarjeta ámbar, no la roja.
export default function ExclusionControl({ player, onStart, onCancel, disabled }) {
  const count = player.exclusionsCount || 0;

  if (player.disqualified) {
    return (
      <span className="excl-btn excl-btn--disqualified" aria-label="Roja — no puede seguir jugando">
        <span className="ref-card ref-card--red" /> <span className="excl-time">Roja</span>
      </span>
    );
  }

  if (player.excluded) {
    return (
      <button className="excl-btn excl-btn--active" onClick={onCancel} aria-label="Cancelar exclusión">
        <span className="ref-card ref-card--amber" /> <span className="excl-time">{formatClock(player.exclusionRemainingMs)}</span>
        <span className="excl-count">{count}/3</span>
      </button>
    );
  }

  return (
    <button className="excl-btn" onClick={onStart} disabled={disabled} aria-label="Exclusión 2 minutos">
      <Timer size={14} /> <span className="excl-label">2'</span>
      <span className="excl-count">{count}/3</span>
    </button>
  );
}
