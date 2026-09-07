import { formatClock } from '../utils/time';

// El símbolo de tarjeta roja se reserva para la expulsión definitiva (3ª
// exclusión) — una exclusión normal de 2 minutos no es tarjeta roja.
export default function ExclusionControl({ player, onStart, onCancel }) {
  const count = player.exclusionsCount || 0;

  if (player.disqualified) {
    return (
      <span className="excl-btn excl-btn--disqualified" aria-label="Expulsado del partido">
        🟥 Expulsado
      </span>
    );
  }

  if (player.excluded) {
    return (
      <button className="excl-btn excl-btn--active" onClick={onCancel} aria-label="Cancelar exclusión">
        🟧 {formatClock(player.exclusionRemainingMs)}
        <span className="excl-count">{count}/3</span>
      </button>
    );
  }

  return (
    <button className="excl-btn" onClick={onStart} aria-label="Exclusión 2 minutos">
      ⏱ 2'
      <span className="excl-count">{count}/3</span>
    </button>
  );
}
