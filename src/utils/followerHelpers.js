import { OUT_ZONES } from '../shotZones';

const OUT_ZONE_SET = new Set(OUT_ZONES);

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

// Cronología unificada: goles, fallos, paradas y recuperaciones propias, y
// goles, fallos, exclusiones y 7 metros del rival, ordenados de más
// reciente a más antiguo. Las exclusiones rivales no traen guardado si
// fueron la 3ª de ese dorsal (a diferencia de las propias) — se calcula
// aquí, en orden cronológico. Se usa tanto para el partido en directo
// como para el detalle de un partido finalizado — la lógica es la misma
// en los dos casos. El desempate por createdAt es necesario: dos sucesos
// del mismo minuto pueden venir de colecciones distintas (o de la misma,
// con el desempate de Firestore sin relación con el orden real) — sin él
// no salían en el orden en que pasaron de verdad, solo agrupados por tipo
// de suceso.
export function buildChronology({ ownGoals, ownMisses, ownSaves, ownRecoveries, ownExclusions, rivalGoals, rivalMisses, rivalExclusions, rivalSevenMeters }) {
  const entries = [];
  for (const g of ownGoals) entries.push({ id: `og-${g.id}`, minute: g.minute, createdAt: g.createdAt, type: 'goal', side: 'own', playerId: g.playerId });
  // missKind distingue de un vistazo por qué no fue gol: 'out' si la
  // entrada fue una de las 3 zonas de "Fuera" (se fue fuera de verdad),
  // 'saved' si fue una de las 9 de portería (entonces paró el portero
  // rival — un fallo nuestro dentro del marco ES una parada suya, aunque
  // nosotros no lo anotemos como tal), null si no se eligió zona.
  for (const m of ownMisses) {
    const missKind = !m.goalZone ? null : OUT_ZONE_SET.has(m.goalZone) ? 'out' : 'saved';
    entries.push({ id: `om-${m.id}`, minute: m.minute, createdAt: m.createdAt, type: 'miss', side: 'own', playerId: m.playerId, missKind });
  }
  for (const s of ownSaves || []) entries.push({ id: `os-${s.id}`, minute: s.minute, createdAt: s.createdAt, type: 'save', side: 'own', playerId: s.playerId });
  for (const r of ownRecoveries) entries.push({ id: `or-${r.id}`, minute: r.minute, createdAt: r.createdAt, type: 'recovery', side: 'own', playerId: r.playerId });
  for (const e of ownExclusions) entries.push({ id: `oe-${e.id}`, minute: e.minute, createdAt: e.createdAt, type: 'exclusion', side: 'own', playerId: e.playerId, disqualified: e.disqualified });
  for (const g of rivalGoals) entries.push({ id: `rg-${g.id}`, minute: g.minute, createdAt: g.createdAt, type: 'goal', side: 'rival', number: g.number });
  // Un fallo rival (tiró fuera, sin que paráramos nada) siempre es 'out'
  // por definición — si lo hubiéramos parado, sería una Parada propia, no
  // esto (ver rivalMiss() en useMatchStore.js).
  for (const m of rivalMisses || []) entries.push({ id: `rm-${m.id}`, minute: m.minute, createdAt: m.createdAt, type: 'miss', side: 'rival', number: m.number, missKind: 'out' });
  for (const s of rivalSevenMeters || []) entries.push({ id: `rs-${s.id}`, minute: s.minute, createdAt: s.createdAt, type: 'sevenMeter', side: 'rival', number: s.number });

  const rivalCounts = {};
  const sortedRivalExclusions = [...rivalExclusions].sort((a, b) => a.minute - b.minute);
  for (const e of sortedRivalExclusions) {
    rivalCounts[e.number] = (rivalCounts[e.number] || 0) + 1;
    entries.push({ id: `re-${e.id}`, minute: e.minute, createdAt: e.createdAt, type: 'exclusion', side: 'rival', number: e.number, disqualified: rivalCounts[e.number] >= 3 });
  }

  // Marcador de camino: se recorre en orden cronológico real (más antiguo
  // primero) para ir sumando, y se deja en cada suceso el marcador tal
  // cual estaba justo después de él — así la Cronología puede enseñar el
  // "18-16" de cada fila sin que cada pantalla tenga que recalcularlo.
  const chronological = [...entries].sort((a, b) => a.minute - b.minute || (a.createdAt || 0) - (b.createdAt || 0));
  let own = 0, rival = 0;
  for (const e of chronological) {
    if (e.type === 'goal') {
      if (e.side === 'own') own += 1; else rival += 1;
    }
    e.ownScore = own;
    e.rivalScore = rival;
  }

  return entries.sort((a, b) => b.minute - a.minute || (b.createdAt || 0) - (a.createdAt || 0));
}
