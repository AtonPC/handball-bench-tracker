// Formato de un partido: 2 tiempos de 20' (por defecto, y lo que tienen todos
// los partidos anteriores a este campo) o 4 cuartos de 10' (Alevín).
// `periodDurationMs` del partido es siempre la duración de UN periodo, sea
// tiempo o cuarto — lo que cambia entre formatos es solo cuántos hay.
export const PERIOD_FORMATS = {
  halves: { count: 2, minutes: 20, label: '2 tiempos de 20 min' },
  quarters: { count: 4, minutes: 10, label: '4 cuartos de 10 min' },
};

export function periodFormatOf(match) {
  return match?.periodCount === 4 ? 'quarters' : 'halves';
}

export function periodCountOf(match) {
  return PERIOD_FORMATS[periodFormatOf(match)].count;
}

const QUARTER_NAMES = { 1: '1er cuarto', 2: '2º cuarto', 3: '3er cuarto', 4: '4º cuarto' };

// "1ª parte" / "3er cuarto" — para textos y avisos.
export function periodLongLabel(period, count) {
  return count === 4 ? QUARTER_NAMES[period] || `${period}º cuarto` : `${period}ª parte`;
}

// "1T" / "3C" — para botones y marcadores compactos.
export function periodShortLabel(period, count) {
  return count === 4 ? `${period}C` : `${period}T`;
}
