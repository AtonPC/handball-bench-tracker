import { useMemo, useState } from 'react';
import { CalendarClock, ChevronRight, History, Plus, Settings, Trash2, X } from 'lucide-react';
import { findLastVenueForRival, useMatches } from '../hooks/useMatches';
import { usePlayers } from '../hooks/usePlayers';
import { addRivalTeam, useRivalTeams } from '../hooks/useTeams';
import { useLeagues } from '../hooks/useLeagues';
import { useClubs } from '../hooks/useClubs';
import { useAuth } from '../hooks/useAuth';
import { teamInitials } from '../utils/teamColors';
import { parseRivalDorsals } from '../utils/rivalDorsals';
import { PERIOD_FORMATS, periodCountOf, periodFormatOf, periodLongLabel } from '../utils/periods';
import { LINEUP_SIZE } from '../utils/lineups';
import { CATEGORIES } from '../categories';
import LineupBoard from './LineupBoard';

const LIFECYCLE_LABELS = { scheduled: 'Programado', live: 'En directo', finished: 'Finalizado' };
const emptyForm = { rivalTeamId: '', rivalName: '', isHome: true, venue: '', scheduledAt: '', periodFormat: 'halves', periodDurationMinutes: PERIOD_FORMATS.halves.minutes, alevinRules: false, jornada: '', rivalCrestUrl: '', rivalDorsalsText: '' };
const emptyRivalClubForm = { clubName: '', teamName: '', category: CATEGORIES[0], leagueId: '', crestUrl: '' };

// Campo con su etiqueta SIEMPRE visible encima — mismo patrón que Plantilla/Club.
function Field({ label, children }) {
  return (
    <label className="pf-field">
      <span className="pf-label">{label}</span>
      {children}
    </label>
  );
}

function formatMatchDateTime(ms) {
  if (!ms) return 'Sin fecha';
  const d = new Date(ms);
  const date = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

// Filtros de rival/lugar/fecha — se usan igual en "Partidos programados" y en
// "Partidos finalizados" (2026-09-26, tras separarlos en dos pantallas).
function MatchFilters({ filters, setFilters, pastRivals }) {
  return (
    <div className="list-filters">
      <input
        className="player-form-input"
        list="rival-names"
        placeholder="Filtrar por rival…"
        value={filters.rival}
        onChange={(e) => setFilters({ ...filters, rival: e.target.value })}
      />
      <datalist id="rival-names">
        {pastRivals.map((name) => <option key={name} value={name} />)}
      </datalist>
      <input
        className="player-form-input"
        placeholder="Filtrar por lugar…"
        value={filters.venue}
        onChange={(e) => setFilters({ ...filters, venue: e.target.value })}
      />
      <input
        className="player-form-input"
        type="date"
        value={filters.dateFrom}
        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
      />
      <input
        className="player-form-input"
        type="date"
        value={filters.dateTo}
        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
      />
    </div>
  );
}

export default function MatchesAdmin({ clubId, teamId, ownTeamName, ownCrestUrl, canManageRoster, canUseBench, onOpenMatch, onOpenStats, onEditFinishedStats }) {
  const { matches, createMatch, updateMatch, removeMatch, startMatch } = useMatches(clubId, teamId);
  const { players } = usePlayers(clubId, teamId);
  const rivalTeams = useRivalTeams();
  const { leagues } = useLeagues(true);
  const { addClubAsManager } = useClubs(false);
  const { user } = useAuth();

  // null (menú de 3 botones + partidos en directo) | 'create' (crear/editar un
  // partido) | 'scheduled' (Partidos programados) | 'finished' (Partidos
  // finalizados) — 2026-09-26, mismo patrón de pantallas que Plantilla/Club.
  const [screen, setScreen] = useState(null);
  // A qué pantalla volver al cerrar/guardar el formulario de partido: null (se
  // abrió desde el menú) o 'scheduled' (se abrió editando desde esa lista).
  const [createFrom, setCreateFrom] = useState(null);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  // Las 3 secciones del formulario de partido, como pestañas (2026-09-26, a
  // petición del usuario) — antes era un único formulario larguísimo con todo
  // seguido.
  const [formSection, setFormSection] = useState('details'); // 'details' | 'callup' | 'lineup'
  // Fichar un club rival nuevo al crear el partido — mismo flujo que "Rivales
  // del club" en ClubAdmin.jsx, en un modal aparte encima del formulario.
  const [showNewRivalClub, setShowNewRivalClub] = useState(false);
  const [rivalClubForm, setRivalClubForm] = useState(emptyRivalClubForm);
  const [rivalClubBusy, setRivalClubBusy] = useState(false);
  const [rivalClubError, setRivalClubError] = useState('');
  const [callUpIds, setCallUpIds] = useState([]);
  // Equipo titular como un tablero de 7 (el índice 0 el portero, el resto en
  // el orden fijo de LineupBoard.jsx) — mismo formato que ya usa `lineups` del
  // partido en directo, así que editar el partido y "Equipo titular" entre
  // periodos comparten componente y no hace falta tocar el esquema.
  const [boardIds, setBoardIds] = useState(Array(LINEUP_SIZE).fill(''));
  const [callUpSearch, setCallUpSearch] = useState('');

  const rosterById = useMemo(() => {
    const map = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);

  const visibleCallUpPlayers = useMemo(() => {
    const needle = callUpSearch.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((p) => {
      const haystack = `${p.firstName || ''} ${p.lastName || ''} ${p.displayName || ''} ${p.number ?? ''}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [players, callUpSearch]);

  const pastRivals = useMemo(() => [...new Set(matches.map((m) => m.rivalName).filter(Boolean))], [matches]);

  const [filters, setFilters] = useState({ rival: '', venue: '', dateFrom: '', dateTo: '' });
  const filteredMatches = useMemo(() => {
    const rivalNeedle = filters.rival.trim().toLowerCase();
    const venueNeedle = filters.venue.trim().toLowerCase();
    const fromMs = filters.dateFrom ? new Date(filters.dateFrom).setHours(0, 0, 0, 0) : null;
    const toMs = filters.dateTo ? new Date(filters.dateTo).setHours(23, 59, 59, 999) : null;
    return matches.filter((m) => {
      if (rivalNeedle && !(m.rivalName || '').toLowerCase().includes(rivalNeedle)) return false;
      if (venueNeedle && !(m.venue || '').toLowerCase().includes(venueNeedle)) return false;
      if (fromMs && (!m.scheduledAt || m.scheduledAt < fromMs)) return false;
      if (toMs && (!m.scheduledAt || m.scheduledAt > toMs)) return false;
      return true;
    });
  }, [matches, filters]);

  const liveMatches = useMemo(() => filteredMatches.filter((m) => m.lifecycle === 'live'), [filteredMatches]);
  const scheduledMatches = useMemo(() => filteredMatches.filter((m) => m.lifecycle === 'scheduled'), [filteredMatches]);
  const finishedMatches = useMemo(() => filteredMatches.filter((m) => m.lifecycle === 'finished'), [filteredMatches]);
  const allScheduledCount = useMemo(() => matches.filter((m) => m.lifecycle === 'scheduled').length, [matches]);
  const allFinishedCount = useMemo(() => matches.filter((m) => m.lifecycle === 'finished').length, [matches]);

  // Un partido "en juego" no se puede borrar — no entra en la selección
  // masiva, se muestra aparte (en el menú) en su propia tarjeta.
  const [selectedMatchIds, setSelectedMatchIds] = useState([]);

  function toggleMatchSelect(id) {
    setSelectedMatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllMatches(list) {
    setSelectedMatchIds(list.map((m) => m.id));
  }

  function deselectAllMatches() {
    setSelectedMatchIds([]);
  }

  async function handleBulkDelete() {
    const hasFinished = selectedMatchIds.some((id) => matches.find((m) => m.id === id)?.lifecycle === 'finished');
    const message = hasFinished
      ? `¿Borrar ${selectedMatchIds.length} partido(s)? Los finalizados perderán sus estadísticas y no se puede deshacer.`
      : `¿Borrar ${selectedMatchIds.length} partido(s) programado(s)?`;
    if (!confirm(message)) return;
    for (const id of selectedMatchIds) {
      await removeMatch(id);
    }
    setSelectedMatchIds([]);
  }

  // Editar solo tiene sentido con un partido marcado a la vez (cada uno
  // tiene su propio rival/convocatoria) — decidido explícitamente con el
  // usuario. Borrar (arriba) sí admite varios a la vez.
  function editSelectedMatch() {
    if (selectedMatchIds.length !== 1) return;
    const m = matches.find((x) => x.id === selectedMatchIds[0]);
    if (!m) return;
    setSelectedMatchIds([]);
    if (m.lifecycle === 'finished') {
      onEditFinishedStats(m.id);
    } else {
      startEdit(m);
    }
  }

  function toggleCallUp(id) {
    const isRemoving = callUpIds.includes(id);
    setCallUpIds((prev) => (isRemoving ? prev.filter((x) => x !== id) : [...prev, id]));
    if (isRemoving) {
      // Si se quita de la convocatoria, no puede seguir de titular.
      setBoardIds((prev) => prev.map((x) => (x === id ? '' : x)));
    }
  }

  function callUpAll() {
    setCallUpIds(players.map((p) => p.id));
  }

  function callUpNone() {
    setCallUpIds([]);
    setBoardIds(Array(LINEUP_SIZE).fill(''));
  }

  // Elegir un rival de la lista: rellena nombre/escudo desde su ficha y, si el
  // lugar todavía no se ha tocado, propone el último sitio donde se jugó contra él
  // (antes esto pasaba al salir del campo de texto — handleRivalBlur; ahora al
  // elegir de la lista, que es el único momento en que cambia el rival).
  function selectRivalTeam(rivalTeamId) {
    const t = rivalTeams.find((r) => r.id === rivalTeamId);
    setForm((f) => ({
      ...f,
      rivalTeamId,
      rivalName: t?.name || '',
      rivalCrestUrl: t?.crestUrl || '',
      venue: f.venue || findLastVenueForRival(matches, t?.name || '') || f.venue,
    }));
  }

  async function handleCreateRivalClub(e) {
    e.preventDefault();
    if (!rivalClubForm.clubName.trim()) return;
    setRivalClubBusy(true);
    setRivalClubError('');
    try {
      const clubRef = await addClubAsManager(rivalClubForm.clubName.trim(), user.uid);
      const teamName = (rivalClubForm.teamName || rivalClubForm.clubName).trim();
      const teamRef = await addRivalTeam(clubRef.id, {
        name: teamName,
        category: rivalClubForm.category,
        leagueId: rivalClubForm.leagueId || null,
        crestUrl: rivalClubForm.crestUrl.trim(),
      });
      // rivalTeams (onSnapshot) todavía no ha llegado con el equipo recién creado —
      // se rellena el formulario a mano con lo que se acaba de escribir, en vez de
      // depender de selectRivalTeam (que lo buscaría en una lista que aún no lo tiene).
      setForm((f) => ({
        ...f,
        rivalTeamId: teamRef.id,
        rivalName: teamName,
        rivalCrestUrl: rivalClubForm.crestUrl.trim(),
        venue: f.venue || findLastVenueForRival(matches, teamName) || f.venue,
      }));
      setRivalClubForm(emptyRivalClubForm);
      setShowNewRivalClub(false);
    } catch (err) {
      console.error('No se pudo fichar el club rival', err);
      setRivalClubError(`No se pudo crear: ${err.message}`);
    } finally {
      setRivalClubBusy(false);
    }
  }

  function openCreate() {
    setEditingMatchId(null);
    setForm(emptyForm);
    setCallUpIds([]);
    setBoardIds(Array(LINEUP_SIZE).fill(''));
    setFormSection('details');
    setCreateFrom(screen === 'scheduled' ? 'scheduled' : null);
    setScreen('create');
  }

  function startEdit(m) {
    setEditingMatchId(m.id);
    setForm({
      rivalTeamId: m.rivalTeamId || '',
      rivalName: m.rivalName || '',
      isHome: m.isHome ?? true,
      venue: m.venue || '',
      scheduledAt: m.scheduledAt ? new Date(m.scheduledAt).toISOString().slice(0, 16) : '',
      periodFormat: periodFormatOf(m),
      alevinRules: !!m.alevinRules,
      periodDurationMinutes: m.periodDurationMs ? m.periodDurationMs / 60000 : PERIOD_FORMATS[periodFormatOf(m)].minutes,
      jornada: m.jornada ?? '',
      rivalCrestUrl: m.rivalCrestUrl || '',
      rivalDorsalsText: (m.rivalDorsals || []).join(', '),
    });
    setCallUpIds(m.callUpPlayerIds || []);
    // El portero siempre en el índice 0 — el resto, en el orden en que ya
    // estuvieran guardados (partidos de antes de LineupBoard no tienen una
    // posición real por puesto, así que es solo un punto de partida razonable).
    const gk = m.startingGoalkeeperId || '';
    const rest = (m.startingLineupIds || []).filter((id) => id !== gk);
    setBoardIds([gk, ...rest, ...Array(LINEUP_SIZE).fill('')].slice(0, LINEUP_SIZE));
    setFormSection('details');
    setCreateFrom('scheduled');
    setScreen('create');
  }

  function cancelForm() {
    setEditingMatchId(null);
    setForm(emptyForm);
    setCallUpIds([]);
    setBoardIds(Array(LINEUP_SIZE).fill(''));
    setShowNewRivalClub(false);
    setRivalClubForm(emptyRivalClubForm);
    setRivalClubError('');
    setScreen(createFrom);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.rivalName || callUpIds.length === 0) return;
    const data = {
      rivalTeamId: form.rivalTeamId || null,
      rivalName: form.rivalName.trim(),
      isHome: form.isHome,
      venue: form.venue.trim(),
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).getTime() : Date.now(),
      ownTeamName,
      jornada: form.jornada === '' ? null : Number(form.jornada),
      rivalCrestUrl: form.rivalCrestUrl.trim(),
      rivalDorsals: parseRivalDorsals(form.rivalDorsalsText),
      callUpPlayerIds: callUpIds,
      startingLineupIds: boardIds.filter(Boolean),
      startingGoalkeeperId: boardIds[0] || null,
      periodCount: PERIOD_FORMATS[form.periodFormat].count,
      alevinRules: form.periodFormat === 'quarters' && form.alevinRules,
      periodDurationMs: (Number(form.periodDurationMinutes) || PERIOD_FORMATS[form.periodFormat].minutes) * 60000,
    };
    if (editingMatchId) {
      await updateMatch(editingMatchId, data);
    } else {
      await createMatch(data);
    }
    setEditingMatchId(null);
    setForm(emptyForm);
    setCallUpIds([]);
    setBoardIds(Array(LINEUP_SIZE).fill(''));
    setShowNewRivalClub(false);
    setRivalClubForm(emptyRivalClubForm);
    setRivalClubError('');
    setScreen('scheduled');
  }

  async function handleStart(m) {
    if (!m.startingLineupIds || m.startingLineupIds.length !== 7) {
      alert('No se puede iniciar el partido: edita el partido y elige los 7 titulares primero.');
      return;
    }
    if (!m.startingGoalkeeperId) {
      alert('No se puede iniciar el partido: edita el partido y elige quién es el portero primero.');
      return;
    }
    try {
      await startMatch(m.id, m.callUpPlayerIds, rosterById, m.startingLineupIds, m.startingGoalkeeperId);
      onOpenMatch(m.id);
    } catch (err) {
      console.error('No se pudo iniciar el partido', err);
      alert(`No se pudo iniciar el partido: ${err.message}`);
    }
  }

  const matchForm = (
    <form className="player-form" onSubmit={handleSubmit}>
      <p className="modal-hint">Mi equipo: <strong>{ownTeamName}</strong></p>

      {/* 3 pestañas en vez de un único formulario larguísimo (2026-09-26, a
          petición del usuario) — cada una se abre por separado, con sus
          propios campos. */}
      <div className="home-away-toggle match-form-tabs">
        <button type="button" className={`btn btn-timeout${formSection === 'details' ? ' admin-nav-tab--active' : ''}`} onClick={() => setFormSection('details')}>
          Detalles del partido
        </button>
        <button type="button" className={`btn btn-timeout${formSection === 'callup' ? ' admin-nav-tab--active' : ''}`} onClick={() => setFormSection('callup')}>
          Convocados{callUpIds.length > 0 ? ` (${callUpIds.length})` : ''}
        </button>
        <button type="button" className={`btn btn-timeout${formSection === 'lineup' ? ' admin-nav-tab--active' : ''}`} onClick={() => setFormSection('lineup')}>
          Alineación titular{boardIds.filter(Boolean).length > 0 ? ` (${boardIds.filter(Boolean).length}/7)` : ''}
        </button>
      </div>

      {formSection === 'details' && (
        <>
          <Field label="Equipo rival">
            {/* Sin `required`: un partido de antes de esto puede tener rival (rivalName)
                sin una ficha de equipo en la lista — no hace falta re-elegirlo para
                poder guardar el resto de cambios; la validación real (que haya un
                rivalName) ya está en handleSubmit. */}
            <select
              className="player-form-input"
              value={form.rivalTeamId}
              onChange={(e) => {
                if (e.target.value === '__new__') setShowNewRivalClub(true);
                else selectRivalTeam(e.target.value);
              }}
            >
              <option value="" disabled>
                {form.rivalTeamId === '' && form.rivalName ? `${form.rivalName} (sin ficha de equipo — elige uno o crea uno nuevo)` : 'Selecciona rival…'}
              </option>
              {rivalTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.category ? ` (${t.category})` : ''}</option>
              ))}
              <option value="__new__">+ Crear nuevo club…</option>
            </select>
          </Field>

          {/* "Se ilumine" y quede claro que es DE MI EQUIPO, no del rival (2026-09-26,
              a petición del usuario) — antes "Local"/"Visitante" a secas con el mismo
              resaltado tenue que cualquier pestaña seleccionada de la app; ahora un
              color sólido propio (--own, el azul de "nosotros" en toda la app) y una
              etiqueta encima que dice de quién es la pregunta. */}
          <Field label="Mi equipo juega…">
            <div className="home-away-toggle">
              <button
                type="button"
                className={`home-away-btn${form.isHome ? ' home-away-btn--active' : ''}`}
                onClick={() => setForm({ ...form, isHome: true })}
              >
                En casa (Local)
              </button>
              <button
                type="button"
                className={`home-away-btn${!form.isHome ? ' home-away-btn--active' : ''}`}
                onClick={() => setForm({ ...form, isHome: false })}
              >
                Fuera (Visitante)
              </button>
            </div>
          </Field>
          <Field label="Lugar / pabellón">
            <input
              className="player-form-input"
              placeholder="Lugar / pabellón"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
            />
          </Field>
          <Field label="Fecha y hora">
            <input
              className="player-form-input"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </Field>
          <Field label="Jornada (opcional)">
            <input
              className="player-form-input player-form-input--number"
              type="number"
              placeholder="Jornada (opcional)"
              value={form.jornada}
              onChange={(e) => setForm({ ...form, jornada: e.target.value })}
            />
          </Field>
          <Field label="Escudo rival (opcional)">
            <input
              className="player-form-input"
              placeholder="URL del escudo rival (opcional)"
              value={form.rivalCrestUrl}
              onChange={(e) => setForm({ ...form, rivalCrestUrl: e.target.value })}
            />
          </Field>
          <Field label="Dorsales rivales conocidos (opcional)">
            <input
              className="player-form-input"
              placeholder="Separados por comas: 3, 7, 11"
              value={form.rivalDorsalsText}
              onChange={(e) => setForm({ ...form, rivalDorsalsText: e.target.value })}
            />
          </Field>

          {/* Elegir 2 tiempos o 4 cuartos y elegir la duración de cada uno son dos
              decisiones independientes (2026-09-26) — antes el botón llevaba la
              duración pegada en el propio texto ("2 tiempos de 20 min"), lo que
              dejaba de tener sentido en cuanto se cambiaba la duración de abajo. */}
          <Field label="Formato del partido">
            <div className="home-away-toggle">
              {Object.entries(PERIOD_FORMATS).map(([key, fmt]) => (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-timeout${form.periodFormat === key ? ' admin-nav-tab--active' : ''}`}
                  // Con cuartos se activan por defecto las reglas de Alevín; con
                  // tiempos, no aplican.
                  onClick={() => setForm({ ...form, periodFormat: key, periodDurationMinutes: fmt.minutes, alevinRules: key === 'quarters' })}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </Field>
          {form.periodFormat === 'quarters' && (
            <label className="player-form-checkbox alevin-rules-toggle">
              <input
                type="checkbox"
                checked={form.alevinRules}
                onChange={(e) => setForm({ ...form, alevinRules: e.target.checked })}
              />
              <span>
                <strong>Reglas Alevín</strong>: antes de iniciar cada cuarto hay que elegir el equipo titular (con la
                vista de quién empezó los anteriores) y se avisa si se repite algún jugador (solo se puede repetir con
                menos de 14 convocados). Los avisos nunca impiden confirmarlo ni hacer cambios. Desmárcalo si no quieres
                este paso (p. ej. en un entrenamiento).
              </span>
            </label>
          )}
          <Field label={`Duración de cada ${form.periodFormat === 'quarters' ? 'cuarto' : 'tiempo'} (minutos)`}>
            <input
              className="player-form-input player-form-input--number"
              type="number"
              min="1"
              value={form.periodDurationMinutes}
              onChange={(e) => setForm({ ...form, periodDurationMinutes: e.target.value })}
            />
          </Field>
        </>
      )}

      {formSection === 'callup' && (
        <>
          <div className="matches-header">
            <p className="modal-hint" style={{ margin: 0 }}>Convocatoria ({callUpIds.length} jugadores)</p>
            <div className="player-form-actions">
              <button type="button" className="btn btn-timeout" onClick={callUpAll}>Convocar a todos</button>
              <button type="button" className="btn btn-timeout" onClick={callUpNone}>Quitar a todos</button>
            </div>
          </div>
          {players.length > 0 && (
            <input
              className="player-form-input"
              placeholder="Buscar por nombre, apellidos o dorsal…"
              value={callUpSearch}
              onChange={(e) => setCallUpSearch(e.target.value)}
            />
          )}
          {/* Mismo aspecto que en el partido: dorsal en círculo azul + nombre
              (2026-09-26, a petición del usuario) — tocar un convocado lo marca/
              desmarca, en vez de una casilla aparte. */}
          <div className="chip-grid">
            {visibleCallUpPlayers.map((p) => {
              const sel = callUpIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`shp-player${sel ? ' shp-player--sel' : ''}`}
                  onClick={() => toggleCallUp(p.id)}
                  aria-pressed={sel}
                >
                  <span className="shp-player-n">{p.number}</span>
                  <span className="shp-player-name">{p.displayName}{p.isGK ? ' (P)' : ''}</span>
                </button>
              );
            })}
            {players.length === 0 && <p className="modal-hint">No hay jugadores en la plantilla todavía.</p>}
            {players.length > 0 && visibleCallUpPlayers.length === 0 && <p className="modal-hint">Ningún jugador coincide con la búsqueda.</p>}
          </div>
        </>
      )}

      {formSection === 'lineup' && (
        callUpIds.length > 0 ? (
          <>
            <p className="modal-hint">
              Equipo titular ({boardIds.filter(Boolean).length}/7) — arrastra a cada convocado a su puesto (o tócalo y
              luego toca el puesto); hace falta elegir los 7, con portero, antes de poder iniciar el partido
            </p>
            <LineupBoard
              ids={boardIds}
              onChange={setBoardIds}
              roster={callUpIds.map((id) => rosterById[id]).filter(Boolean)}
            />
          </>
        ) : (
          <p className="modal-hint">Elige primero la convocatoria en la pestaña «Convocados».</p>
        )
      )}

      <div className="player-form-actions">
        <button className="btn btn-clock btn-start" type="submit">
          {editingMatchId ? 'GUARDAR CAMBIOS' : 'CREAR PARTIDO'}
        </button>
        <button type="button" className="modal-cancel" onClick={cancelForm}>Cancelar</button>
      </div>
    </form>
  );

  function renderMatchCard(m) {
    const isFinished = m.lifecycle === 'finished';
    const isScheduled = m.lifecycle === 'scheduled';
    const leftIsOwn = m.isHome;
    const leftName = leftIsOwn ? (ownTeamName || 'Mi equipo') : (m.rivalName || 'Rival');
    const rightName = leftIsOwn ? (m.rivalName || 'Rival') : (ownTeamName || 'Mi equipo');
    const leftCrest = leftIsOwn ? ownCrestUrl : m.rivalCrestUrl;
    const rightCrest = leftIsOwn ? m.rivalCrestUrl : ownCrestUrl;
    const leftScore = leftIsOwn ? m.score?.own : m.score?.rival;
    const rightScore = leftIsOwn ? m.score?.rival : m.score?.own;
    return (
      <div key={m.id} className={`match-card${isFinished ? ' match-card--finished match-card--clickable' : ''}`}>
        <div className="match-card-row">
          {canManageRoster && (
            <input
              type="checkbox"
              className="match-check"
              checked={selectedMatchIds.includes(m.id)}
              onChange={() => toggleMatchSelect(m.id)}
            />
          )}
          <div className="match-card-body" onClick={isFinished ? () => onOpenStats(m.id) : undefined}>
            <div className="match-teams-row">
              <div className="match-team">
                <div className={`crest-sm${leftIsOwn ? ' crest-sm--own' : ''}`}>
                  {leftCrest ? <img src={leftCrest} alt="" /> : teamInitials(leftName)}
                </div>
                <span className="match-team-name">{leftName}</span>
              </div>
              <div className="match-mid">
                {isFinished ? (
                  <span className="match-score">{leftScore ?? '—'}–{rightScore ?? '—'}</span>
                ) : (
                  <span className="match-vs">vs</span>
                )}
              </div>
              <div className="match-team match-team--rival">
                <div className={`crest-sm${!leftIsOwn ? ' crest-sm--own' : ''}`}>
                  {rightCrest ? <img src={rightCrest} alt="" /> : teamInitials(rightName)}
                </div>
                <span className="match-team-name">{rightName}</span>
              </div>
            </div>
            <div className="match-meta">
              {m.jornada != null && (
                <>
                  <span>J{m.jornada}</span>
                  <span className="match-meta-sep">·</span>
                </>
              )}
              <span className="match-meta-time">{formatMatchDateTime(m.scheduledAt)}</span>
              <span className="match-meta-sep">·</span>
              <span>{m.venue || 'Sin lugar'}</span>
              <span className="match-meta-sep">·</span>
              <span className={`match-status-dot match-status-dot--${m.lifecycle}`} />
              <span className={`match-status-text--${m.lifecycle}`}>{LIFECYCLE_LABELS[m.lifecycle] || m.lifecycle}</span>
              {isFinished && (
                <span className="match-chevron">
                  <ChevronRight size={14} />
                </span>
              )}
            </div>
          </div>
        </div>
        {isScheduled && canUseBench && (
          <button type="button" className="match-start-btn" onClick={() => handleStart(m)}>INICIAR</button>
        )}
      </div>
    );
  }

  function renderBulkBar(list) {
    if (!canManageRoster || list.length === 0) return null;
    return (
      <>
        <label className="select-all-checkbox">
          <input
            type="checkbox"
            checked={selectedMatchIds.length > 0 && selectedMatchIds.length === list.length}
            ref={(el) => {
              if (el) el.indeterminate = selectedMatchIds.length > 0 && selectedMatchIds.length < list.length;
            }}
            onChange={() => (selectedMatchIds.length === list.length ? deselectAllMatches() : selectAllMatches(list))}
          />
          {selectedMatchIds.length > 0 ? `${selectedMatchIds.length} seleccionado${selectedMatchIds.length === 1 ? '' : 's'}` : 'Seleccionar todos'}
        </label>
        {selectedMatchIds.length > 0 && (
          <div className="bulk-actions">
            <button
              type="button"
              className="btn-icon-sm btn-icon-sm--accent"
              disabled={selectedMatchIds.length !== 1}
              onClick={editSelectedMatch}
              title={selectedMatchIds.length === 1 ? 'Editar' : 'Editar (elige solo un partido)'}
              aria-label="Editar el partido seleccionado"
            >
              <Settings size={15} />
            </button>
            <button
              type="button"
              className="btn-icon-sm btn-icon-sm--danger"
              onClick={handleBulkDelete}
              title="Borrar seleccionados"
              aria-label={`Borrar ${selectedMatchIds.length} partido(s) seleccionados`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="admin-panel plantilla">
      <div className="plantilla-head">
        <h2 className="plantilla-title">Partidos</h2>
        <p className="plantilla-sub">{allScheduledCount} programado{allScheduledCount === 1 ? '' : 's'} · {allFinishedCount} finalizado{allFinishedCount === 1 ? '' : 's'}</p>
      </div>

      {liveMatches.map((m) => {
        const leftIsOwn = m.isHome;
        const leftName = leftIsOwn ? (ownTeamName || 'Mi equipo') : (m.rivalName || 'Rival');
        const rightName = leftIsOwn ? (m.rivalName || 'Rival') : (ownTeamName || 'Mi equipo');
        const leftCrest = leftIsOwn ? ownCrestUrl : m.rivalCrestUrl;
        const rightCrest = leftIsOwn ? m.rivalCrestUrl : ownCrestUrl;
        const leftScore = leftIsOwn ? m.score?.own : m.score?.rival;
        const rightScore = leftIsOwn ? m.score?.rival : m.score?.own;
        const clickable = canUseBench;
        return (
          <button
            key={m.id}
            type="button"
            className={`live-card${clickable ? ' live-card--clickable' : ''}`}
            onClick={clickable ? () => onOpenMatch(m.id) : undefined}
            disabled={!clickable}
          >
            <div className="live-card-top">
              <span className="live-pill"><span className="live-dot" />EN VIVO</span>
              {m.jornada != null && <span className="live-jornada">Jornada {m.jornada}</span>}
            </div>
            <div className="live-teams">
              <div className="live-team">
                <div className="live-crest">{leftCrest ? <img src={leftCrest} alt="" /> : teamInitials(leftName)}</div>
                <span className="live-team-name">{leftName}</span>
              </div>
              <div className="live-score">
                <span>{leftScore ?? 0}</span><span className="live-score-sep">–</span><span>{rightScore ?? 0}</span>
              </div>
              <div className="live-team">
                <div className="live-crest">{rightCrest ? <img src={rightCrest} alt="" /> : teamInitials(rightName)}</div>
                <span className="live-team-name">{rightName}</span>
              </div>
            </div>
            <div className="live-bottom-row">
              <p className="live-clock">
                {m.venue || 'Sin lugar'}{m.period ? ` · ${periodLongLabel(m.period, periodCountOf(m))}` : ''}
              </p>
              {clickable && (
                <span className="live-play-btn" title="Continuar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                </span>
              )}
            </div>
          </button>
        );
      })}

      <div className="plantilla-menu">
        {canManageRoster && (
          <button type="button" className="plantilla-card" onClick={openCreate} aria-label="Crear partido">
            <Plus size={22} />
            <span className="plantilla-card-t">Crear partido</span>
            <span className="plantilla-card-d">Nuevo partido, convocatoria y titulares</span>
          </button>
        )}
        <button type="button" className="plantilla-card" onClick={() => setScreen('scheduled')} aria-label="Partidos programados">
          <CalendarClock size={22} />
          <span className="plantilla-card-t">Partidos programados</span>
          <span className="plantilla-card-d">{allScheduledCount} partido{allScheduledCount === 1 ? '' : 's'} por jugar</span>
        </button>
        <button type="button" className="plantilla-card" onClick={() => setScreen('finished')} aria-label="Partidos finalizados">
          <History size={22} />
          <span className="plantilla-card-t">Partidos finalizados</span>
          <span className="plantilla-card-d">{allFinishedCount} partido{allFinishedCount === 1 ? '' : 's'} jugado{allFinishedCount === 1 ? '' : 's'}</span>
        </button>
      </div>

      {screen === 'create' && (
        <div className="modal-backdrop" onClick={cancelForm}>
          <div className="modal plantilla-modal plantilla-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={editingMatchId ? 'Editar partido' : 'Crear partido'}>
            <div className="plantilla-modal-head">
              <h2>{editingMatchId ? 'Editar partido' : 'Crear partido'}</h2>
              <button type="button" className="shp-close" onClick={cancelForm} aria-label="Cerrar"><X size={20} /></button>
            </div>
            {matchForm}
          </div>
        </div>
      )}

      {showNewRivalClub && (
        <div className="modal-backdrop" onClick={() => setShowNewRivalClub(false)}>
          <div className="modal plantilla-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Fichar club rival">
            <div className="plantilla-modal-head">
              <h2>Nuevo club rival</h2>
              <button type="button" className="shp-close" onClick={() => setShowNewRivalClub(false)} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <form className="plantilla-form" onSubmit={handleCreateRivalClub}>
              <p className="modal-hint" style={{ margin: 0 }}>
                Crea el club rival y su equipo — a partir de ahora aparecerá en la lista de rivales, también para
                otros clubes (así no hace falta darlo de alta cada vez que alguien juega contra él).
              </p>
              {rivalClubError && <p className="warning-banner">{rivalClubError}</p>}
              <Field label="Nombre del club">
                <input
                  className="player-form-input"
                  placeholder="p. ej. CB Ejemplo"
                  value={rivalClubForm.clubName}
                  onChange={(e) => setRivalClubForm({ ...rivalClubForm, clubName: e.target.value })}
                  required
                />
              </Field>
              <Field label="Nombre del equipo (opcional — si no se indica, se usa el del club)">
                <input
                  className="player-form-input"
                  placeholder={rivalClubForm.clubName || 'Nombre del equipo'}
                  value={rivalClubForm.teamName}
                  onChange={(e) => setRivalClubForm({ ...rivalClubForm, teamName: e.target.value })}
                />
              </Field>
              <Field label="Categoría">
                <select className="player-form-input" value={rivalClubForm.category} onChange={(e) => setRivalClubForm({ ...rivalClubForm, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Liga (opcional)">
                <select className="player-form-input" value={rivalClubForm.leagueId} onChange={(e) => setRivalClubForm({ ...rivalClubForm, leagueId: e.target.value })}>
                  <option value="">Sin liga</option>
                  {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
              <Field label="Escudo (opcional)">
                <input
                  className="player-form-input"
                  placeholder="URL del escudo"
                  value={rivalClubForm.crestUrl}
                  onChange={(e) => setRivalClubForm({ ...rivalClubForm, crestUrl: e.target.value })}
                />
              </Field>
              <div className="player-form-actions">
                <button className="btn btn-clock btn-start" type="submit" disabled={rivalClubBusy}>
                  {rivalClubBusy ? 'CREANDO…' : 'CREAR CLUB RIVAL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {screen === 'scheduled' && (
        <div className="modal-backdrop" onClick={() => { setScreen(null); setSelectedMatchIds([]); }}>
          <div className="modal plantilla-modal plantilla-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Partidos programados">
            <div className="plantilla-modal-head">
              <h2>Partidos programados</h2>
              <button type="button" className="shp-close" onClick={() => { setScreen(null); setSelectedMatchIds([]); }} aria-label="Cerrar"><X size={20} /></button>
            </div>
            {canManageRoster && (
              <div className="player-form-actions">
                <button type="button" className="btn btn-clock btn-start" onClick={openCreate}>+ NUEVO PARTIDO</button>
              </div>
            )}
            <MatchFilters filters={filters} setFilters={setFilters} pastRivals={pastRivals} />
            <div className="matches-header">{renderBulkBar(scheduledMatches)}</div>
            <div className="match-list">
              {scheduledMatches.map(renderMatchCard)}
              {allScheduledCount === 0 && <p className="modal-hint">Todavía no hay partidos programados.</p>}
              {allScheduledCount > 0 && scheduledMatches.length === 0 && <p className="modal-hint">Ningún partido coincide con el filtro.</p>}
            </div>
          </div>
        </div>
      )}

      {screen === 'finished' && (
        <div className="modal-backdrop" onClick={() => { setScreen(null); setSelectedMatchIds([]); }}>
          <div className="modal plantilla-modal plantilla-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Partidos finalizados">
            <div className="plantilla-modal-head">
              <h2>Partidos finalizados</h2>
              <button type="button" className="shp-close" onClick={() => { setScreen(null); setSelectedMatchIds([]); }} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <MatchFilters filters={filters} setFilters={setFilters} pastRivals={pastRivals} />
            <div className="matches-header">{renderBulkBar(finishedMatches)}</div>
            <div className="match-list">
              {finishedMatches.map(renderMatchCard)}
              {allFinishedCount === 0 && <p className="modal-hint">Todavía no hay partidos finalizados.</p>}
              {allFinishedCount > 0 && finishedMatches.length === 0 && <p className="modal-hint">Ningún partido coincide con el filtro.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
