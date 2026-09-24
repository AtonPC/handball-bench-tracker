import { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Settings, Trash2, UserPlus, Users, X } from 'lucide-react';
import { usePlayers } from '../hooks/usePlayers';
import { useClubs } from '../hooks/useClubs';
import { useTeams } from '../hooks/useTeams';
import { POSITIONS, POSITION_ABBR } from '../positions';
import PhotoCropModal from './PhotoCropModal';

const emptyForm = {
  firstName: '',
  lastName: '',
  displayName: '',
  number: '',
  photoUrl: '',
  position: '',
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

// Una fila por jugador: Nombre, Apellidos, Dorsal, Posición (opcional),
// Nombre en camiseta/panel (opcional). Acepta tabulaciones (pegado directo
// de una hoja de cálculo), comas o punto y coma.
function parseBulkLine(line, lineNumber) {
  const raw = line.trim();
  if (!raw) return null;
  const parts = splitLine(raw).map((s) => s.trim());
  const [firstName, lastName, numberText, positionText, displayNameText] = parts;
  if (!firstName || !lastName || !numberText) {
    return { error: `Línea ${lineNumber}: falta nombre, apellidos o dorsal ("${raw}")` };
  }
  const number = Number(numberText);
  if (!Number.isFinite(number)) {
    return { error: `Línea ${lineNumber}: dorsal no numérico ("${numberText}")` };
  }
  const position = findPosition(positionText) || '';
  return {
    player: {
      firstName,
      lastName,
      displayName: displayNameText || firstName,
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

// Campo con su etiqueta SIEMPRE visible encima (2026-09-24, a petición del usuario: antes
// el único texto era el placeholder de dentro del cuadro, que desaparece en cuanto hay
// algo escrito — al editar un jugador ya con datos no había forma de saber qué campo era
// cuál sin borrarlo primero). Mismo estilo de etiqueta en mayúsculas pequeñas que ya se
// usa en el resto de la consola (tc-h/ph-h/chrono-row-label).
function Field({ label, children }) {
  return (
    <label className="pf-field">
      <span className="pf-label">{label}</span>
      {children}
    </label>
  );
}

export default function PlayersAdmin({ clubId, teamId, teamName }) {
  const { players, addPlayer, updatePlayer, removePlayer, backfillRosterDirectory } = usePlayers(clubId, teamId);
  const backfilledTeams = useRef(new Set());
  useEffect(() => {
    if (teamId && players.length > 0 && !backfilledTeams.current.has(teamId)) {
      backfilledTeams.current.add(teamId);
      backfillRosterDirectory();
    }
  }, [teamId, players, backfillRosterDirectory]);

  // Pantalla abierta ahora mismo, en vez de tenerlo todo siempre a la vista (2026-09-24,
  // a petición del usuario): null (el menú de 3 botones) | 'add' | 'edit' | 'list' (Editar
  // plantilla) | 'bulk' (Carga masiva). Editar un jugador desde la lista abre 'edit' y,
  // al guardar o cancelar, vuelve a 'list' — añadir uno nuevo se queda en 'add' (el
  // formulario se vacía solo) para poder seguir dando de alta sin volver al menú cada vez.
  const [screen, setScreen] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('lastName');
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPosition, setBulkPosition] = useState('');
  const [bulkPositionBusy, setBulkPositionBusy] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [moveClubId, setMoveClubId] = useState('');
  const [moveTeamId, setMoveTeamId] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const { clubs: allClubs } = useClubs(true);
  const { teams: moveClubTeams } = useTeams(moveClubId || clubId);
  const [cropSource, setCropSource] = useState(null);
  const photoFileInputRef = useRef(null);

  function handlePhotoFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCropSource(URL.createObjectURL(file));
  }
  function handleCropConfirm(dataUrl) {
    setForm((f) => ({ ...f, photoUrl: dataUrl }));
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }
  function handleCropCancel() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }

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

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setScreen('add');
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      displayName: p.displayName || '',
      number: p.number ?? '',
      photoUrl: p.photoUrl || '',
      position: p.position || '',
      imageAuthorized: p.imageAuthorized !== false,
    });
    setScreen('edit');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setScreen('list');
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

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAllVisible() {
    const visibleIds = visiblePlayers.map((p) => p.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : visibleIds);
  }

  async function applyBulkPosition() {
    setBulkPositionBusy(true);
    for (const id of selectedIds) {
      await updatePlayer(id, { position: bulkPosition, isGK: bulkPosition === 'Portero' });
    }
    setBulkPositionBusy(false);
    setSelectedIds([]);
    setBulkPosition('');
  }

  async function applyBulkMove() {
    if (!moveTeamId) return;
    setMoveBusy(true);
    for (const id of selectedIds) {
      await updatePlayer(id, { clubId: moveClubId || clubId, teamId: moveTeamId });
    }
    setMoveBusy(false);
    setSelectedIds([]);
    setMoveTeamId('');
  }

  // Marca varios y bórralos de golpe (2026-09-24, a petición del usuario) — o marca
  // uno solo para editarlo (más abajo, editSelected). Con confirmación: a diferencia
  // de borrar uno con el cubo de la fila, aquí se puede borrar a toda la plantilla de
  // una vez.
  async function applyBulkDelete() {
    const n = selectedIds.length;
    if (!confirm(`¿Borrar ${n} jugador${n === 1 ? '' : 'es'}? No se puede deshacer.`)) return;
    setBulkDeleteBusy(true);
    for (const id of selectedIds) {
      await removePlayer(id);
    }
    setBulkDeleteBusy(false);
    setSelectedIds([]);
  }

  function editSelected() {
    const p = players.find((x) => x.id === selectedIds[0]);
    if (p) {
      startEdit(p);
      setSelectedIds([]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || form.number === '' || !form.position) return;
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
      setScreen('list');
      setEditingId(null);
      setForm(emptyForm);
    } else {
      await addPlayer(data);
      setForm(emptyForm); // «Añadir jugador» se queda abierto, listo para el siguiente
    }
  }

  const playerForm = (
    <form className="plantilla-form" onSubmit={handleSubmit}>
      <Field label="Nombre">
        <input
          className="player-form-input"
          placeholder="Nombre"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          required
        />
      </Field>
      <Field label="Apellidos">
        <input
          className="player-form-input"
          placeholder="Apellidos"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          required
        />
      </Field>
      <Field label="Nombre en camiseta o panel (opcional — si no se indica, se usa el Nombre)">
        <input
          className="player-form-input"
          placeholder="p. ej. Ainhoa G."
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
        />
      </Field>
      <Field label="Dorsal">
        <input
          className="player-form-input player-form-input--number"
          type="number"
          placeholder="Dorsal"
          value={form.number}
          onChange={(e) => setForm({ ...form, number: e.target.value })}
          required
        />
      </Field>
      <Field label="Foto (opcional)">
        <div className="player-form-photo">
          {form.photoUrl ? (
            <img className="player-thumb" src={form.photoUrl} alt="" />
          ) : (
            <div className="player-thumb player-thumb--placeholder">?</div>
          )}
          <input
            className="player-form-input"
            placeholder="URL de foto"
            value={form.photoUrl}
            onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
          />
          <input
            ref={photoFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoFileChange}
          />
          <button type="button" className="btn btn-timeout" onClick={() => photoFileInputRef.current?.click()}>
            Subir y recortar
          </button>
        </div>
      </Field>
      <Field label="Posición">
        <select
          className="player-form-input"
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
          required
        >
          <option value="" disabled>Selecciona posición…</option>
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
      </Field>
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
  );

  return (
    <div className="admin-panel plantilla">
      <div className="plantilla-head">
        <h2 className="plantilla-title">Plantilla</h2>
        <p className="plantilla-sub">{teamName} · {players.length} jugador{players.length === 1 ? '' : 'es'}</p>
      </div>

      <div className="plantilla-menu">
        <button type="button" className="plantilla-card" onClick={openAdd} aria-label="Añadir jugador">
          <UserPlus size={22} />
          <span className="plantilla-card-t">Añadir jugador</span>
          <span className="plantilla-card-d">Da de alta un jugador nuevo</span>
        </button>
        <button type="button" className="plantilla-card" onClick={() => setScreen('list')} aria-label="Editar plantilla">
          <Users size={22} />
          <span className="plantilla-card-t">Editar plantilla</span>
          <span className="plantilla-card-d">Busca, corrige o borra a los que ya están</span>
        </button>
        <button type="button" className="plantilla-card" onClick={() => { setBulkResult(null); setScreen('bulk'); }} aria-label="Carga masiva">
          <FileSpreadsheet size={22} />
          <span className="plantilla-card-t">Carga masiva</span>
          <span className="plantilla-card-d">Pega varias filas de golpe (hoja de cálculo)</span>
        </button>
      </div>

      {(screen === 'add' || screen === 'edit') && (
        <div className="modal-backdrop" onClick={() => setScreen(screen === 'edit' ? 'list' : null)}>
          <div className="modal plantilla-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={editingId ? 'Editar jugador' : 'Añadir jugador'}>
            <div className="plantilla-modal-head">
              <h2>{editingId ? 'Editar jugador' : 'Añadir jugador'}</h2>
              <button type="button" className="shp-close" onClick={() => setScreen(screen === 'edit' ? 'list' : null)} aria-label="Cerrar"><X size={20} /></button>
            </div>
            {playerForm}
          </div>
        </div>
      )}

      {screen === 'bulk' && (
        <div className="modal-backdrop" onClick={() => setScreen(null)}>
          <div className="modal plantilla-modal plantilla-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Carga masiva">
            <div className="plantilla-modal-head">
              <h2>Carga masiva</h2>
              <button type="button" className="shp-close" onClick={() => setScreen(null)} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <form className="plantilla-form" onSubmit={handleBulkImport}>
              <p className="modal-hint" style={{ margin: 0 }}>
                Un jugador por línea: Nombre, Apellidos, Dorsal, Posición (opcional) y Nombre en camiseta/panel
                (opcional, si no se indica se usa el Nombre). Separa los campos con comas, punto y coma, o pega
                directamente varias columnas de una hoja de cálculo.
              </p>
              <textarea
                className="player-form-input"
                rows={8}
                placeholder={'Ainhoa, García, 7, Extremo Izquierdo, Ainhoa G.\nMarc, López, 12'}
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
          </div>
        </div>
      )}

      {screen === 'list' && (
        <div className="modal-backdrop" onClick={() => setScreen(null)}>
          <div className="modal plantilla-modal plantilla-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Editar plantilla">
            <div className="plantilla-modal-head">
              <h2>Editar plantilla</h2>
              <button type="button" className="shp-close" onClick={() => setScreen(null)} aria-label="Cerrar"><X size={20} /></button>
            </div>

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

            {visiblePlayers.length > 0 && (
              <label className="player-form-checkbox" style={{ marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={visiblePlayers.length > 0 && visiblePlayers.every((p) => selectedIds.includes(p.id))}
                  onChange={toggleSelectAllVisible}
                />
                Seleccionar todos ({selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'})
              </label>
            )}

            {/* Acción principal de la selección (2026-09-24, a petición del usuario): marcar
                varios y borrarlos de golpe, o marcar uno solo y editarlo — sustituye a los
                iconos de lápiz/cubo que había antes en cada fila. */}
            {selectedIds.length > 0 && (
              <div className="player-form" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="modal-hint" style={{ margin: 0 }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}:</span>
                {selectedIds.length === 1 && (
                  <button type="button" className="btn btn-timeout" onClick={editSelected}>
                    <Settings size={16} /> EDITAR
                  </button>
                )}
                <button type="button" className="btn btn-danger" disabled={bulkDeleteBusy} onClick={applyBulkDelete}>
                  <Trash2 size={16} /> {bulkDeleteBusy ? 'BORRANDO…' : `BORRAR${selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}`}
                </button>
                <button type="button" className="modal-cancel" onClick={() => setSelectedIds([])}>Cancelar selección</button>
              </div>
            )}

            {selectedIds.length > 0 && (
              <div className="player-form" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="modal-hint" style={{ margin: 0 }}>Poner posición a {selectedIds.length} jugador{selectedIds.length === 1 ? '' : 'es'}:</span>
                <select className="player-form-input" value={bulkPosition} onChange={(e) => setBulkPosition(e.target.value)}>
                  <option value="" disabled>Selecciona posición…</option>
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-clock btn-start"
                  disabled={!bulkPosition || bulkPositionBusy}
                  onClick={applyBulkPosition}
                >
                  {bulkPositionBusy ? 'APLICANDO…' : 'APLICAR'}
                </button>
              </div>
            )}

            {selectedIds.length > 0 && (
              <div className="player-form" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="modal-hint" style={{ margin: 0 }}>Mover {selectedIds.length} jugador{selectedIds.length === 1 ? '' : 'es'} a otro equipo:</span>
                <select
                  className="player-form-input"
                  value={moveClubId || clubId}
                  onChange={(e) => {
                    setMoveClubId(e.target.value);
                    setMoveTeamId('');
                  }}
                >
                  {allClubs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select className="player-form-input" value={moveTeamId} onChange={(e) => setMoveTeamId(e.target.value)}>
                  <option value="" disabled>Selecciona equipo…</option>
                  {moveClubTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-clock btn-start"
                  disabled={!moveTeamId || moveBusy}
                  onClick={applyBulkMove}
                >
                  {moveBusy ? 'MOVIENDO…' : 'MOVER'}
                </button>
              </div>
            )}

            <div className="admin-list">
              {visiblePlayers.map((p) => (
                <div key={p.id} className="admin-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelected(p.id)}
                  />
                  {p.photoUrl ? (
                    <img className="player-thumb" src={p.photoUrl} alt="" />
                  ) : (
                    <div className="player-thumb player-thumb--placeholder">{p.number}</div>
                  )}
                  <div className="admin-user-info">
                    <span className="admin-user-name">#{p.number} {p.displayName}{p.imageAuthorized === false ? ' (sin imagen)' : ''}</span>
                    <span className="admin-user-email">{p.firstName} {p.lastName} · {POSITION_ABBR[p.position] || p.position || 'Sin posición'}</span>
                  </div>
                </div>
              ))}
              {players.length === 0 && <p className="modal-hint">No hay jugadores en este equipo todavía.</p>}
              {players.length > 0 && visiblePlayers.length === 0 && <p className="modal-hint">Ningún jugador coincide con la búsqueda.</p>}
            </div>
          </div>
        </div>
      )}

      {cropSource && (
        <PhotoCropModal imageSrc={cropSource} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}
    </div>
  );
}
