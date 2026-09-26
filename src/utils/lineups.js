import { BOARD_ZONES } from './shotBoard';

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

// 6 posiciones de cancha reaprovechando la geometría del panel de tiro
// (utils/shotBoard.js), renombradas a las posiciones reales de balonmano
// (2026-09-26, a petición del usuario: "una plantilla como la de tiro, sin
// portería, arrastrando jugadores a cada puesto"). Los laterales y el central
// se colocan en la banda de 9 m —de ahí tiran de verdad—, el pivote en la
// banda cercana central —pegado al área—, y los extremos igual que en el
// panel de tiro (banda completa, izquierda/derecha como mira quien ve la
// cancha). El portero no tiene hueco aquí (no es una zona de tiro): se coloca
// aparte, encima de la cancha, en LineupBoard.jsx.
// El orden es FIJO y es lo que da continuidad entre periodos sin cambiar el
// formato de `ids` (sigue siendo un array de 7, el primero el portero): el
// índice 1 SIEMPRE es EI, el 2 SIEMPRE LI, etc. — comparar ids[i] entre dos
// periodos consecutivos dice de verdad "quién jugó en ESTE puesto la vez
// anterior", sin tocar useMatchStore.js/useMatches.js ni el resto de lo que
// ya lee/escribe `lineups`/`startingLineupIds` como un array plano.
const byCode = Object.fromEntries(BOARD_ZONES.map((z) => [z.code, z]));
export const LINEUP_FIELD_ZONES = [
  { key: 'EI', label: 'EI', name: 'Extremo Izquierdo', def: byCode.EI },
  { key: 'LI', label: 'LI', name: 'Lateral Izquierdo', def: byCode['LI 9'] },
  { key: 'C', label: 'C', name: 'Central', def: byCode['C 9'] },
  { key: 'LD', label: 'LD', name: 'Lateral Derecho', def: byCode['LD 9'] },
  { key: 'ED', label: 'ED', name: 'Extremo Derecho', def: byCode.ED },
  { key: 'P', label: 'P', name: 'Pivote', def: byCode.C },
];

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

// Comprueba un equipo titular en preparación. Para poder aplicarlo basta con
// que haya al menos un jugador y ninguno duplicado; lo de repetir es solo un
// aviso. Con MENOS de 7 (un entrenamiento con pocos niños, alguien que falta)
// también se puede, pero la pantalla pide una segunda confirmación
// (`complete` = 7 puestos rellenos, `hasGoalkeeper` = la primera fila lo está).
//  ids: los 7 puestos en orden (el primero, el portero); '' = sin rellenar.
//  prevIds: los que empezaron el periodo anterior.
export function validateLineup({ ids, prevIds = [] }) {
  const filled = ids.filter(Boolean);
  const complete = ids.length === LINEUP_SIZE && ids.every(Boolean);
  const hasGoalkeeper = !!ids[0];
  const seen = new Set();
  const duplicates = [];
  for (const id of filled) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  const prev = new Set(prevIds);
  const repeated = [...new Set(filled.filter((id) => prev.has(id)))];
  return {
    complete,
    hasGoalkeeper,
    filledCount: filled.length,
    duplicates,
    repeated,
    canConfirm: filled.length > 0 && duplicates.length === 0,
  };
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
