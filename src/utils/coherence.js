// Comprobación de coherencia de un partido: cada dato vive a la vez en un
// contador (del jugador o del marcador) y en documentos de detalle (goles,
// fallos, paradas, recuperaciones, goles y fallos rivales). Si los dos no
// coinciden, las pantallas que leen uno u otro enseñan cosas distintas
// (marcador vs cronología, tiros del rival, zonas...). Esta función solo
// LISTA las diferencias — cuál de los dos lados es el correcto lo decide
// quien corrige, no se arregla nada solo.
//
// Diferencias esperables que no son un error: partidos anotados antes de
// que existiera el detalle de cada acción (sin documentos), correcciones
// hechas a mano en el editor, y paradas anteriores al 2026-09-16 (no
// creaban su fallo rival emparejado).
export function checkMatchCoherence({ players, score, shotEvents, saveEvents, recoveryEvents, rivalGoals, rivalMisses }) {
  const issues = [];
  const countWhere = (list, pred) => list.filter(pred).length;

  for (const p of players) {
    const who = `#${p.number ?? '?'} ${p.name || ''}`.trim();
    const checks = [
      ['Goles', p.goals || 0, countWhere(shotEvents, (e) => e.playerId === p.id && e.type === 'goal')],
      ['Fallos', p.shots || 0, countWhere(shotEvents, (e) => e.playerId === p.id && e.type === 'miss')],
      ['Paradas', p.saves || 0, countWhere(saveEvents, (e) => e.playerId === p.id)],
      ['Recuperaciones', p.recoveries || 0, countWhere(recoveryEvents, (e) => e.playerId === p.id)],
    ];
    for (const [what, counter, records] of checks) {
      if (counter !== records) issues.push({ who, what, counter, records });
    }
  }

  const goalsSum = players.reduce((s, p) => s + (p.goals || 0), 0);
  if ((score?.own || 0) !== goalsSum) {
    issues.push({ who: 'Equipo', what: 'Marcador propio vs suma de goles de los jugadores', counter: score?.own || 0, records: goalsSum });
  }
  if ((score?.rival || 0) !== rivalGoals.length) {
    issues.push({ who: 'Rival', what: 'Marcador rival vs goles rivales con detalle', counter: score?.rival || 0, records: rivalGoals.length });
  }

  // Cada parada debería tener su fallo rival emparejado (por pairId, o por
  // createdAt exacto en las anteriores al campo pairId).
  const pairKey = (e) => e.pairId || `t${e.createdAt}`;
  const missKeys = new Set(rivalMisses.map(pairKey));
  const pairedSaves = countWhere(saveEvents, (s) => missKeys.has(pairKey(s)));
  if (pairedSaves !== saveEvents.length) {
    issues.push({ who: 'Rival', what: 'Paradas con su fallo rival emparejado', counter: saveEvents.length, records: pairedSaves });
  }

  return issues;
}
