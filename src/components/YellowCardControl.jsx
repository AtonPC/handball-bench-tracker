import { RectangleVertical } from 'lucide-react';

// Tarjeta amarilla de un jugador propio: como mucho una por partido, así
// que solo tiene dos estados (a diferencia de ExclusionControl, que tiene
// tres) — sin marcar (botón neutro, contorno amarillo) o ya marcada
// (relleno amarillo sólido, tocar para anular por error). No es una
// sanción temporal: no bloquea nada ni cuenta para la expulsión, es
// aparte de las exclusiones de 2 minutos.
// El contorno tiene que ser amarillo TAMBIÉN sin marcar — es el único
// botón que ya no lleva texto ("AM" se quitó a petición del usuario), así
// que el icono es la única pista de qué botón es; con el color por
// defecto (currentColor = --text, oscuro) no se distinguía de ningún otro
// icono y el usuario reportó "no se ve el icono amarillo".
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
      <RectangleVertical size={18} stroke="var(--card-yellow)" strokeWidth={2.5} />
    </button>
  );
}
