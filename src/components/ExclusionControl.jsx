import { Timer } from 'lucide-react';
import { formatClock } from '../utils/time';

// La tarjeta roja se reserva para la expulsión definitiva (3ª exclusión) —
// una exclusión normal de 2 minutos usa la tarjeta ámbar, no la roja.
export default function ExclusionControl({ player, onStart, onCancel, disabled }) {
  const count = player.exclusionsCount || 0;

  if (player.disqualified) {
    return (
      <span className="excl-btn excl-btn--disqualified" aria-label="Expulsado del partido">
        <span className="ref-card ref-card--red" /> Expulsado
      </span>
    );
  }

  if (player.excluded) {
    return (
      <button className="excl-btn excl-btn--active" onClick={onCancel} aria-label="Cancelar exclusión">
        <span className="ref-card ref-card--amber" /> {formatClock(player.exclusionRemainingMs)}
        <span className="excl-count">{count}/3</span>
      </button>
    );
  }

  return (
    <button className="excl-btn" onClick={onStart} disabled={disabled} aria-label="Exclusión 2 minutos">
      <Timer size={14} /> 2'
      <span className="excl-count">{count}/3</span>
    </button>
  );
}
