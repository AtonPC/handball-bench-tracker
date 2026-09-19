// Equipo titular de cada periodo y avisos de las reglas de Alevín (2026-09-19).
// TODO ES OPCIONAL Y NADA BLOQUEA: la app se usa también en entrenamientos y
// amistosos, así que las reglas solo AVISAN — nunca impiden iniciar un cuarto
// ni hacer un cambio. Las reglas de Alevín que se avisan (con `alevinRules` en
// el partido):
//  - Todos los niños tienen que jugar al menos 5 minutos: los 7 que EMPIEZAN un
//    cuarto no pueden ser los que empezaron el cuarto anterior. Solo se puede
//    repetir a alguien si hay MENOS de 14 convocados (con 14 se rota a los 7).
// El equipo titular de cada periodo se guarda en `match.lineups` como
// { [periodo]: [idPortero, id2, ... id7] } — el PRIMERO es siempre el portero.
// El del periodo 1 sale de los titulares elegidos al crear el partido; los
// demás, de lo que haya en pista al iniciar cada periodo (o de lo que se elija
// entre periodos con "Equipo titular").

export const LINEUP_SIZE = 7;
// Con menos convocados que esto, repetir titulares es inevitable y se permite.
export const REPEAT_ALLOWED_BELOW = LINEUP_SIZE * 2;

// Pone al portero el primero de la lista.
export function orderLineup(ids, goalkeeperId) {
  if (!goalkeeperId || !ids.includes(goalkeeperId)) return [...ids];
  return [goalkeeperId, ...ids.filter((id) => id !== goalkeeperId)];
}

// Titulares de cada periodo, incluido el 1º aunque el partido sea anterior a
// esta función (se deduce de los titulares elegidos al crearlo).
export function lineupsOf(match) {
  const out = { ...(match?.lineups || {}) };
  if (!out[1] && match?.startingLineupIds?.length) {
    out[1] = orderLineup(match.startingLineupIds, match.startingGoalkeeperId);
  }
  return out;
}

// Comprueba un equipo titular en preparación. Lo ÚNICO que hace falta para
// poder aplicarlo es que esté completo (7 puestos, portero el primero) y sin
// nadie duplicado; lo de repetir es solo un aviso.
//  ids: los 7 puestos en orden (el primero, el portero); '' = sin rellenar.
//  prevIds: los que empezaron el periodo anterior.
export function validateLineup({ ids, prevIds = [] }) {
  const filled = ids.filter(Boolean);
  const complete = ids.length === LINEUP_SIZE && ids.every(Boolean);
  const seen = new Set();
  const duplicates = [];
  for (const id of filled) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  const prev = new Set(prevIds);
  const repeated = [...new Set(filled.filter((id) => prev.has(id)))];
  return { complete, duplicates, repeated, canConfirm: complete && duplicates.length === 0 };
}

// Aviso de las reglas de Alevín sobre quienes repiten del periodo anterior, o
// null si no hay nada que avisar.
//  level 'warn': hay 14 o más convocados, así que NO se debería repetir a nadie.
//  level 'info': hay menos de 14, repetir es inevitable — se recuerda cuántos
//    hay que repetir como mínimo y si se está repitiendo de más.
export function lineupAdvice({ repeated, convocados }) {
  if (!repeated || repeated.length === 0) return null;
  if (convocados >= REPEAT_ALLOWED_BELOW) {
    return { level: 'warn', repeated, convocados, needed: 0 };
  }
  const needed = Math.max(0, REPEAT_ALLOWED_BELOW - convocados);
  return { level: 'info', repeated, convocados, needed, tooMany: repeated.length > needed };
}
