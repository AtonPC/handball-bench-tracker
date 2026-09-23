import { formatClock } from './time';

// Marca de sanción de un jugador nuestro, junto a su nombre en las consolas de
// tablet y móvil: tiempo de exclusión que le queda, «X/3» si ya ha tenido alguna
// sin estar cumpliendo esta ahora mismo, o nada de texto (solo el color del
// `kind`) para amarilla sola o roja — el color ya dice de qué sanción se trata,
// la letra sobraba y ocupaba espacio de más (2026-09-22). `null` si no tiene
// ninguna.
// 2026-09-22 (antes): hasta entonces, en cuanto terminaban los 2 minutos, la
// marca desaparecía del todo — un jugador con una exclusión ya cumplida (pero
// con solo 1 de 3, puede seguir jugando) se veía igual que uno sin ninguna.
export function sanctionTag(p) {
  if (p.disqualified) return { text: '', kind: 'red' };
  if (p.excluded) return { text: formatClock(p.exclusionRemainingMs || 0), kind: 'excl' };
  if (p.exclusionsCount > 0) return { text: `${p.exclusionsCount}/3`, kind: 'exclcount' };
  if (p.yellowCard) return { text: '', kind: 'yellow' };
  return null;
}
