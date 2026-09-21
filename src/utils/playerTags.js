import { formatClock } from './time';

// Marca de sanción de un jugador nuestro, junto a su nombre en las consolas de
// tablet y móvil: tiempo de exclusión que le queda (con «A» si además tiene
// amarilla), «A» amarilla o «R» expulsado. `null` si no tiene ninguna.
export function sanctionTag(p) {
  if (p.disqualified) return { text: 'R', kind: 'red' };
  if (p.excluded) return { text: `${formatClock(p.exclusionRemainingMs || 0)}${p.yellowCard ? ' A' : ''}`, kind: 'excl' };
  if (p.yellowCard) return { text: 'A', kind: 'yellow' };
  return null;
}
