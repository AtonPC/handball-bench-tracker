import { RectangleVertical } from 'lucide-react';

// Tarjeta amarilla de un jugador propio: como mucho una por partido, así
// que solo tiene dos estados (a diferencia de ExclusionControl, que tiene
// tres) — sin marcar o ya marcada (tocar para anular por error). No es
// una sanción temporal: no bloquea nada ni cuenta para la expulsión, es
// aparte de las exclusiones de 2 minutos.
// El icono se pinta SIEMPRE relleno de amarillo sólido, en los dos
// estados — sin texto ("AM" se quitó a petición del usuario) es la única
// pista de qué botón es, y un simple contorno no se leía como "una
// tarjeta amarilla de verdad" (pedido explícito del usuario). Lo que
// distingue "marcada" de "sin marcar" es el fondo/borde del propio botón
// (.excl-btn--yellow), no el icono.
export default function YellowCardControl({ player, onGive, onCancel, disabled }) {
  if (player.yellowCard) {
    return (
      <button type="button" className="excl-btn excl-btn--yellow" onClick={onCancel} aria-label="Cancelar tarjeta amarilla" title="Tarjeta amarilla — tocar para anular">
        <RectangleVertical size={18} fill="var(--card-yellow)" stroke="var(--card-yellow)" />
      </button>
    );
  }

  return (
    <button type="button" className="excl-btn" onClick={onGive} disabled={disabled} aria-label="Tarjeta amarilla" title="Tarjeta amarilla">
      <RectangleVertical size={18} fill="var(--card-yellow)" stroke="var(--card-yellow)" />
    </button>
  );
}
