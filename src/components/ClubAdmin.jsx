import { useState } from 'react';
import { Settings, Shield, Swords, X } from 'lucide-react';
import { useTeams, useRivalTeams } from '../hooks/useTeams';
import { useLeagues } from '../hooks/useLeagues';
import { useClubs } from '../hooks/useClubs';
import { useAuth } from '../hooks/useAuth';
import { CATEGORIES } from '../categories';

const emptyForm = {
  name: '', category: CATEGORIES[0], leagueId: '', crestUrl: '',
  primaryColor: '#1f4fa3', secondaryColor: '#ffffff', goalPhrase: '', isClub: true, isRival: false,
};
const emptyRivalClubForm = { clubName: '', teamName: '', category: CATEGORIES[0], leagueId: '', crestUrl: '' };

// Edición masiva (2026-09-24, a petición del usuario): con varios equipos marcados
// solo tiene sentido tocar de golpe lo que es "de la ficha del partido", no los
// datos propios del club (nombre, escudo, colores, frase de gol) — esos siguen
// necesitando EDITAR uno a uno.
const emptyBulkForm = { category: CATEGORIES[0], leagueId: '', isClub: true, isRival: false };

// Campo con su etiqueta SIEMPRE visible encima — mismo patrón que Plantilla
// (PlayersAdmin.jsx), reutilizado aquí para el mismo aspecto de marca.
function Field({ label, children }) {
  return (
    <label className="pf-field">
      <span className="pf-label">{label}</span>
      {children}
    </label>
  );
}

// Ficha de un club/liga/categoría, con escudo — misma fila para "Equipos del club"
// y "Rivales" (2026-09-24, a petición del usuario: mismo listado con nombre, escudo,
// liga y categoría en los dos sitios).
function TeamRow({ t, leagueName, selected, onToggle, selectable }) {
  return (
    <div className="admin-row">
      {selectable && (
        <input type="checkbox" checked={selected} onChange={onToggle} />
      )}
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
        <span className="admin-user-email">{leagueName || 'Sin liga'} · {t.category || 'Sin categoría'}</span>
      </div>
    </div>
  );
}

export default function ClubAdmin({ clubId }) {
  const { teams, addTeam, updateTeam, removeTeam } = useTeams(clubId);
  const rivalTeams = useRivalTeams();
  const { leagues } = useLeagues(true);
  const { addClubAsManager } = useClubs(false);
  const { user } = useAuth();

  // null (menú de 2 botones) | 'club' (Equipos del club) | 'rival' (Rivales) |
  // 'form' (añadir/editar un equipo propio) | 'newRivalClub' (fichar un club rival) |
  // 'bulkEdit' (editar categoría/liga/club-rival de varios equipos a la vez).
  const [screen, setScreen] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [rivalClubForm, setRivalClubForm] = useState(emptyRivalClubForm);
  const [rivalClubBusy, setRivalClubBusy] = useState(false);
  const [rivalClubError, setRivalClubError] = useState('');
  const [bulkEditFrom, setBulkEditFrom] = useState('club'); // a qué lista volver al cerrar
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);
  const [bulkEditBusy, setBulkEditBusy] = useState(false);

  const leagueName = (leagueId) => leagues.find((l) => l.id === leagueId)?.name || '';

  // Un equipo sin isClub (de antes de esto) cuenta como propio.
  const clubTeams = teams.filter((t) => t.isClub !== false);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setScreen('form');
  }

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
      isClub: t.isClub !== false,
      isRival: !!t.isRival,
    });
    setScreen('form');
  }

  function backToList() {
    setEditingId(null);
    setForm(emptyForm);
    setScreen('club');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const data = { ...form, leagueId: form.leagueId || null };
    if (editingId) {
      await updateTeam(editingId, data);
      backToList();
    } else {
      await addTeam(data);
      setForm(emptyForm); // se queda abierto, listo para el siguiente
    }
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleSelectAll(list) {
    const ids = list.map((t) => t.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : ids);
  }

  function editSelected(list) {
    const t = list.find((x) => x.id === selectedIds[0]);
    if (t) {
      setSelectedIds([]);
      startEdit(t);
    }
  }
  async function deleteSelected() {
    const n = selectedIds.length;
    if (!confirm(`¿Borrar ${n} equipo${n === 1 ? '' : 's'}? No se puede deshacer.`)) return;
    for (const id of selectedIds) await removeTeam(id);
    setSelectedIds([]);
  }

  // Con varios equipos marcados, solo se pueden tocar de golpe categoría, liga
  // y si son club/rival — no los datos propios de cada uno (nombre, escudo,
  // colores, frase de gol). Se parte de los valores del primero marcado, como
  // punto de partida, no como "sin cambios" por campo.
  function openBulkEdit(list) {
    const first = list.find((t) => t.id === selectedIds[0]);
    setBulkForm({
      category: first?.category || CATEGORIES[0],
      leagueId: first?.leagueId || '',
      isClub: first ? first.isClub !== false : true,
      isRival: !!first?.isRival,
    });
    setBulkEditFrom(list === rivalTeams ? 'rival' : 'club');
    setScreen('bulkEdit');
  }

  async function applyBulkEdit() {
    setBulkEditBusy(true);
    const data = { category: bulkForm.category, leagueId: bulkForm.leagueId || null, isClub: bulkForm.isClub, isRival: bulkForm.isRival };
    for (const id of selectedIds) await updateTeam(id, data);
    setBulkEditBusy(false);
    setSelectedIds([]);
    setScreen(bulkEditFrom);
  }

  async function handleCreateRivalClub(e) {
    e.preventDefault();
    if (!rivalClubForm.clubName.trim()) return;
    setRivalClubBusy(true);
    setRivalClubError('');
    try {
      const clubRef = await addClubAsManager(rivalClubForm.clubName.trim(), user.uid);
      await addTeam({
        clubId: clubRef.id,
        name: (rivalClubForm.teamName || rivalClubForm.clubName).trim(),
        category: rivalClubForm.category,
        leagueId: rivalClubForm.leagueId || null,
        crestUrl: rivalClubForm.crestUrl.trim(),
        isClub: false,
        isRival: true,
      });
      setRivalClubForm(emptyRivalClubForm);
      setScreen('rival');
    } catch (err) {
      console.error('No se pudo fichar el club rival', err);
      setRivalClubError(`No se pudo crear: ${err.message}`);
    } finally {
      setRivalClubBusy(false);
    }
  }

  const teamForm = (
    <form className="plantilla-form" onSubmit={handleSubmit}>
      <Field label="Nombre del equipo">
        <input
          className="player-form-input"
          placeholder="Nombre del equipo"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </Field>
      <Field label="Categoría">
        <select className="player-form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Liga (opcional)">
        <select className="player-form-input" value={form.leagueId} onChange={(e) => setForm({ ...form, leagueId: e.target.value })}>
          <option value="">Sin liga</option>
          {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Escudo (opcional)">
        <input
          className="player-form-input"
          placeholder="URL del escudo"
          value={form.crestUrl}
          onChange={(e) => setForm({ ...form, crestUrl: e.target.value })}
        />
      </Field>
      <Field label="Color principal">
        <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
      </Field>
      <Field label="Color secundario">
        <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
      </Field>
      <Field label="Frase o grito de gol (opcional)">
        <input
          className="player-form-input"
          placeholder="Frase / grito de gol"
          value={form.goalPhrase}
          onChange={(e) => setForm({ ...form, goalPhrase: e.target.value })}
        />
      </Field>
      {/* 2026-09-24, a petición del usuario: en la misma liga puede haber dos equipos
          del mismo club — son rivales entre sí pero pertenecen al mismo club, así que
          Club y Rival son dos casillas independientes, se pueden marcar las dos. */}
      <Field label="Este equipo es…">
        <div className="plantilla-check-row">
          <label className="player-form-checkbox">
            <input type="checkbox" checked={form.isClub} onChange={(e) => setForm({ ...form, isClub: e.target.checked })} />
            Club (mío, aparece en el selector de equipo)
          </label>
          <label className="player-form-checkbox">
            <input type="checkbox" checked={form.isRival} onChange={(e) => setForm({ ...form, isRival: e.target.checked })} />
            Rival (se puede elegir como rival al crear un partido)
          </label>
        </div>
      </Field>
      <div className="player-form-actions">
        <button className="btn btn-clock btn-start" type="submit">{editingId ? 'GUARDAR' : 'AÑADIR EQUIPO'}</button>
        {editingId && <button type="button" className="modal-cancel" onClick={backToList}>Cancelar</button>}
      </div>
    </form>
  );

  return (
    <div className="admin-panel plantilla">
      <div className="plantilla-head">
        <h2 className="plantilla-title">Club</h2>
        <p className="plantilla-sub">{clubTeams.length} equipo{clubTeams.length === 1 ? '' : 's'} propio{clubTeams.length === 1 ? '' : 's'}</p>
      </div>

      <div className="plantilla-menu">
        <button type="button" className="plantilla-card" onClick={() => setScreen('club')} aria-label="Equipos del club">
          <Shield size={22} />
          <span className="plantilla-card-t">Equipos del club</span>
          <span className="plantilla-card-d">Los equipos que gestionas tú</span>
        </button>
        <button type="button" className="plantilla-card" onClick={() => setScreen('rival')} aria-label="Rivales del club">
          <Swords size={22} />
          <span className="plantilla-card-t">Rivales del club</span>
          <span className="plantilla-card-d">Equipos que puedes elegir como rival al crear un partido</span>
        </button>
      </div>

      {screen === 'form' && (
        <div className="modal-backdrop" onClick={() => setScreen(editingId ? 'club' : null)}>
          <div className="modal plantilla-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={editingId ? 'Editar equipo' : 'Añadir equipo'}>
            <div className="plantilla-modal-head">
              <h2>{editingId ? 'Editar equipo' : 'Añadir equipo'}</h2>
              <button type="button" className="shp-close" onClick={() => setScreen(editingId ? 'club' : null)} aria-label="Cerrar"><X size={20} /></button>
            </div>
            {teamForm}
          </div>
        </div>
      )}

      {screen === 'bulkEdit' && (
        <div className="modal-backdrop" onClick={() => setScreen(bulkEditFrom)}>
          <div className="modal plantilla-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edición masiva">
            <div className="plantilla-modal-head">
              <h2>Edición masiva ({selectedIds.length} equipos)</h2>
              <button type="button" className="shp-close" onClick={() => setScreen(bulkEditFrom)} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <form
              className="plantilla-form"
              onSubmit={(e) => { e.preventDefault(); applyBulkEdit(); }}
            >
              <p className="modal-hint" style={{ margin: 0 }}>
                Solo se puede cambiar de golpe la categoría, la liga y si son club/rival — el nombre, el escudo, los
                colores y la frase de gol son propios de cada equipo y se editan uno a uno.
              </p>
              <Field label="Categoría">
                <select className="player-form-input" value={bulkForm.category} onChange={(e) => setBulkForm({ ...bulkForm, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Liga">
                <select className="player-form-input" value={bulkForm.leagueId} onChange={(e) => setBulkForm({ ...bulkForm, leagueId: e.target.value })}>
                  <option value="">Sin liga</option>
                  {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
              <Field label="Estos equipos son…">
                <div className="plantilla-check-row">
                  <label className="player-form-checkbox">
                    <input type="checkbox" checked={bulkForm.isClub} onChange={(e) => setBulkForm({ ...bulkForm, isClub: e.target.checked })} />
                    Club (mío, aparece en el selector de equipo)
                  </label>
                  <label className="player-form-checkbox">
                    <input type="checkbox" checked={bulkForm.isRival} onChange={(e) => setBulkForm({ ...bulkForm, isRival: e.target.checked })} />
                    Rival (se puede elegir como rival al crear un partido)
                  </label>
                </div>
              </Field>
              <div className="player-form-actions">
                <button className="btn btn-clock btn-start" type="submit" disabled={bulkEditBusy}>
                  {bulkEditBusy ? 'APLICANDO…' : `APLICAR A ${selectedIds.length}`}
                </button>
                <button type="button" className="modal-cancel" onClick={() => setScreen(bulkEditFrom)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {screen === 'newRivalClub' && (
        <div className="modal-backdrop" onClick={() => setScreen('rival')}>
          <div className="modal plantilla-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Fichar club rival">
            <div className="plantilla-modal-head">
              <h2>Nuevo club rival</h2>
              <button type="button" className="shp-close" onClick={() => setScreen('rival')} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <form className="plantilla-form" onSubmit={handleCreateRivalClub}>
              <p className="modal-hint" style={{ margin: 0 }}>
                Crea el club rival y su equipo — a partir de ahora aparecerá en la lista de rivales, también para
                otros clubes (así no hace falta darlo de alta cada vez que alguien juega contra él).
              </p>
              {rivalClubError && <p className="warning-banner">{rivalClubError}</p>}
              <Field label="Nombre del club">
                <input
                  className="player-form-input"
                  placeholder="p. ej. CB Ejemplo"
                  value={rivalClubForm.clubName}
                  onChange={(e) => setRivalClubForm({ ...rivalClubForm, clubName: e.target.value })}
                  required
                />
              </Field>
              <Field label="Nombre del equipo (opcional — si no se indica, se usa el del club)">
                <input
                  className="player-form-input"
                  placeholder={rivalClubForm.clubName || 'Nombre del equipo'}
                  value={rivalClubForm.teamName}
                  onChange={(e) => setRivalClubForm({ ...rivalClubForm, teamName: e.target.value })}
                />
              </Field>
              <Field label="Categoría">
                <select className="player-form-input" value={rivalClubForm.category} onChange={(e) => setRivalClubForm({ ...rivalClubForm, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Liga (opcional)">
                <select className="player-form-input" value={rivalClubForm.leagueId} onChange={(e) => setRivalClubForm({ ...rivalClubForm, leagueId: e.target.value })}>
                  <option value="">Sin liga</option>
                  {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
              <Field label="Escudo (opcional)">
                <input
                  className="player-form-input"
                  placeholder="URL del escudo"
                  value={rivalClubForm.crestUrl}
                  onChange={(e) => setRivalClubForm({ ...rivalClubForm, crestUrl: e.target.value })}
                />
              </Field>
              <div className="player-form-actions">
                <button className="btn btn-clock btn-start" type="submit" disabled={rivalClubBusy}>
                  {rivalClubBusy ? 'CREANDO…' : 'CREAR CLUB RIVAL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {screen === 'club' && (
        <div className="modal-backdrop" onClick={() => { setScreen(null); setSelectedIds([]); }}>
          <div className="modal plantilla-modal plantilla-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Equipos del club">
            <div className="plantilla-modal-head">
              <h2>Equipos del club</h2>
              <button type="button" className="shp-close" onClick={() => { setScreen(null); setSelectedIds([]); }} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <div className="player-form-actions">
              <button type="button" className="btn btn-clock btn-start" onClick={openAdd}>+ AÑADIR EQUIPO</button>
            </div>

            {clubTeams.length > 0 && (
              <label className="player-form-checkbox">
                <input
                  type="checkbox"
                  checked={clubTeams.every((t) => selectedIds.includes(t.id))}
                  onChange={() => toggleSelectAll(clubTeams)}
                />
                Seleccionar todos ({selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'})
              </label>
            )}

            {selectedIds.length > 0 && (
              <div className="player-form" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="modal-hint" style={{ margin: 0 }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}:</span>
                {selectedIds.length === 1 && (
                  <button type="button" className="btn btn-timeout" onClick={() => editSelected(clubTeams)}>
                    <Settings size={16} /> EDITAR
                  </button>
                )}
                {selectedIds.length > 1 && (
                  <button type="button" className="btn btn-timeout" onClick={() => openBulkEdit(clubTeams)}>
                    <Settings size={16} /> EDICIÓN MASIVA
                  </button>
                )}
                <button type="button" className="btn btn-danger" onClick={deleteSelected}>
                  BORRAR{selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}
                </button>
                <button type="button" className="modal-cancel" onClick={() => setSelectedIds([])}>Cancelar selección</button>
              </div>
            )}

            <div className="admin-list">
              {clubTeams.map((t) => (
                <TeamRow
                  key={t.id}
                  t={t}
                  leagueName={leagueName(t.leagueId)}
                  selected={selectedIds.includes(t.id)}
                  onToggle={() => toggleSelected(t.id)}
                  selectable
                />
              ))}
              {clubTeams.length === 0 && <p className="modal-hint">Todavía no hay equipos en este club.</p>}
            </div>
          </div>
        </div>
      )}

      {screen === 'rival' && (
        <div className="modal-backdrop" onClick={() => { setScreen(null); setSelectedIds([]); }}>
          <div className="modal plantilla-modal plantilla-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Rivales del club">
            <div className="plantilla-modal-head">
              <h2>Rivales del club</h2>
              <button type="button" className="shp-close" onClick={() => { setScreen(null); setSelectedIds([]); }} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <p className="modal-hint" style={{ margin: 0 }}>
              Equipos que puedes elegir como rival al crear un partido — compartidos con cualquier otro club (evita
              dar de alta el mismo rival dos veces). Solo puedes corregir o borrar los que fichó tu propio club.
            </p>
            <div className="player-form-actions">
              <button type="button" className="btn btn-clock btn-start" onClick={() => setScreen('newRivalClub')}>+ FICHAR CLUB RIVAL</button>
            </div>

            {selectedIds.length > 0 && (
              <div className="player-form" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="modal-hint" style={{ margin: 0 }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}:</span>
                {selectedIds.length === 1 && (
                  <button type="button" className="btn btn-timeout" onClick={() => editSelected(rivalTeams)}>
                    <Settings size={16} /> EDITAR
                  </button>
                )}
                {selectedIds.length > 1 && (
                  <button type="button" className="btn btn-timeout" onClick={() => openBulkEdit(rivalTeams)}>
                    <Settings size={16} /> EDICIÓN MASIVA
                  </button>
                )}
                <button type="button" className="btn btn-danger" onClick={deleteSelected}>
                  BORRAR{selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}
                </button>
                <button type="button" className="modal-cancel" onClick={() => setSelectedIds([])}>Cancelar selección</button>
              </div>
            )}

            <div className="admin-list">
              {rivalTeams.map((t) => (
                <TeamRow
                  key={t.id}
                  t={t}
                  leagueName={leagueName(t.leagueId)}
                  selected={selectedIds.includes(t.id)}
                  onToggle={() => toggleSelected(t.id)}
                  selectable={t.clubId === clubId}
                />
              ))}
              {rivalTeams.length === 0 && <p className="modal-hint">Todavía no hay ningún rival fichado.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
