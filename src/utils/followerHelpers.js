// La plantilla (colección "players") no tiene un campo "name" — solo
// displayName (o firstName/lastName) —, a diferencia de los jugadores ya
// copiados a un partido, que sí lo tienen. Mismo criterio que startMatch.
export function rosterDisplayName(p) {
  return p.displayName || `${p.firstName || ''} ${p.lastName || ''}`.trim();
}

// Nombre a mostrar de un jugador propio, respetando imageAuthorized: si el
// club no ha autorizado a mostrar su nombre, solo se ve el dorsal. Nunca se
// muestra el tiempo jugado individual — solo quién está en pista.
export function ownPlayerLabel(playersById, authorizedById, playerId) {
  const p = playersById[playerId];
  if (!p) return 'Jugador/a';
  if (authorizedById[playerId] === false) return `#${p.number ?? '?'}`;
  return rosterDisplayName(p) || `#${p.number ?? '?'}`;
}

// Cronología unificada: goles, fallos y recuperaciones propias, y goles y
// exclusiones de ambos equipos, ordenados de más reciente a más antiguo.
// Las exclusiones rivales no traen guardado si fueron la 3ª de ese dorsal
// (a diferencia de las propias) — se calcula aquí, en orden cronológico.
// Se usa tanto para el partido en directo como para el detalle de un
// partido finalizado — la lógica es la misma en los dos casos.
export function buildChronology({ ownGoals, ownMisses, ownRecoveries, ownExclusions, rivalGoals, rivalExclusions }) {
  const entries = [];
  for (const g of ownGoals) entries.push({ id: `og-${g.id}`, minute: g.minute, type: 'goal', side: 'own', playerId: g.playerId });
  for (const m of ownMisses) entries.push({ id: `om-${m.id}`, minute: m.minute, type: 'miss', side: 'own', playerId: m.playerId });
  for (const r of ownRecoveries) entries.push({ id: `or-${r.id}`, minute: r.minute, type: 'recovery', side: 'own', playerId: r.playerId });
  for (const e of ownExclusions) entries.push({ id: `oe-${e.id}`, minute: e.minute, type: 'exclusion', side: 'own', playerId: e.playerId, disqualified: e.disqualified });
  for (const g of rivalGoals) entries.push({ id: `rg-${g.id}`, minute: g.minute, type: 'goal', side: 'rival', number: g.number });

  const rivalCounts = {};
  const sortedRivalExclusions = [...rivalExclusions].sort((a, b) => a.minute - b.minute);
  for (const e of sortedRivalExclusions) {
    rivalCounts[e.number] = (rivalCounts[e.number] || 0) + 1;
    entries.push({ id: `re-${e.id}`, minute: e.minute, type: 'exclusion', side: 'rival', number: e.number, disqualified: rivalCounts[e.number] >= 3 });
  }

  return entries.sort((a, b) => b.minute - a.minute);
}
