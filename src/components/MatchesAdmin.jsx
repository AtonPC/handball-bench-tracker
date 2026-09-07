import { useMemo, useState } from 'react';
import { findLastVenueForRival, useMatches } from '../hooks/useMatches';
import { usePlayers } from '../hooks/usePlayers';

const LIFECYCLE_LABELS = { scheduled: 'Programado', live: 'En juego', finished: 'Finalizado' };
const emptyForm = { rivalName: '', isHome: true, venue: '', scheduledAt: '' };

export default function MatchesAdmin({ clubId, teamId, ownTeamName, canManageRoster, canUseBench, onOpenMatch, onOpenStats }) {
  const { matches, createMatch, updateMatch, removeMatch, startMatch } = useMatches(clubId, teamId);
  const { players } = usePlayers(clubId, teamId);
  const [showForm, setShowForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editingLifecycle, setEditingLifecycle] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [callUpIds, setCallUpIds] = useState([]);
  const [startingIds, setStartingIds] = useState([]);
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

  const fieldStartersCount = startingIds.filter((id) => !rosterById[id]?.isGK).length;
  const gkStartersCount = startingIds.filter((id) => rosterById[id]?.isGK).length;

  function toggleCallUp(id) {
    const isRemoving = callUpIds.includes(id);
    setCallUpIds((prev) => (isRemoving ? prev.filter((x) => x !== id) : [...prev, id]));
    // Si se quita de la convocatoria, no puede seguir de titular.
    if (isRemoving) setStartingIds((prev) => prev.filter((x) => x !== id));
  }

  function callUpAll() {
    setCallUpIds(players.map((p) => p.id));
  }

  function callUpNone() {
    setCallUpIds([]);
    setStartingIds([]);
  }

  function toggleStarter(id) {
    const player = rosterById[id];
    if (!player) return;
    setStartingIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const fieldCount = prev.filter((x) => !rosterById[x]?.isGK).length;
      const gkCount = prev.filter((x) => rosterById[x]?.isGK).length;
      if (player.isGK && gkCount >= 1) return prev;
      if (!player.isGK && fieldCount >= 6) return prev;
      return [...prev, id];
    });
  }

  function handleRivalBlur() {
    if (form.venue) return;
    const venue = findLastVenueForRival(matches, form.rivalName);
    if (venue) setForm((f) => ({ ...f, venue }));
  }

  function startEdit(m) {
    setEditingMatchId(m.id);
    setEditingLifecycle(m.lifecycle);
    setForm({
      rivalName: m.rivalName || '',
      isHome: m.isHome ?? true,
      venue: m.venue || '',
      scheduledAt: m.scheduledAt ? new Date(m.scheduledAt).toISOString().slice(0, 16) : '',
    });
    setCallUpIds(m.callUpPlayerIds || []);
    setStartingIds(m.startingLineupIds || []);
    setShowForm(true);
  }

  function cancelForm() {
    setEditingMatchId(null);
    setEditingLifecycle(null);
    setForm(emptyForm);
    setCallUpIds([]);
    setStartingIds([]);
    setShowForm(false);
  }

  const editingFinished = editingLifecycle === 'finished';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.rivalName) return;
    if (!editingFinished && callUpIds.length === 0) return;
    const data = {
      rivalName: form.rivalName.trim(),
      isHome: form.isHome,
      venue: form.venue.trim(),
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).getTime() : Date.now(),
      ownTeamName,
    };
    if (!editingFinished) {
      data.callUpPlayerIds = callUpIds;
      data.startingLineupIds = startingIds;
    }
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
      await startMatch(m.id, m.callUpPlayerIds, rosterById, m.startingLineupIds);
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

          {editingFinished && (
            <p className="modal-hint">
              Este partido ya se jugó: solo puedes corregir los datos de arriba (rival, lugar, fecha). La
              convocatoria y las estadísticas ya registradas no se tocan aquí.
            </p>
          )}

          {!editingFinished && (
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
                    Titulares: {fieldStartersCount}/6 jugadores de campo, {gkStartersCount}/1 portero (opcional —
                    si no eliges, empiezan los 7 primeros de la convocatoria)
                  </p>
                  <div className="call-up-list">
                    {callUpIds.map((id) => {
                      const p = rosterById[id];
                      if (!p) return null;
                      return (
                        <label key={id} className="call-up-item">
                          <input type="checkbox" checked={startingIds.includes(id)} onChange={() => toggleStarter(id)} />
                          #{p.number} {p.displayName}{p.isGK ? ' (P)' : ''}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
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

      <div className="admin-list">
        {matches.map((m) => (
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
            {(m.lifecycle === 'scheduled' || m.lifecycle === 'finished') && canManageRoster && (
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
          </div>
        ))}
        {matches.length === 0 && <p className="modal-hint">Todavía no hay partidos creados.</p>}
      </div>
    </div>
  );
}
