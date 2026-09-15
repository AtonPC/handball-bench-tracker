import { useState } from 'react';
import { Settings, Trash2 } from 'lucide-react';
import { useTeams } from '../hooks/useTeams';
import { useLeagues } from '../hooks/useLeagues';
import { CATEGORIES } from '../categories';

const emptyForm = { name: '', category: CATEGORIES[0], leagueId: '', crestUrl: '', primaryColor: '#1f4fa3', secondaryColor: '#ffffff', goalPhrase: '' };

export default function ClubAdmin({ clubId }) {
  const { teams, addTeam, updateTeam, removeTeam } = useTeams(clubId);
  const { leagues } = useLeagues(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(t) {
    setEditingId(t.id);
    setForm({
      name: t.name || '',
      category: t.category || CATEGORIES[0],
      leagueId: t.leagueId || '',
      crestUrl: t.crestUrl || '',
      primaryColor: t.primaryColor || '#1f4fa3',
      secondaryColor: t.secondaryColor || '#ffffff',
      goalPhrase: t.goalPhrase || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const data = { ...form, leagueId: form.leagueId || null };
    if (editingId) {
      await updateTeam(editingId, data);
    } else {
      await addTeam(data);
    }
    cancelEdit();
  }

  return (
    <div className="admin-panel">
      <p className="modal-hint">Equipos del club</p>

      <form className="player-form" onSubmit={handleSubmit}>
        <input
          className="player-form-input"
          placeholder="Nombre del equipo"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select
          className="player-form-input"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="player-form-input"
          value={form.leagueId}
          onChange={(e) => setForm({ ...form, leagueId: e.target.value })}
        >
          <option value="">Sin liga (opcional)</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <input
          className="player-form-input"
          placeholder="URL del escudo (opcional)"
          value={form.crestUrl}
          onChange={(e) => setForm({ ...form, crestUrl: e.target.value })}
        />
        <label className="player-form-checkbox">
          Color principal
          <input
            type="color"
            value={form.primaryColor}
            onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
          />
        </label>
        <label className="player-form-checkbox">
          Color secundario
          <input
            type="color"
            value={form.secondaryColor}
            onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
          />
        </label>
        <input
          className="player-form-input"
          placeholder="Frase / grito de gol (opcional)"
          value={form.goalPhrase}
          onChange={(e) => setForm({ ...form, goalPhrase: e.target.value })}
        />
        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" type="submit">
            {editingId ? 'GUARDAR' : 'AÑADIR EQUIPO'}
          </button>
          {editingId && (
            <button type="button" className="modal-cancel" onClick={cancelEdit}>Cancelar</button>
          )}
        </div>
      </form>

      <div className="admin-list">
        {teams.map((t) => (
          <div key={t.id} className="admin-row">
            {t.crestUrl ? (
              <img className="player-thumb" src={t.crestUrl} alt="" />
            ) : (
              <div
                className="player-thumb"
                style={{ background: t.primaryColor || 'var(--panel-alt)', border: `2px solid ${t.secondaryColor || 'var(--border)'}` }}
              />
            )}
            <div className="admin-user-info">
              <span className="admin-user-name">{t.name}</span>
              <span className="admin-user-email">{t.category || 'Sin categoría'}</span>
            </div>
            <button className="btn-icon" onClick={() => startEdit(t)} title="Editar" aria-label="Editar equipo">
              <Settings size={18} />
            </button>
            <button className="btn-icon btn-icon--danger" onClick={() => removeTeam(t.id)} title="Borrar" aria-label="Borrar equipo">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {teams.length === 0 && <p className="modal-hint">Todavía no hay equipos en este club.</p>}
      </div>
    </div>
  );
}
