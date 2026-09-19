import { useMemo, useState } from 'react';
import { ChevronRight, Settings, Trash2 } from 'lucide-react';
import { findLastVenueForRival, useMatches } from '../hooks/useMatches';
import { usePlayers } from '../hooks/usePlayers';
import { teamInitials } from '../utils/teamColors';
import { PERIOD_FORMATS, periodCountOf, periodFormatOf, periodLongLabel } from '../utils/periods';

const LIFECYCLE_LABELS = { scheduled: 'Programado', live: 'En directo', finished: 'Finalizado' };
const emptyForm = { rivalName: '', isHome: true, venue: '', scheduledAt: '', periodFormat: 'halves', periodDurationMinutes: PERIOD_FORMATS.halves.minutes, alevinRules: false, jornada: '', rivalCrestUrl: '' };

function formatMatchDateTime(ms) {
  if (!ms) return 'Sin fecha';
  const d = new Date(ms);
  const date = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default function MatchesAdmin({ clubId, teamId, ownTeamName, ownCrestUrl, canManageRoster, canUseBench, onOpenMatch, onOpenStats, onEditFinishedStats }) {
  const { matches, createMatch, updateMatch, removeMatch, startMatch } = useMatches(clubId, teamId);
  const { players } = usePlayers(clubId, teamId);
  const [showForm, setShowForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [callUpIds, setCallUpIds] = useState([]);
  const [startingIds, setStartingIds] = useState([]);
  const [startingGoalkeeperId, setStartingGoalkeeperId] = useState('');
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

  // Un partido "en juego" no se puede borrar — no entra en la selección
  // masiva ni en la lista normal, se muestra aparte en su propia tarjeta.
  const [selectedMatchIds, setSelectedMatchIds] = useState([]);
  const liveMatches = useMemo(() => filteredMatches.filter((m) => m.lifecycle === 'live'), [filteredMatches]);
  const selectableMatches = useMemo(() => filteredMatches.filter((m) => m.lifecycle !== 'live'), [filteredMatches]);

  function toggleMatchSelect(id) {
    setSelectedMatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllMatches() {
    setSelectedMatchIds(selectableMatches.map((m) => m.id));
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
      // Si se quita de la convocatoria, no puede seguir de titular ni de portero.
      setStartingIds((prev) => prev.filter((x) => x !== id));
      setStartingGoalkeeperId((prev) => (prev === id ? '' : prev));
    }
  }

  function callUpAll() {
    setCallUpIds(players.map((p) => p.id));
  }

  function callUpNone() {
    setCallUpIds([]);
    setStartingIds([]);
    setStartingGoalkeeperId('');
  }

  // El portero es una designación de este partido, no de la ficha del
  // jugador (position.isGK) — cualquier convocado puede ser el portero hoy.
  function toggleStarter(id) {
    if (startingIds.includes(id)) {
      setStartingIds((prev) => prev.filter((x) => x !== id));
      setStartingGoalkeeperId((prev) => (prev === id ? '' : prev));
      return;
    }
    if (startingIds.length >= 7) return;
    setStartingIds((prev) => [...prev, id]);
  }

  function handleRivalBlur() {
    if (form.venue) return;
    const venue = findLastVenueForRival(matches, form.rivalName);
    if (venue) setForm((f) => ({ ...f, venue }));
  }

  function startEdit(m) {
    setEditingMatchId(m.id);
    setForm({
      rivalName: m.rivalName || '',
      isHome: m.isHome ?? true,
      venue: m.venue || '',
      scheduledAt: m.scheduledAt ? new Date(m.scheduledAt).toISOString().slice(0, 16) : '',
      periodFormat: periodFormatOf(m),
      alevinRules: !!m.alevinRules,
      periodDurationMinutes: m.periodDurationMs ? m.periodDurationMs / 60000 : PERIOD_FORMATS[periodFormatOf(m)].minutes,
      jornada: m.jornada ?? '',
      rivalCrestUrl: m.rivalCrestUrl || '',
    });
    setCallUpIds(m.callUpPlayerIds || []);
    setStartingIds(m.startingLineupIds || []);
    setStartingGoalkeeperId(m.startingGoalkeeperId || '');
    setShowForm(true);
  }

  function cancelForm() {
    setEditingMatchId(null);
    setForm(emptyForm);
    setCallUpIds([]);
    setStartingIds([]);
    setStartingGoalkeeperId('');
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.rivalName || callUpIds.length === 0) return;
    const data = {
      rivalName: form.rivalName.trim(),
      isHome: form.isHome,
      venue: form.venue.trim(),
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).getTime() : Date.now(),
      ownTeamName,
      jornada: form.jornada === '' ? null : Number(form.jornada),
      rivalCrestUrl: form.rivalCrestUrl.trim(),
      callUpPlayerIds: callUpIds,
      startingLineupIds: startingIds,
      startingGoalkeeperId: startingGoalkeeperId || null,
      periodCount: PERIOD_FORMATS[form.periodFormat].count,
      alevinRules: form.periodFormat === 'quarters' && form.alevinRules,
      periodDurationMs: (Number(form.periodDurationMinutes) || PERIOD_FORMATS[form.periodFormat].minutes) * 60000,
    };
    if (editingMatchId) {
      await updateMatch(editingMatchId, data);
    } else {
      await createMatch(data);
    }
    cancelForm();
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

  return (
    <div className="admin-panel">
      <div className="matches-header">
        <p className="modal-hint">Partidos</p>
        {canManageRoster && (
          <button className="btn btn-clock btn-start" onClick={() => (showForm ? cancelForm() : setShowForm(true))}>
            {showForm ? 'CANCELAR' : '+ NUEVO PARTIDO'}
          </button>
        )}
      </div>

      {showForm && (
        <form className="player-form" onSubmit={handleSubmit}>
          <p className="modal-hint">Mi equipo: <strong>{ownTeamName}</strong></p>

          <input
            className="player-form-input"
            list="rival-names"
            placeholder="Equipo rival"
            value={form.rivalName}
            onChange={(e) => setForm({ ...form, rivalName: e.target.value })}
            onBlur={handleRivalBlur}
            required
          />
          <datalist id="rival-names">
            {pastRivals.map((name) => <option key={name} value={name} />)}
          </datalist>

          <div className="home-away-toggle">
            <button
              type="button"
              className={`btn btn-timeout${form.isHome ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setForm({ ...form, isHome: true })}
            >
              Local
            </button>
            <button
              type="button"
              className={`btn btn-timeout${!form.isHome ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setForm({ ...form, isHome: false })}
            >
              Visitante
            </button>
          </div>
          <input
            className="player-form-input"
            placeholder="Lugar / pabellón"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
          />
          <input
            className="player-form-input"
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
          />
          <input
            className="player-form-input player-form-input--number"
            type="number"
            placeholder="Jornada (opcional)"
            value={form.jornada}
            onChange={(e) => setForm({ ...form, jornada: e.target.value })}
          />
          <input
            className="player-form-input"
            placeholder="URL del escudo rival (opcional)"
            value={form.rivalCrestUrl}
            onChange={(e) => setForm({ ...form, rivalCrestUrl: e.target.value })}
          />
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
          <label className="player-form-checkbox">
            Duración de cada {form.periodFormat === 'quarters' ? 'cuarto' : 'tiempo'} (minutos)
            <input
              className="player-form-input player-form-input--number"
              type="number"
              min="1"
              value={form.periodDurationMinutes}
              onChange={(e) => setForm({ ...form, periodDurationMinutes: e.target.value })}
            />
          </label>

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
          <div className="call-up-list">
            {visibleCallUpPlayers.map((p) => (
              <label key={p.id} className="call-up-item">
                <input
                  type="checkbox"
                  checked={callUpIds.includes(p.id)}
                  onChange={() => toggleCallUp(p.id)}
                />
                #{p.number} {p.displayName}{p.isGK ? ' (P)' : ''}
              </label>
            ))}
            {players.length === 0 && <p className="modal-hint">No hay jugadores en la plantilla todavía.</p>}
            {players.length > 0 && visibleCallUpPlayers.length === 0 && <p className="modal-hint">Ningún jugador coincide con la búsqueda.</p>}
          </div>

          {callUpIds.length > 0 && (
            <>
              <p className="modal-hint">
                Titulares ({startingIds.length}/7) — hace falta elegir los 7 antes de poder iniciar el partido
              </p>
              <div className="call-up-list">
                {callUpIds.map((id) => {
                  const p = rosterById[id];
                  if (!p) return null;
                  return (
                    <label key={id} className="call-up-item">
                      <input type="checkbox" checked={startingIds.includes(id)} onChange={() => toggleStarter(id)} />
                      #{p.number} {p.displayName}
                    </label>
                  );
                })}
              </div>

              <p className="modal-hint">
                Portero de este partido (independiente de la ficha del jugador) — hace falta elegirlo antes de poder iniciar el partido
              </p>
              <select className="player-form-input" value={startingGoalkeeperId} onChange={(e) => setStartingGoalkeeperId(e.target.value)}>
                <option value="">Sin elegir</option>
                {callUpIds.map((id) => {
                  const p = rosterById[id];
                  if (!p) return null;
                  return <option key={id} value={id}>#{p.number} {p.displayName}</option>;
                })}
              </select>
            </>
          )}

          <div className="player-form-actions">
            <button className="btn btn-clock btn-start" type="submit">
              {editingMatchId ? 'GUARDAR CAMBIOS' : 'CREAR PARTIDO'}
            </button>
            <button type="button" className="modal-cancel" onClick={cancelForm}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="list-filters">
        <input
          className="player-form-input"
          list="rival-names"
          placeholder="Filtrar por rival…"
          value={filters.rival}
          onChange={(e) => setFilters({ ...filters, rival: e.target.value })}
        />
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

      {canManageRoster && selectableMatches.length > 0 && (
        <div className="matches-header">
          <label className="select-all-checkbox">
            <input
              type="checkbox"
              checked={selectedMatchIds.length > 0 && selectedMatchIds.length === selectableMatches.length}
              ref={(el) => {
                if (el) el.indeterminate = selectedMatchIds.length > 0 && selectedMatchIds.length < selectableMatches.length;
              }}
              onChange={() => (selectedMatchIds.length === selectableMatches.length ? deselectAllMatches() : selectAllMatches())}
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
        </div>
      )}

      <div className="match-list">
        {selectableMatches.map((m) => {
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
        })}
        {matches.length === 0 && <p className="modal-hint">Todavía no hay partidos creados.</p>}
        {matches.length > 0 && filteredMatches.length === 0 && <p className="modal-hint">Ningún partido coincide con el filtro.</p>}
      </div>
    </div>
  );
}
