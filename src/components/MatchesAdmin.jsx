import { useMemo, useState } from 'react';
import { findLastVenueForRival, useMatches } from '../hooks/useMatches';
import { usePlayers } from '../hooks/usePlayers';

const LIFECYCLE_LABELS = { scheduled: 'Programado', live: 'En juego', finished: 'Finalizado' };

export default function MatchesAdmin({ clubId, teamId, ownTeamName, canManageRoster, canUseBench, onOpenMatch, onOpenStats }) {
  const { matches, createMatch, startMatch } = useMatches(clubId, teamId);
  const { players } = usePlayers(clubId, teamId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rivalName: '', isHome: true, venue: '', scheduledAt: '' });
  const [callUpIds, setCallUpIds] = useState([]);
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

  function toggleCallUp(id) {
    setCallUpIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleRivalBlur() {
    if (form.venue) return;
    const venue = findLastVenueForRival(matches, form.rivalName);
    if (venue) setForm((f) => ({ ...f, venue }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.rivalName || callUpIds.length === 0) return;
    await createMatch({
      rivalName: form.rivalName.trim(),
      isHome: form.isHome,
      venue: form.venue.trim(),
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).getTime() : Date.now(),
      ownTeamName,
      callUpPlayerIds: callUpIds,
    });
    setForm({ rivalName: '', isHome: true, venue: '', scheduledAt: '' });
    setCallUpIds([]);
    setShowForm(false);
  }

  async function handleStart(matchId, callUpPlayerIds) {
    try {
      await startMatch(matchId, callUpPlayerIds, rosterById);
      onOpenMatch(matchId);
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
          <button className="btn btn-clock btn-start" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'CANCELAR' : '+ NUEVO PARTIDO'}
          </button>
        )}
      </div>

      {showForm && (
        <form className="player-form" onSubmit={handleCreate}>
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

          <p className="modal-hint">Convocatoria ({callUpIds.length} jugadores)</p>
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
                #{p.number} {p.displayName}
              </label>
            ))}
            {players.length === 0 && <p className="modal-hint">No hay jugadores en la plantilla todavía.</p>}
            {players.length > 0 && visibleCallUpPlayers.length === 0 && <p className="modal-hint">Ningún jugador coincide con la búsqueda.</p>}
          </div>

          <button className="btn btn-clock btn-start" type="submit">CREAR PARTIDO</button>
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
            {m.lifecycle === 'scheduled' && canUseBench && (
              <button className="btn btn-clock btn-start" onClick={() => handleStart(m.id, m.callUpPlayerIds)}>
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
