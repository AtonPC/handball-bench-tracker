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

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(';')) return line.split(';');
  return line.split(',');
}

function findPosition(text) {
  if (!text) return null;
  const needle = text.trim().toLowerCase();
  return POSITIONS.find((p) => p.toLowerCase() === needle || POSITION_ABBR[p].toLowerCase() === needle) || null;
}

// Una fila por jugador: Nombre, Apellidos, Dorsal, Posición (opcional).
// Acepta tabulaciones (pegado directo de una hoja de cálculo), comas o punto y coma.
function parseBulkLine(line, lineNumber) {
  const raw = line.trim();
  if (!raw) return null;
  const parts = splitLine(raw).map((s) => s.trim());
  const [firstName, lastName, numberText, positionText] = parts;
  if (!firstName || !lastName || !numberText) {
    return { error: `Línea ${lineNumber}: falta nombre, apellidos o dorsal ("${raw}")` };
  }
  const number = Number(numberText);
  if (!Number.isFinite(number)) {
    return { error: `Línea ${lineNumber}: dorsal no numérico ("${numberText}")` };
  }
  const position = findPosition(positionText) || POSITIONS[0];
  return {
    player: {
      firstName,
      lastName,
      displayName: firstName,
      number,
      photoUrl: null,
      position,
      isGK: position === 'Portero',
      imageAuthorized: true,
    },
  };
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
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

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

  async function handleBulkImport(e) {
    e.preventDefault();
    const lines = bulkText.split('\n');
    const parsed = lines.map((line, i) => parseBulkLine(line, i + 1)).filter(Boolean);
    const errors = parsed.filter((r) => r.error).map((r) => r.error);
    const toAdd = parsed.filter((r) => r.player).map((r) => r.player);

    setBulkBusy(true);
    let added = 0;
    for (const player of toAdd) {
      try {
        await addPlayer(player);
        added += 1;
      } catch (err) {
        errors.push(`${player.firstName} ${player.lastName}: ${err.message}`);
      }
    }
    setBulkBusy(false);
    setBulkResult({ added, errors });
    if (errors.length === 0) {
      setBulkText('');
    }
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
      <div className="matches-header">
        <p className="modal-hint">Plantilla de <strong>{teamName}</strong></p>
        <button
          type="button"
          className="btn btn-timeout"
          onClick={() => {
            setShowBulk((v) => !v);
            setBulkResult(null);
          }}
        >
          {showBulk ? 'CANCELAR CARGA MASIVA' : 'CARGA MASIVA'}
        </button>
      </div>

      {showBulk && (
        <form className="player-form" onSubmit={handleBulkImport}>
          <p className="modal-hint" style={{ margin: 0 }}>
            Un jugador por línea: Nombre, Apellidos, Dorsal y Posición (opcional). Separa los campos con comas,
            punto y coma, o pega directamente varias columnas de una hoja de cálculo.
          </p>
          <textarea
            className="player-form-input"
            rows={8}
            placeholder={'Ainhoa, García, 7, Extremo Izquierdo\nMarc, López, 12'}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="player-form-actions">
            <button className="btn btn-clock btn-start" type="submit" disabled={bulkBusy || !bulkText.trim()}>
              {bulkBusy ? 'IMPORTANDO…' : 'IMPORTAR'}
            </button>
          </div>
          {bulkResult && (
            <div className="modal-hint">
              {bulkResult.added > 0 && <p>Añadidos: {bulkResult.added} jugador{bulkResult.added === 1 ? '' : 'es'}.</p>}
              {bulkResult.errors.length > 0 && (
                <>
                  <p>Con errores ({bulkResult.errors.length}):</p>
                  <ul>
                    {bulkResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
        </form>
      )}

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
