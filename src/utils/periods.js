// Formato de un partido: 2 tiempos de 20' (por defecto, y lo que tienen todos
// los partidos anteriores a este campo) o 4 cuartos de 10' (Alevín).
// `periodDurationMs` del partido es siempre la duración de UN periodo, sea
// tiempo o cuarto — lo que cambia entre formatos es solo cuántos hay.
// El label ya NO lleva la duración pegada (2026-09-26, a petición del usuario):
// elegir 2 tiempos o 4 cuartos y elegir la duración de cada uno son dos
// decisiones independientes en el formulario — `minutes` sigue siendo solo el
// valor por defecto al elegir el formato, no una etiqueta fija.
export const PERIOD_FORMATS = {
  halves: { count: 2, minutes: 20, label: '2 tiempos' },
  quarters: { count: 4, minutes: 10, label: '4 cuartos' },
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

// De qué periodo es un minuto dado (1-based), acotado a [1, count] — para listas de
// sucesos por minuto (Cronología, Corregir una acción) que necesitan saber en qué
// cuarto/tiempo cae cada uno.
export function periodOfMinute(minute, periodDurationMs, count) {
  return Math.min(count, Math.max(1, Math.floor(((minute - 1) * 60000) / periodDurationMs) + 1));
}

// Envuelve una lista YA ORDENADA de sucesos (por minuto, en cualquiera de los dos
// sentidos — más reciente primero o al revés) en `{ item }` / `{ divider }`, con un
// separador «Fin de X · Inicio de Y» entre cada dos sucesos consecutivos de periodos
// distintos (2026-09-23, a petición del usuario: "quiero que se marque cuándo acaba y
// empieza cada cuarto o tiempo"). Funciona en los dos sentidos porque solo compara cada
// suceso con el anterior EN EL ORDEN EN QUE YA VIENEN, sin asumir cuál es más nuevo.
export function withPeriodDividers(items, minuteOf, periodDurationMs, count) {
  if (count <= 1) return items.map((item) => ({ item }));
  const out = [];
  let prevPeriod = null;
  for (const item of items) {
    const period = periodOfMinute(minuteOf(item), periodDurationMs, count);
    if (prevPeriod !== null && period !== prevPeriod) {
      const lo = Math.min(prevPeriod, period);
      const hi = Math.max(prevPeriod, period);
      out.push({ divider: true, key: `div-${lo}-${hi}-${out.length}`, lo, hi });
    }
    out.push({ item });
    prevPeriod = period;
  }
  return out;
}
