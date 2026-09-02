import { useState } from 'react';
import { useTeams } from '../hooks/useTeams';

export default function TeamsAdmin() {
  const { teams, addTeam, setDefaultTeam, removeTeam } = useTeams(true);
  const [form, setForm] = useState({ name: '', venue: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await addTeam({ name: form.name.trim(), venue: form.venue.trim() });
    setForm({ name: '', venue: '' });
  }

  return (
    <div className="admin-panel">
      <p className="modal-hint">Equipos (el tuyo y los rivales)</p>

      <form className="player-form" onSubmit={handleSubmit}>
        <input
          className="player-form-input"
          placeholder="Nombre del equipo"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="player-form-input"
          placeholder="Lugar / pabellón habitual"
          value={form.venue}
          onChange={(e) => setForm({ ...form, venue: e.target.value })}
        />
        <button className="btn btn-clock btn-start" type="submit">AÑADIR EQUIPO</button>
      </form>

      <div className="admin-list">
        {teams.map((t) => (
          <div key={t.id} className="admin-row">
            <div className="admin-user-info">
              <span className="admin-user-name">{t.name}</span>
              <span className="admin-user-email">{t.venue || 'Sin lugar registrado'}</span>
            </div>
            {t.isDefault ? (
              <span className="match-badge match-badge--live">MI EQUIPO</span>
            ) : (
              <button className="btn btn-timeout" onClick={() => setDefaultTeam(t.id, teams)}>
                Marcar como mi equipo
              </button>
            )}
            <button className="btn btn-timeout btn-danger-text" onClick={() => removeTeam(t.id)}>Borrar</button>
          </div>
        ))}
        {teams.length === 0 && <p className="modal-hint">Todavía no hay equipos registrados.</p>}
      </div>
    </div>
  );
}
