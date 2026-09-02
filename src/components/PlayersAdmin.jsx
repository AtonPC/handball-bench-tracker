import { useState } from 'react';
import { usePlayers } from '../hooks/usePlayers';
import { POSITIONS, POSITION_ABBR } from '../positions';

const emptyForm = { fullName: '', displayName: '', number: '', photoUrl: '', position: POSITIONS[0] };

export default function PlayersAdmin() {
  const { players, addPlayer, updatePlayer, removePlayer } = usePlayers(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      fullName: p.fullName || '',
      displayName: p.displayName || '',
      number: p.number ?? '',
      photoUrl: p.photoUrl || '',
      position: p.position || POSITIONS[0],
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName || form.number === '') return;
    const data = {
      fullName: form.fullName.trim(),
      displayName: form.displayName.trim() || form.fullName.trim(),
      number: Number(form.number),
      photoUrl: form.photoUrl.trim() || null,
      position: form.position,
      isGK: form.position === 'Portero',
    };
    if (editingId) {
      await updatePlayer(editingId, data);
    } else {
      await addPlayer(data);
    }
    cancelEdit();
  }

  return (
    <div className="admin-panel">
      <p className="modal-hint">Plantilla del club</p>

      <form className="player-form" onSubmit={handleSubmit}>
        <input
          className="player-form-input"
          placeholder="Nombre completo"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <input
          className="player-form-input"
          placeholder="Nombre en camiseta/panel (opcional)"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
        />
        <input
          className="player-form-input player-form-input--number"
          type="number"
          placeholder="Dorsal"
          value={form.number}
          onChange={(e) => setForm({ ...form, number: e.target.value })}
          required
        />
        <input
          className="player-form-input"
          placeholder="URL de foto (opcional)"
          value={form.photoUrl}
          onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
        />
        <select
          className="player-form-input"
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
        >
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" type="submit">
            {editingId ? 'GUARDAR' : 'AÑADIR JUGADOR'}
          </button>
          {editingId && (
            <button type="button" className="modal-cancel" onClick={cancelEdit}>Cancelar</button>
          )}
        </div>
      </form>

      <div className="admin-list">
        {players.map((p) => (
          <div key={p.id} className="admin-row">
            {p.photoUrl ? (
              <img className="player-thumb" src={p.photoUrl} alt="" />
            ) : (
              <div className="player-thumb player-thumb--placeholder">{p.number}</div>
            )}
            <div className="admin-user-info">
              <span className="admin-user-name">#{p.number} {p.displayName}</span>
              <span className="admin-user-email">{p.fullName} · {POSITION_ABBR[p.position] || p.position}</span>
            </div>
            <button className="btn btn-timeout" onClick={() => startEdit(p)}>Editar</button>
            <button className="btn btn-timeout btn-danger-text" onClick={() => removePlayer(p.id)}>Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
