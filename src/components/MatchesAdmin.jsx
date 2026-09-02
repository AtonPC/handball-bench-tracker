import { useMemo, useState } from 'react';
import { useMatches } from '../hooks/useMatches';
import { usePlayers } from '../hooks/usePlayers';
import { useTeams } from '../hooks/useTeams';

const LIFECYCLE_LABELS = { scheduled: 'Programado', live: 'En juego', finished: 'Finalizado' };

export default function MatchesAdmin({ canCreate, onOpenMatch, onOpenStats }) {
  const { matches, createMatch, startMatch } = useMatches(true);
  const { players } = usePlayers(true);
  const { teams } = useTeams(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rivalName: '', isHome: true, venue: '', scheduledAt: '' });
  const [callUpIds, setCallUpIds] = useState([]);

  const defaultTeam = useMemo(() => teams.find((t) => t.isDefault), [teams]);
  const ownTeamName = defaultTeam?.name || 'Mi equipo';

  const rosterById = useMemo(() => {
    const map = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);

  function toggleCallUp(id) {
    setCallUpIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleHomeAwayChange(isHome) {
    let venue = form.venue;
    if (!venue) {
      if (isHome) venue = defaultTeam?.venue || '';
      else {
        const rivalTeam = teams.find((t) => t.name.toLowerCase() === form.rivalName.trim().toLowerCase());
        venue = rivalTeam?.venue || '';
      }
    }
    setForm({ ...form, isHome, venue });
  }

  function handleRivalBlur() {
    if (form.venue) return;
    if (form.isHome) return;
    const rivalTeam = teams.find((t) => t.name.toLowerCase() === form.rivalName.trim().toLowerCase());
    if (rivalTeam?.venue) setForm((f) => ({ ...f, venue: rivalTeam.venue }));
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
        {canCreate && (
          <button className="btn btn-clock btn-start" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'CANCELAR' : '+ NUEVO PARTIDO'}
          </button>
        )}
      </div>

      {showForm && (
        <form className="player-form" onSubmit={handleCreate}>
          <p className="modal-hint">Mi equipo: <strong>{ownTeamName}</strong>{!defaultTeam && ' (márcalo en la pestaña Equipos)'}</p>

          <input
            className="player-form-input"
            list="team-names"
            placeholder="Equipo rival"
            value={form.rivalName}
            onChange={(e) => setForm({ ...form, rivalName: e.target.value })}
            onBlur={handleRivalBlur}
            required
          />
          <datalist id="team-names">
            {teams.filter((t) => !t.isDefault).map((t) => <option key={t.id} value={t.name} />)}
          </datalist>

          <div className="home-away-toggle">
            <button
              type="button"
              className={`btn btn-timeout${form.isHome ? ' admin-nav-tab--active' : ''}`}
              onClick={() => handleHomeAwayChange(true)}
            >
              Local
            </button>
            <button
              type="button"
              className={`btn btn-timeout${!form.isHome ? ' admin-nav-tab--active' : ''}`}
              onClick={() => handleHomeAwayChange(false)}
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
          <div className="call-up-list">
            {players.map((p) => (
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
            {m.lifecycle === 'scheduled' && (
              <button className="btn btn-clock btn-start" onClick={() => handleStart(m.id, m.callUpPlayerIds)}>
                Iniciar
              </button>
            )}
            {m.lifecycle === 'live' && (
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
