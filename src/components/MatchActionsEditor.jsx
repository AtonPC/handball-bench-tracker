import { useMemo, useState } from 'react';
import { ArrowUpDown, Trash2 } from 'lucide-react';
import { GOAL_ZONES, missKindOf, OUT_ZONES, POST_ZONES, SHOT_ZONES } from '../shotZones';
import { shortTeamName } from '../utils/teamColors';
import { periodLongLabel, periodOfMinute, withPeriodDividers } from '../utils/periods';
import EventIcon from './EventIcon';
import {
  ACTION_KINDS, buildActionList, describeAction, planAdd, planDelete, planEdit, validateActionValues,
} from '../utils/actionEditing';

const OWN_KINDS = ['ownGoal', 'ownMiss', 'ownSave', 'ownRecovery', 'ownExclusion', 'ownYellow'];
const RIVAL_KINDS = ['rivalGoal', 'rivalMiss', 'rivalExclusion', 'rivalSevenMeter', 'rivalYellow'];

// Icono, quién y etiqueta de una fila — igual que ChronologyRow (Cronología), para que
// la lista de aquí se lea igual (2026-09-23, a petición del usuario: "quiero se parezca
// a la cronología"). No se reutiliza ChronologyRow tal cual porque trabaja con la forma
// de un suceso de Cronología (type/side sueltos, missKind ya calculado); aquí la acción
// trae su propio `kind` (ya lleva el equipo dentro, ownGoal/rivalGoal...) y sin missKind.
function actionIconType(action) {
  const { kind, data } = action;
  switch (kind) {
    case 'ownGoal': case 'rivalGoal': return 'goal';
    case 'ownMiss': case 'rivalMiss': return missKindOf(data.goalZone) === 'saved' ? 'miss-saved' : 'miss-out';
    case 'ownSave': return 'save';
    case 'ownRecovery': return 'recovery';
    case 'ownExclusion': return data.disqualified ? 'card-red' : 'twoFingers';
    case 'rivalExclusion': return data.red ? 'card-red' : 'twoFingers';
    case 'ownYellow': case 'rivalYellow': return 'card-yellow';
    case 'rivalSevenMeter': return 'sevenMeter';
    default: return null;
  }
}
function actionWho(action, playersById) {
  const { kind, data } = action;
  if (ACTION_KINDS[kind].side === 'own') {
    const p = data.playerId ? playersById[data.playerId] : null;
    return p ? `#${p.number} ${p.name}` : null;
  }
  return data.number != null ? `Rival #${data.number}` : null;
}
// «Gol rival» → «Gol»: el lado ya se ve por la posición (izquierda/derecha), como en
// Cronología — decirlo dos veces sobraba.
function actionLabel(action) {
  if (action.kind === 'ownExclusion') return action.data.disqualified ? 'Roja (3ª exclusión)' : 'Exclusión';
  return ACTION_KINDS[action.kind].label.replace(/ rival$/i, '');
}

// Formulario común de corregir/añadir una acción: solo enseña los campos
// que tiene ese tipo de acción.
function ActionForm({ kind, initial, players, isAdd, onSubmit, onCancel }) {
  const [values, setValues] = useState(initial);
  const set = (field, value) => setValues((v) => ({ ...v, [field]: value }));
  const fields = ACTION_KINDS[kind].fields;
  const isShotKind = kind === 'ownGoal' || kind === 'ownMiss';
  // Un fallo puede irse fuera (3 zonas más) o dar en un palo/el larguero (3 más); un gol o una parada no.
  const effectiveMiss = kind === 'ownMiss' ? values.type !== 'goal' : kind === 'ownGoal' ? values.type === 'miss' : kind === 'rivalMiss';
  const goalZones = effectiveMiss ? [...GOAL_ZONES, ...OUT_ZONES, ...POST_ZONES] : GOAL_ZONES;
  const goalkeepersFirst = [...players].sort((a, b) => Number(!!b.isGK) - Number(!!a.isGK) || (a.number ?? 0) - (b.number ?? 0));

  return (
    <form className="player-form act-form" onSubmit={(e) => { e.preventDefault(); onSubmit(values); }}>
      {fields.includes('player') && (
        <select className="player-form-input" value={values.playerId || ''} onChange={(e) => set('playerId', e.target.value)} required>
          <option value="">Jugador…</option>
          {players.map((p) => <option key={p.id} value={p.id}>#{p.number} {p.name}{p.isGK ? ' (P)' : ''}</option>)}
        </select>
      )}
      {fields.includes('number') && (
        <input className="player-form-input player-form-input--number" type="number" min="0" placeholder="Dorsal rival"
          value={values.number ?? ''} onChange={(e) => set('number', e.target.value)} />
      )}
      {fields.includes('rivalNumber') && (
        <input className="player-form-input player-form-input--number" type="number" min="0" placeholder="Dorsal que tiró (opcional)"
          value={values.rivalNumber ?? ''} onChange={(e) => set('rivalNumber', e.target.value)} />
      )}
      {fields.includes('minute') && (
        <input className="player-form-input player-form-input--number" type="number" min="1" placeholder="Minuto"
          value={values.minute ?? ''} onChange={(e) => set('minute', e.target.value)} required />
      )}
      {isShotKind && !isAdd && (
        <select className="player-form-input" value={values.type} onChange={(e) => set('type', e.target.value)}>
          <option value="goal">Fue gol</option>
          <option value="miss">Fue fallo</option>
        </select>
      )}
      {fields.includes('shotZone') && (
        <select className="player-form-input" value={values.shotZone || ''} onChange={(e) => set('shotZone', e.target.value)}>
          <option value="">Zona de lanzamiento (opcional)</option>
          {SHOT_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      )}
      {fields.includes('goalZone') && (
        <select className="player-form-input" value={values.goalZone || ''} onChange={(e) => set('goalZone', e.target.value)}>
          <option value="">{effectiveMiss ? 'Por dónde falló (opcional)' : 'Zona de portería (opcional)'}</option>
          {goalZones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      )}
      {fields.includes('foulPlayer') && (
        <select className="player-form-input" value={values.foulPlayerId || ''} onChange={(e) => set('foulPlayerId', e.target.value)}>
          <option value="">Falta del 7m: nadie / no aplica</option>
          {players.map((p) => <option key={p.id} value={p.id}>Falta del 7m: #{p.number} {p.name}</option>)}
        </select>
      )}
      {isAdd && kind === 'rivalMiss' && (
        <select className="player-form-input" value={values.savedByPlayerId || ''} onChange={(e) => set('savedByPlayerId', e.target.value)}>
          <option value="">Se fue fuera (no lo paró nadie)</option>
          {goalkeepersFirst.map((p) => <option key={p.id} value={p.id}>Lo paró #{p.number} {p.name}{p.isGK ? ' (P)' : ''}</option>)}
        </select>
      )}
      <div className="player-form-actions">
        <button className="btn btn-clock btn-start" type="submit">{isAdd ? 'AÑADIR' : 'GUARDAR CAMBIOS'}</button>
        <button className="btn btn-timeout" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function initialValues(kind, action) {
  if (!action) return { type: kind === 'ownGoal' ? 'goal' : 'miss' };
  const d = action.data;
  return {
    playerId: d.playerId || '', foulPlayerId: d.foulPlayerId || '', number: d.number ?? '', rivalNumber: d.rivalNumber ?? '', minute: d.minute ?? '',
    shotZone: d.shotZone || '', goalZone: d.goalZone || '',
    type: kind === 'ownGoal' ? 'goal' : 'miss',
  };
}

// Normaliza lo que escribe el formulario (todo llega como texto).
function normalize(values) {
  const out = { ...values };
  if (out.minute !== undefined && out.minute !== '') out.minute = Number(out.minute);
  if (out.number !== undefined) out.number = out.number === '' || out.number == null ? null : Number(out.number);
  if (out.rivalNumber !== undefined) out.rivalNumber = out.rivalNumber === '' || out.rivalNumber == null ? null : Number(out.rivalNumber);
  return out;
}

// Todas las acciones de un partido finalizado, por minuto, para corregir lo
// que se anotó mal en directo: borrar, cambiar jugador/minuto/zonas, o añadir
// una olvidada. Cada operación ajusta a la vez el detalle, los contadores de
// los jugadores y el marcador (ver utils/actionEditing.js).
export default function MatchActionsEditor({ state, players, lists, applyPlan }) {
  const [side, setSide] = useState('all');
  // Más recientes primero por defecto (2026-09-23): al corregir en directo, lo normal
  // es que el error esté en lo último anotado — con la flecha se puede invertir para
  // repasar el partido entero desde el principio.
  const [newestFirst, setNewestFirst] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addKind, setAddKind] = useState('ownGoal');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const actions = useMemo(() => buildActionList(lists), [lists]);
  const filtered = actions.filter((a) => side === 'all' || ACTION_KINDS[a.kind].side === side);
  const visible = newestFirst ? [...filtered].reverse() : filtered;
  // Nombre real de cada equipo en vez de «Nuestro equipo»/«Rival» a secas (2026-09-23).
  const ownLabel = shortTeamName(state.ownTeamName, 24);
  const rivalLabel = shortTeamName(state.rivalName, 24);

  const { periodDurationMs, periodCount } = state.clock;
  const periodOf = (minute) => periodOfMinute(minute, periodDurationMs, periodCount);
  const ctx = {
    players: state.players,
    periodOf,
    sevenMeters: lists.rivalSevenMeters,
    rivalYellowNumbers: lists.rivalYellowCards.map((y) => y.number),
  };
  // Separadores de fin/inicio de cuarto o tiempo entre las acciones (2026-09-23).
  const rows = withPeriodDividers(visible, (a) => a.minute, periodDurationMs, periodCount);

  async function run(plan) {
    if (plan.error) { setError(plan.error); return false; }
    setBusy(true);
    setError('');
    try {
      await applyPlan(plan, { players: state.players, score: state.score });
      return true;
    } catch (err) {
      console.error('No se pudo guardar la corrección', err);
      setError(`No se pudo guardar: ${err.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(action) {
    const d = describeAction(action, playersById);
    const extra = action.kind === 'ownSave' ? ' Se quitará también su fallo rival emparejado.'
      : action.kind === 'ownGoal' ? ' Se ajustarán el marcador y las estadísticas del jugador (y el 7 metros rival enlazado, si lo tiene).'
        : ' Se ajustarán los contadores que correspondan.';
    if (!confirm(`¿Borrar «${action.minute}' ${d.title}»?${extra}`)) return;
    await run(planDelete(action, ctx));
  }

  async function handleEdit(action, values) {
    const v = normalize(values);
    const problem = validateActionValues(action.kind, v);
    if (problem) { setError(problem); return; }
    const changes = { ...v };
    if (action.kind !== 'ownGoal' && action.kind !== 'ownMiss') delete changes.type;
    if (await run(planEdit(action, changes, ctx))) setEditingKey(null);
  }

  async function handleAdd(values) {
    const v = normalize(values);
    const problem = validateActionValues(addKind, v);
    if (problem) { setError(problem); return; }
    if (await run(planAdd(addKind, v, ctx))) setAdding(false);
  }

  return (
    <>
      <div className="matches-header">
        <h3 className="stats-section-title" style={{ margin: 0 }}>Acciones del partido</h3>
        <button className="btn btn-clock btn-start" onClick={() => { setAdding((v) => !v); setEditingKey(null); setError(''); }}>
          {adding ? 'CANCELAR' : '+ AÑADIR ACCIÓN'}
        </button>
      </div>
      <p className="modal-hint">
        Corrige lo que se anotó mal en directo: borra una acción, cambia su jugador, minuto o zonas, o añade una
        olvidada. Cada cambio ajusta a la vez la cronología, las zonas, las estadísticas del jugador y el marcador.
        Una parada y su fallo rival son la misma acción: se corrigen juntos.
      </p>
      {error && <p className="warning-banner">{error}</p>}

      {adding && (
        <div className="act-add">
          <select className="player-form-input" value={addKind} onChange={(e) => setAddKind(e.target.value)}>
            <optgroup label={ownLabel}>
              {OWN_KINDS.map((k) => <option key={k} value={k}>{ACTION_KINDS[k].label}</option>)}
            </optgroup>
            <optgroup label={rivalLabel}>
              {RIVAL_KINDS.map((k) => <option key={k} value={k}>{ACTION_KINDS[k].label}</option>)}
            </optgroup>
          </select>
          <ActionForm key={addKind} kind={addKind} initial={initialValues(addKind, null)} players={players} isAdd onSubmit={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="act-toolbar">
        <div className="home-away-toggle att-toggle">
          {[['all', 'Todas'], ['own', ownLabel], ['rival', rivalLabel]].map(([key, label]) => (
            <button key={key} type="button" className={`btn btn-timeout${side === key ? ' admin-nav-tab--active' : ''}`} onClick={() => setSide(key)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-timeout act-sort-btn" onClick={() => setNewestFirst((v) => !v)}>
          <ArrowUpDown size={14} /> {newestFirst ? 'Recientes primero' : 'Antiguas primero'}
        </button>
      </div>

      <div className="chrono-rows act-crows">
        {rows.map((row) => {
          if (row.divider) {
            return (
              <div key={row.key} className="chrono-divider">
                <span>Fin {periodLongLabel(row.lo, periodCount)} · Inicio {periodLongLabel(row.hi, periodCount)}</span>
              </div>
            );
          }
          const action = row.item;
          const isOwn = ACTION_KINDS[action.kind].side === 'own';
          const who = actionWho(action, playersById);
          const label = actionLabel(action);
          const iconType = actionIconType(action);
          const editing = editingKey === action.key;
          return (
            <div key={action.key} className="act-crow-wrap">
              <div
                className={`chrono-row act-crow${isOwn ? '' : ' chrono-row--rival'}${editing ? ' act-crow--editing' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => { setEditingKey(editing ? null : action.key); setAdding(false); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingKey(editing ? null : action.key); } }}
              >
                <div className="chrono-row-side">
                  {isOwn && (
                    <>
                      {iconType && <span className="chrono-row-icon"><EventIcon type={iconType} /></span>}
                      <span className="chrono-row-text">
                        {who && <span className="chrono-row-who">{who}</span>}
                        <span className="chrono-row-label">{label}</span>
                      </span>
                    </>
                  )}
                </div>
                <div className="chrono-row-mid">
                  <span className="chrono-row-minute">{action.minute}&apos;</span>
                </div>
                <div className="chrono-row-side chrono-row-side--rival">
                  {!isOwn && (
                    <>
                      <span className="chrono-row-text chrono-row-text--rival">
                        {who && <span className="chrono-row-who">{who}</span>}
                        <span className="chrono-row-label">{label}</span>
                      </span>
                      {iconType && <span className="chrono-row-icon"><EventIcon type={iconType} /></span>}
                    </>
                  )}
                </div>
              </div>
              {editing && (
                <div className="act-crow-edit">
                  <ActionForm
                    kind={action.kind}
                    initial={initialValues(action.kind, action)}
                    players={players}
                    onSubmit={(values) => handleEdit(action, values)}
                    onCancel={() => setEditingKey(null)}
                  />
                  <button type="button" className="act-crow-del" disabled={busy} onClick={() => handleDelete(action)}>
                    <Trash2 size={16} /> Borrar esta acción
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <p className="modal-hint">No hay acciones registradas con detalle en este partido.</p>}
      </div>
    </>
  );
}
