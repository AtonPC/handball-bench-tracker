import { useMemo, useState } from 'react';
import { findLastVenueForRival, useMatches } from '../hooks/useMatches';
import { usePlayers } from '../hooks/usePlayers';

const LIFECYCLE_LABELS = { scheduled: 'Programado', live: 'En juego', finished: 'Finalizado' };
const emptyForm = { rivalName: '', isHome: true, venue: '', scheduledAt: '', periodDurationMinutes: 20 };

export default function MatchesAdmin({ clubId, teamId, ownTeamName, canManageRoster, canUseBench, onOpenMatch, onOpenStats, onEditFinishedStats }) {
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
      periodDurationMinutes: m.periodDurationMs ? m.periodDurationMs / 60000 : 20,
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
      callUpPlayerIds: callUpIds,
      startingLineupIds: startingIds,
      startingGoalkeeperId: startingGoalkeeperId || null,
      periodDurationMs: (Number(form.periodDurationMinutes) || 20) * 60000,
    };
    if (editingMatchId) {
      await updateMatch(editingMatchId, data);
    } else {
      await createMatch(data);
    }
    cancelForm();
  }

  async function handleDelete(m) {
    const message = m.lifecycle === 'finished'
      ? '¿Borrar este partido finalizado? Se perderán sus estadísticas (goles, tiempos, goles rivales...) y no se puede deshacer.'
      : '¿Borrar este partido programado?';
    if (!confirm(message)) return;
    await removeMatch(m.id);
  }

  async function handleStart(m) {
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
          <label className="player-form-checkbox">
            Duración de cada tiempo (minutos)
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
                Titulares ({startingIds.length}/7, opcional — si no eliges, empiezan los 7 primeros de la convocatoria)
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
                Portero de este partido (opcional, independiente de la ficha del jugador)
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

      <div className="admin-list">
        {filteredMatches.map((m) => (
          <div key={m.id} className="admin-row match-row">
            <div className="admin-user-info">
              <span className="admin-user-name">
                {m.isHome ? `${m.ownTeamName || 'Mi equipo'} vs ${m.rivalName}` : `${m.rivalName} vs ${m.ownTeamName || 'Mi equipo'}`}
              </span>
              <span className="admin-user-email">
                {m.venue || 'Sin lugar'} · {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : ''}
              </span>
            </div>
            <span className={`match-badge match-badge--${m.lifecycle}`}>{LIFECYCLE_LABELS[m.lifecycle] || m.lifecycle}</span>
            {m.lifecycle === 'scheduled' && canManageRoster && (
              <>
                <button className="btn btn-timeout" onClick={() => startEdit(m)}>Editar</button>
                <button className="btn btn-timeout btn-danger-text" onClick={() => handleDelete(m)}>Borrar</button>
              </>
            )}
            {m.lifecycle === 'scheduled' && canUseBench && (
              <button className="btn btn-clock btn-start" onClick={() => handleStart(m)}>
                Iniciar
              </button>
            )}
            {m.lifecycle === 'live' && canUseBench && (
              <button className="btn btn-clock btn-start" onClick={() => onOpenMatch(m.id)}>Continuar</button>
            )}
            {m.lifecycle === 'finished' && (
              <button className="btn btn-timeout" onClick={() => onOpenStats(m.id)}>Estadísticas</button>
            )}
            {m.lifecycle === 'finished' && canManageRoster && (
              <>
                <button className="btn btn-timeout" onClick={() => onEditFinishedStats(m.id)}>Editar</button>
                <button className="btn btn-timeout btn-danger-text" onClick={() => handleDelete(m)}>Borrar</button>
              </>
            )}
          </div>
        ))}
        {matches.length === 0 && <p className="modal-hint">Todavía no hay partidos creados.</p>}
        {matches.length > 0 && filteredMatches.length === 0 && <p className="modal-hint">Ningún partido coincide con el filtro.</p>}
      </div>
    </div>
  );
}
