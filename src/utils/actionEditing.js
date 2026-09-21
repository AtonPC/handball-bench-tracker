// Edición de las acciones de un partido ya finalizado (borrar, corregir,
// añadir una olvidada). Cada acción vive a la vez en un documento de detalle
// (con su minuto y zonas) y en contadores (del jugador y/o del marcador):
// aquí se calcula, sin tocar Firestore, el "plan" completo de cambios de una
// operación — así el detalle y los contadores nunca se quedan descuadrados
// — y luego lo aplica useMatchEditor.applyPlan en un solo batch.
//
// Idea central: una acción tiene unos EFECTOS sobre los contadores
// (`effectsOf`). Borrarla es aplicar los efectos al revés; añadirla, aplicarlos;
// corregirla, deshacer los del estado anterior y aplicar los del nuevo (así un
// cambio de jugador, o de gol a fallo, sale sin casos especiales).

export const ACTION_KINDS = {
  ownGoal: { sub: 'shotEvents', side: 'own', label: 'Gol', fields: ['player', 'minute', 'shotZone', 'goalZone'] },
  ownMiss: { sub: 'shotEvents', side: 'own', label: 'Fallo', fields: ['player', 'minute', 'shotZone', 'goalZone'] },
  ownSave: { sub: 'saveEvents', side: 'own', label: 'Parada', fields: ['player', 'minute', 'rivalNumber', 'shotZone', 'goalZone'] },
  ownRecovery: { sub: 'recoveryEvents', side: 'own', label: 'Recuperación', fields: ['player', 'minute'] },
  ownExclusion: { sub: 'exclusionEvents', side: 'own', label: 'Exclusión', fields: ['player', 'minute'] },
  ownYellow: { sub: 'yellowCardEvents', side: 'own', label: 'Tarjeta amarilla', fields: ['player', 'minute'] },
  rivalGoal: { sub: 'rivalGoals', side: 'rival', label: 'Gol rival', fields: ['number', 'minute', 'shotZone', 'goalZone', 'foulPlayer'] },
  rivalMiss: { sub: 'rivalMisses', side: 'rival', label: 'Fallo rival', fields: ['number', 'minute', 'shotZone', 'goalZone'] },
  rivalExclusion: { sub: 'rivalExclusions', side: 'rival', label: 'Exclusión rival', fields: ['number', 'minute'] },
  rivalSevenMeter: { sub: 'rivalSevenMeters', side: 'rival', label: '7 metros rival', fields: ['number', 'minute'] },
  rivalYellow: { sub: 'rivalYellowCards', side: 'rival', label: 'Amarilla rival', fields: ['number', 'minute'] },
};

// Parada y Fallo rival emparejados: por pairId, o por createdAt idéntico en
// los anteriores a ese campo (misma regla que useMatchStore.findPairedDoc).
const pairKey = (e) => e.pairId || `t${e.createdAt}`;

// Lista unificada de todas las acciones, ordenada por minuto y luego por
// hora real. Un Fallo rival emparejado con una Parada NO sale aparte: es la
// misma acción vista desde el otro equipo, y se edita/borra con la parada.
export function buildActionList({
  shotEvents = [], saveEvents = [], recoveryEvents = [], exclusionEvents = [], yellowCardEvents = [],
  rivalGoals = [], rivalMisses = [], rivalExclusions = [], rivalSevenMeters = [], rivalYellowCards = [],
}) {
  const saveKeys = new Set(saveEvents.map(pairKey));
  const list = [];
  const push = (kind, e, extra = {}) => list.push({ key: `${kind}-${e.id}`, kind, id: e.id, data: e, minute: e.minute ?? 0, createdAt: e.createdAt || 0, ...extra });

  for (const e of shotEvents) push(e.type === 'goal' ? 'ownGoal' : 'ownMiss', e);
  for (const e of saveEvents) {
    const paired = rivalMisses.find((m) => pairKey(m) === pairKey(e));
    push('ownSave', e, { pairedMissId: paired?.id || null });
  }
  for (const e of recoveryEvents) push('ownRecovery', e);
  for (const e of exclusionEvents) push('ownExclusion', e);
  for (const e of yellowCardEvents) push('ownYellow', e);
  for (const e of rivalGoals) push('rivalGoal', e);
  for (const e of rivalMisses) if (!saveKeys.has(pairKey(e))) push('rivalMiss', e);
  for (const e of rivalExclusions) push('rivalExclusion', e);
  for (const e of rivalSevenMeters) push('rivalSevenMeter', e);
  for (const e of rivalYellowCards) push('rivalYellow', e);

  return list.sort((a, b) => a.minute - b.minute || a.createdAt - b.createdAt);
}

// --- Efectos sobre contadores ---------------------------------------------
// { delta: {playerId: {campo: n}}, set: {playerId: {campo: bool}}, score: {own, rival} }
const emptyEffects = () => ({ delta: {}, set: {}, score: { own: 0, rival: 0 } });

function addDelta(eff, playerId, field, n) {
  eff.delta[playerId] = eff.delta[playerId] || {};
  eff.delta[playerId][field] = (eff.delta[playerId][field] || 0) + n;
}

// Efectos de que ESTA acción exista. En un ownExclusion, `data.disqualified`
// (la 3ª) también marca al jugador como expulsado.
export function effectsOf(kind, data) {
  const eff = emptyEffects();
  switch (kind) {
    case 'ownGoal': addDelta(eff, data.playerId, 'goals', 1); eff.score.own += 1; break;
    case 'ownMiss': addDelta(eff, data.playerId, 'shots', 1); break;
    case 'ownSave':
      addDelta(eff, data.playerId, 'saves', 1);
      if (data.foulPlayerId) addDelta(eff, data.foulPlayerId, 'sevenMetersCommitted', 1);
      break;
    case 'ownRecovery': addDelta(eff, data.playerId, 'recoveries', 1); break;
    case 'ownExclusion':
      addDelta(eff, data.playerId, 'exclusionsCount', 1);
      if (data.disqualified) eff.set[data.playerId] = { disqualified: true };
      break;
    case 'ownYellow': eff.set[data.playerId] = { yellowCard: true }; break;
    case 'rivalGoal':
      eff.score.rival += 1;
      // Gol rival de 7m: la falta la cometió un jugador nuestro.
      if (data.foulPlayerId) addDelta(eff, data.foulPlayerId, 'sevenMetersCommitted', 1);
      break;
    case 'rivalMiss':
      // 7m rival fallado sin parada nuestra: la falta también la cometió uno de los nuestros.
      if (data.foulPlayerId) addDelta(eff, data.foulPlayerId, 'sevenMetersCommitted', 1);
      break;
    default: break; // exclusiones, 7m y amarillas rivales: sin contador
  }
  return eff;
}

function negate(eff) {
  const out = emptyEffects();
  for (const [pid, fields] of Object.entries(eff.delta)) for (const [f, n] of Object.entries(fields)) addDelta(out, pid, f, -n);
  for (const [pid, fields] of Object.entries(eff.set)) out.set[pid] = Object.fromEntries(Object.keys(fields).map((f) => [f, false]));
  out.score = { own: -eff.score.own, rival: -eff.score.rival };
  return out;
}

// b se aplica DESPUÉS de a: si los dos fijan el mismo campo, gana b.
function mergeEffects(a, b) {
  const out = emptyEffects();
  for (const eff of [a, b]) {
    for (const [pid, fields] of Object.entries(eff.delta)) for (const [f, n] of Object.entries(fields)) addDelta(out, pid, f, n);
    for (const [pid, fields] of Object.entries(eff.set)) out.set[pid] = { ...(out.set[pid] || {}), ...fields };
    out.score.own += eff.score.own;
    out.score.rival += eff.score.rival;
  }
  return out;
}

const emptyPlan = () => ({ deletes: [], creates: [], patches: [], effects: emptyEffects(), error: null });

// --- Plan de borrar ---------------------------------------------------------
// ctx.sevenMeters: lista de rivalSevenMeters del partido (para quitar el 7m
// rival enlazado a un gol de 7m — mismo criterio que el "−1" en directo).
export function planDelete(action, ctx = {}) {
  const plan = emptyPlan();
  plan.deletes.push({ sub: ACTION_KINDS[action.kind].sub, id: action.id });
  plan.effects = negate(effectsOf(action.kind, action.data));
  if (action.kind === 'ownSave' && action.pairedMissId) plan.deletes.push({ sub: 'rivalMisses', id: action.pairedMissId });
  if (action.kind === 'ownGoal' || action.kind === 'ownMiss') {
    for (const sm of ctx.sevenMeters || []) if (sm.shotEventId === action.id) plan.deletes.push({ sub: 'rivalSevenMeters', id: sm.id });
  }
  return plan;
}

// --- Plan de corregir -------------------------------------------------------
// `changes` puede traer: playerId, number, rivalNumber, minute, shotZone,
// goalZone y, solo para gol/fallo propio, `type` ('goal' | 'miss').
// ctx.periodOf(minute) devuelve el periodo de un minuto.
export function planEdit(action, changes, ctx = {}) {
  const plan = emptyPlan();
  const { kind, data } = action;
  const fields = ACTION_KINDS[kind].fields;
  const patch = {};
  if (fields.includes('player') && changes.playerId !== undefined) patch.playerId = changes.playerId;
  if (fields.includes('number') && changes.number !== undefined) patch.number = changes.number;
  if (fields.includes('rivalNumber') && changes.rivalNumber !== undefined) patch.rivalNumber = changes.rivalNumber;
  if (fields.includes('minute') && changes.minute !== undefined) {
    patch.minute = changes.minute;
    if (ctx.periodOf) patch.period = ctx.periodOf(changes.minute);
  }
  if (fields.includes('shotZone') && changes.shotZone !== undefined) patch.shotZone = changes.shotZone || null;
  if (fields.includes('goalZone') && changes.goalZone !== undefined) patch.goalZone = changes.goalZone || null;
  if (fields.includes('foulPlayer') && changes.foulPlayerId !== undefined) patch.foulPlayerId = changes.foulPlayerId || null;

  let newKind = kind;
  if ((kind === 'ownGoal' || kind === 'ownMiss') && changes.type) {
    newKind = changes.type === 'goal' ? 'ownGoal' : 'ownMiss';
    patch.type = changes.type;
  }

  const newData = { ...data, ...patch };
  plan.effects = mergeEffects(negate(effectsOf(kind, data)), effectsOf(newKind, newData));
  plan.patches.push({ sub: ACTION_KINDS[kind].sub, id: action.id, data: patch });

  // La Parada y su Fallo rival son la misma acción: se corrigen juntos.
  if (kind === 'ownSave' && action.pairedMissId) {
    const missPatch = {};
    if (patch.rivalNumber !== undefined) missPatch.number = patch.rivalNumber;
    for (const k of ['minute', 'period', 'shotZone', 'goalZone']) if (patch[k] !== undefined) missPatch[k] = patch[k];
    if (Object.keys(missPatch).length > 0) plan.patches.push({ sub: 'rivalMisses', id: action.pairedMissId, data: missPatch });
  }
  return plan;
}

// --- Plan de añadir ---------------------------------------------------------
// values: { playerId, number, rivalNumber, minute, shotZone, goalZone,
// savedByPlayerId }. `savedByPlayerId` solo en un Fallo rival: si nuestro
// portero lo paró, se crea la Parada y su Fallo emparejados (igual que en
// directo); sin él, el tiro se fue fuera y solo cuenta para el rival.
// ctx: { players, periodOf, rivalYellowNumbers }.
export function planAdd(kind, values, ctx = {}) {
  const plan = emptyPlan();
  const minute = Number(values.minute);
  const period = ctx.periodOf ? ctx.periodOf(minute) : 1;
  const createdAt = Date.now();
  const zones = { shotZone: values.shotZone || null, goalZone: values.goalZone || null };
  const base = { minute, period, createdAt };

  if (kind === 'rivalMiss' && values.savedByPlayerId) {
    return planAdd('ownSave', { ...values, playerId: values.savedByPlayerId, rivalNumber: values.number }, ctx);
  }

  let created = null;
  switch (kind) {
    case 'ownGoal': created = { sub: 'shotEvents', data: { playerId: values.playerId, type: 'goal', ...base, ...zones } }; break;
    case 'ownMiss': created = { sub: 'shotEvents', data: { playerId: values.playerId, type: 'miss', ...base, ...zones } }; break;
    case 'ownSave': {
      const rivalNumber = values.rivalNumber ? Number(values.rivalNumber) : null;
      plan.creates.push({ sub: 'saveEvents', idFromPair: true, data: { playerId: values.playerId, rivalNumber, pairId: '$pair', ...base, ...zones } });
      plan.creates.push({ sub: 'rivalMisses', data: { number: rivalNumber, pairId: '$pair', ...base, ...zones } });
      plan.effects = effectsOf('ownSave', { playerId: values.playerId });
      return plan;
    }
    case 'ownRecovery': created = { sub: 'recoveryEvents', data: { playerId: values.playerId, ...base } }; break;
    case 'ownExclusion': {
      const count = ctx.players?.[values.playerId]?.exclusionsCount || 0;
      created = { sub: 'exclusionEvents', data: { playerId: values.playerId, disqualified: count + 1 >= 3, ...base } };
      break;
    }
    case 'ownYellow':
      if (ctx.players?.[values.playerId]?.yellowCard) {
        plan.error = 'Ese jugador ya tiene tarjeta amarilla en este partido.';
        return plan;
      }
      created = { sub: 'yellowCardEvents', data: { playerId: values.playerId, ...base } };
      break;
    case 'rivalGoal': created = { sub: 'rivalGoals', data: { number: Number(values.number), foulPlayerId: values.foulPlayerId || null, ...base, ...zones } }; break;
    case 'rivalMiss': created = { sub: 'rivalMisses', data: { number: values.number ? Number(values.number) : null, ...base, ...zones } }; break;
    case 'rivalExclusion': created = { sub: 'rivalExclusions', data: { number: Number(values.number), ...base, endsAtMs: createdAt } }; break;
    case 'rivalSevenMeter': created = { sub: 'rivalSevenMeters', data: { number: Number(values.number), shotEventId: null, ...base } }; break;
    case 'rivalYellow':
      if ((ctx.rivalYellowNumbers || []).includes(Number(values.number))) {
        plan.error = `El dorsal #${values.number} ya tiene tarjeta amarilla en este partido.`;
        return plan;
      }
      created = { sub: 'rivalYellowCards', data: { number: Number(values.number), ...base } };
      break;
    default:
      plan.error = 'Tipo de acción desconocido.';
      return plan;
  }
  plan.creates.push(created);
  plan.effects = effectsOf(kind, created.data);
  return plan;
}

// Validación común de los valores de un formulario de añadir/corregir.
export function validateActionValues(kind, values, { requireAll = true } = {}) {
  const fields = ACTION_KINDS[kind].fields;
  if (fields.includes('minute') && (requireAll || values.minute !== undefined)) {
    const m = Number(values.minute);
    if (!Number.isInteger(m) || m < 1) return 'El minuto tiene que ser un número entero desde 1.';
  }
  if (fields.includes('player') && requireAll && !values.playerId) return 'Elige el jugador.';
  const numberRequired = ['rivalGoal', 'rivalExclusion', 'rivalSevenMeter', 'rivalYellow'].includes(kind);
  if (fields.includes('number') && numberRequired && (requireAll || values.number !== undefined)) {
    const n = Number(values.number);
    if (!values.number || !Number.isInteger(n) || n < 0) return 'Escribe el dorsal del rival.';
  }
  return null;
}

// Pasa un plan a valores absolutos: nuevos contadores de cada jugador y
// nuevo marcador, partiendo de los actuales (nunca por debajo de 0).
export function resolveCounters(effects, players, score) {
  const playerUpdates = {};
  for (const [pid, fields] of Object.entries(effects.delta)) {
    playerUpdates[pid] = playerUpdates[pid] || {};
    for (const [f, n] of Object.entries(fields)) playerUpdates[pid][f] = Math.max(0, (players[pid]?.[f] || 0) + n);
  }
  for (const [pid, fields] of Object.entries(effects.set)) {
    playerUpdates[pid] = { ...(playerUpdates[pid] || {}), ...fields };
  }
  const scoreUpdate = {};
  if (effects.score.own) scoreUpdate['score.own'] = Math.max(0, (score?.own || 0) + effects.score.own);
  if (effects.score.rival) scoreUpdate['score.rival'] = Math.max(0, (score?.rival || 0) + effects.score.rival);
  // Un campo que quedaría igual (p. ej. +1 y −1 del mismo contador) no se escribe.
  for (const [pid, fields] of Object.entries(playerUpdates)) {
    for (const f of Object.keys(fields)) if (fields[f] === (players[pid]?.[f] ?? (typeof fields[f] === 'boolean' ? false : 0))) delete fields[f];
    if (Object.keys(fields).length === 0) delete playerUpdates[pid];
  }
  return { playerUpdates, scoreUpdate };
}

// Descripción corta de una acción para la lista.
export function describeAction(action, playersById) {
  const { kind, data } = action;
  const p = data.playerId ? playersById[data.playerId] : null;
  const who = p ? `#${p.number} ${p.name}` : data.playerId ? '(jugador desconocido)' : null;
  const rivalNo = (n) => (n != null ? `#${n}` : '#?');
  const zones = [data.shotZone, data.goalZone].filter(Boolean).join(' → ');
  switch (kind) {
    case 'ownGoal': case 'ownMiss': case 'ownRecovery': case 'ownYellow':
      return { title: `${ACTION_KINDS[kind].label} — ${who}`, detail: zones };
    case 'ownExclusion': return { title: `${data.disqualified ? 'Roja (3ª exclusión)' : 'Exclusión'} — ${who}`, detail: '' };
    case 'ownSave': return { title: `Parada — ${who}`, detail: [data.rivalNumber != null ? `tiró ${rivalNo(data.rivalNumber)}` : null, zones].filter(Boolean).join(' · ') };
    case 'rivalGoal': case 'rivalMiss': {
      const foul = kind === 'rivalGoal' && data.foulPlayerId && playersById[data.foulPlayerId];
      return { title: `${ACTION_KINDS[kind].label} — ${rivalNo(data.number)}`, detail: [zones, foul ? `falta de #${foul.number} ${foul.name}` : null].filter(Boolean).join(' · ') };
    }
    default: return { title: `${ACTION_KINDS[kind].label} — ${rivalNo(data.number)}`, detail: '' };
  }
}
