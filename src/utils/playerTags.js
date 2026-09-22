import { formatClock } from './time';

// Marca de sanción de un jugador nuestro, junto a su nombre en las consolas de
// tablet y móvil: tiempo de exclusión que le queda (con «A» si además tiene
// amarilla), «A» amarilla o «R» expulsado. `null` si no tiene ninguna.
// 2026-09-22: antes, en cuanto terminaban los 2 minutos, la marca desaparecía
// del todo — un jugador con una exclusión ya cumplida (pero con solo 1 de 3,
// puede seguir jugando) se veía igual que uno sin ninguna. Ahora, sin estar
// cumpliendo ninguna en este momento, si ya ha tenido alguna se ve «1/3»
// (como el +/− de la vista clásica, ver ExclusionControl.jsx) en vez de nada.
export function sanctionTag(p) {
  if (p.disqualified) return { text: 'R', kind: 'red' };
  if (p.excluded) return { text: `${formatClock(p.exclusionRemainingMs || 0)}${p.yellowCard ? ' A' : ''}`, kind: 'excl' };
  if (p.exclusionsCount > 0) return { text: `${p.exclusionsCount}/3${p.yellowCard ? ' A' : ''}`, kind: 'exclcount' };
  if (p.yellowCard) return { text: 'A', kind: 'yellow' };
  return null;
}
