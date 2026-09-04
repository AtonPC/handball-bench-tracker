import { useMemo, useState } from 'react';
import { usePlayers } from '../hooks/usePlayers';
import { POSITIONS, POSITION_ABBR } from '../positions';

const emptyForm = {
  firstName: '',
  lastName: '',
  displayName: '',
  number: '',
  photoUrl: '',
  position: POSITIONS[0],
  imageAuthorized: true,
};

function byField(field) {
  return (a, b) => (a[field] || '').localeCompare(b[field] || '');
}

const SORTS = {
  lastName: { label: 'Apellidos', compare: (a, b) => byField('lastName')(a, b) || byField('firstName')(a, b) },
  firstName: { label: 'Nombre', compare: (a, b) => byField('firstName')(a, b) || byField('lastName')(a, b) },
  number: { label: 'Dorsal', compare: (a, b) => (a.number ?? 0) - (b.number ?? 0) },
};

export default function PlayersAdmin({ clubId, teamId, teamName }) {
  const { players, addPlayer, updatePlayer, removePlayer } = usePlayers(clubId, teamId);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('lastName');

  const visiblePlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? players.filter((p) => {
          const haystack = `${p.firstName || ''} ${p.lastName || ''} ${p.displayName || ''} ${p.number ?? ''}`.toLowerCase();
          return haystack.includes(needle);
        })
      : players;
    return [...filtered].sort(SORTS[sortBy].compare);
  }, [players, search, sortBy]);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      displayName: p.displayName || '',
      number: p.number ?? '',
      photoUrl: p.photoUrl || '',
      position: p.position || POSITIONS[0],
      imageAuthorized: p.imageAuthorized !== false,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || form.number === '') return;
    const data = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      displayName: form.displayName.trim() || form.firstName.trim(),
      number: Number(form.number),
      photoUrl: form.photoUrl.trim() || null,
      position: form.position,
      isGK: form.position === 'Portero',
      imageAuthorized: form.imageAuthorized,
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
      <p className="modal-hint">Plantilla de <strong>{teamName}</strong></p>

      <form className="player-form" onSubmit={handleSubmit}>
        <input
          className="player-form-input"
          placeholder="Nombre"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          required
        />
        <input
          className="player-form-input"
          placeholder="Apellidos"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
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
        <label className="player-form-checkbox">
          <input
            type="checkbox"
            checked={form.imageAuthorized}
            onChange={(e) => setForm({ ...form, imageAuthorized: e.target.checked })}
          />
          Autorización de imagen (familia ha dado el consentimiento)
        </label>
        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" type="submit">
            {editingId ? 'GUARDAR' : 'AÑADIR JUGADOR'}
          </button>
          {editingId && (
            <button type="button" className="modal-cancel" onClick={cancelEdit}>Cancelar</button>
          )}
        </div>
      </form>

      <div className="list-search">
        <input
          className="player-form-input"
          placeholder="Buscar por nombre, apellidos o dorsal…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="player-form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {Object.entries(SORTS).map(([key, { label }]) => (
            <option key={key} value={key}>Ordenar por {label}</option>
          ))}
        </select>
      </div>

      <div className="admin-list">
        {visiblePlayers.map((p) => (
          <div key={p.id} className="admin-row">
            {p.photoUrl ? (
              <img className="player-thumb" src={p.photoUrl} alt="" />
            ) : (
              <div className="player-thumb player-thumb--placeholder">{p.number}</div>
            )}
            <div className="admin-user-info">
              <span className="admin-user-name">#{p.number} {p.displayName}{p.imageAuthorized === false ? ' (sin imagen)' : ''}</span>
              <span className="admin-user-email">{p.firstName} {p.lastName} · {POSITION_ABBR[p.position] || p.position}</span>
            </div>
            <button className="btn btn-timeout" onClick={() => startEdit(p)}>Editar</button>
            <button className="btn btn-timeout btn-danger-text" onClick={() => removePlayer(p.id)}>Borrar</button>
          </div>
        ))}
        {players.length === 0 && <p className="modal-hint">No hay jugadores en este equipo todavía.</p>}
        {players.length > 0 && visiblePlayers.length === 0 && <p className="modal-hint">Ningún jugador coincide con la búsqueda.</p>}
      </div>
    </div>
  );
}
