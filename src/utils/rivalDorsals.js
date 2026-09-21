// Dorsales rivales «de acceso directo» (2026-09-21): cada dorsal que se mete
// durante el partido queda como acceso directo la siguiente vez, y se puede
// dar antes del partido una lista de los que se conocen (`rivalDorsals` del
// partido). Salen los más usados primero; si hay menos de `limit`, se rellena
// con la lista inicial en el orden en que se escribió. Solo vale para ESTE
// partido.

// Cuenta cuántas veces aparece cada dorsal en las listas del partido (goles,
// fallos, exclusiones, amarillas, 7 metros... cualquier documento con `number`).
export function countRivalDorsals(...lists) {
  const counts = {};
  for (const list of lists) {
    for (const item of list || []) {
      const n = item?.number;
      if (n == null || n === '') continue;
      const key = String(n);
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

// Dorsales a mostrar como acceso directo: [{ number: '7', count: 4 }].
export function rivalDorsalShortcuts({ counts = {}, initial = [], limit = 6 } = {}) {
  const used = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a] || Number(a) - Number(b))
    .map((number) => ({ number, count: counts[number] }));
  const seen = new Set(used.map((d) => d.number));
  const seeded = [];
  for (const raw of initial) {
    const number = String(raw);
    if (!number || seen.has(number)) continue;
    seen.add(number);
    seeded.push({ number, count: 0 });
  }
  return [...used, ...seeded].slice(0, limit);
}

// Lee una lista escrita a mano («3, 7 9 11»): números distintos de 1-2 cifras.
export function parseRivalDorsals(text) {
  const out = [];
  for (const token of String(text || '').split(/[^0-9]+/)) {
    if (!token || token.length > 2) continue;
    const n = String(Number(token));
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

// Estado disciplinario de un dorsal rival, para marcar su acceso directo:
// { excludedMs, yellow, red }. `exclusions` es el resumen de
// summarizeRivalExclusions() (activeRemainingMs, disqualified) y
// `yellowCards` la lista de amarillas rivales.
export function rivalDorsalStatus(number, exclusions = [], yellowCards = []) {
  const key = String(number);
  const ex = exclusions.find((e) => String(e.number) === key);
  return {
    excludedMs: ex && !ex.disqualified && ex.activeRemainingMs > 0 ? ex.activeRemainingMs : 0,
    yellow: yellowCards.some((y) => String(y.number) === key),
    red: !!(ex && ex.disqualified),
  };
}
