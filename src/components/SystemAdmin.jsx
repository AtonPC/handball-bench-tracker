import { useState } from 'react';
import { useLeagues } from '../hooks/useLeagues';
import { useClubs } from '../hooks/useClubs';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import { CATEGORIES } from '../categories';
import { SEASONS } from '../seasons';

const emptyLeague = { name: '', category: CATEGORIES[0], season: SEASONS[0] };

export default function SystemAdmin() {
  const { leagues, addLeague, updateLeague, removeLeague } = useLeagues(true);
  const { clubs, addClub, renameClub, addManager, removeManager, removeClub } = useClubs(true);
  const users = useUsersDirectory(true);
  const [leagueForm, setLeagueForm] = useState(emptyLeague);
  const [editingLeagueId, setEditingLeagueId] = useState(null);
  const [clubName, setClubName] = useState('');
  const [managerPick, setManagerPick] = useState({});
  const [editingClubId, setEditingClubId] = useState(null);
  const [editClubName, setEditClubName] = useState('');

  function startEditClub(c) {
    setEditingClubId(c.id);
    setEditClubName(c.name);
  }

  function cancelEditClub() {
    setEditingClubId(null);
    setEditClubName('');
  }

  async function saveClubName(id) {
    if (!editClubName.trim()) return;
    await renameClub(id, editClubName.trim());
    cancelEditClub();
  }

  function startEditLeague(l) {
    setEditingLeagueId(l.id);
    setLeagueForm({ name: l.name || '', category: l.category || CATEGORIES[0], season: l.season || SEASONS[0] });
  }

  function cancelEditLeague() {
    setEditingLeagueId(null);
    setLeagueForm(emptyLeague);
  }

  async function handleSubmitLeague(e) {
    e.preventDefault();
    if (!leagueForm.name.trim()) return;
    const data = {
      name: leagueForm.name.trim(),
      category: leagueForm.category,
      season: leagueForm.season,
    };
    if (editingLeagueId) {
      await updateLeague(editingLeagueId, data);
    } else {
      await addLeague(data);
    }
    cancelEditLeague();
  }

  async function handleAddClub(e) {
    e.preventDefault();
    if (!clubName.trim()) return;
    await addClub(clubName.trim());
    setClubName('');
  }

  function usersById(uid) {
    return users.find((u) => u.id === uid);
  }

  return (
    <div className="admin-panel">
      <p className="modal-hint">Ligas</p>
      <form className="player-form" onSubmit={handleSubmitLeague}>
        <input
          className="player-form-input"
          placeholder="Nombre de la liga"
          value={leagueForm.name}
          onChange={(e) => setLeagueForm({ ...leagueForm, name: e.target.value })}
          required
        />
        <select
          className="player-form-input"
          value={leagueForm.category}
          onChange={(e) => setLeagueForm({ ...leagueForm, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="player-form-input"
          value={leagueForm.season}
          onChange={(e) => setLeagueForm({ ...leagueForm, season: e.target.value })}
        >
          {SEASONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" type="submit">
            {editingLeagueId ? 'GUARDAR' : 'AÑADIR LIGA'}
          </button>
          {editingLeagueId && (
            <button type="button" className="modal-cancel" onClick={cancelEditLeague}>Cancelar</button>
          )}
        </div>
      </form>
      <div className="admin-list">
        {leagues.map((l) => (
          <div key={l.id} className="admin-row">
            <div className="admin-user-info">
              <span className="admin-user-name">{l.name}</span>
              <span className="admin-user-email">{[l.category, l.season].filter(Boolean).join(' · ')}</span>
            </div>
            <button className="btn btn-timeout" onClick={() => startEditLeague(l)}>Editar</button>
            <button className="btn btn-timeout btn-danger-text" onClick={() => removeLeague(l.id)}>Borrar</button>
          </div>
        ))}
        {leagues.length === 0 && <p className="modal-hint">Todavía no hay ligas.</p>}
      </div>

      <p className="modal-hint" style={{ marginTop: 24 }}>Clubes</p>
      <form className="player-form" onSubmit={handleAddClub}>
        <input
          className="player-form-input"
          placeholder="Nombre del club"
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          required
        />
        <button className="btn btn-clock btn-start" type="submit">AÑADIR CLUB</button>
      </form>
      <div className="admin-list">
        {clubs.map((c) => (
          <div key={c.id} className="admin-row" style={{ flexWrap: 'wrap' }}>
            {editingClubId === c.id ? (
              <>
                <input
                  className="player-form-input"
                  value={editClubName}
                  onChange={(e) => setEditClubName(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-timeout" onClick={() => saveClubName(c.id)}>Guardar</button>
                <button className="btn btn-timeout" onClick={cancelEditClub}>Cancelar</button>
              </>
            ) : (
              <>
                <div className="admin-user-info">
                  <span className="admin-user-name">{c.name}</span>
                  <span className="admin-user-email">
                    {c.managerUids.length === 0
                      ? 'Sin gestor asignado'
                      : c.managerUids.map((uid) => usersById(uid)?.displayName || uid).join(', ')}
                  </span>
                </div>
                <button className="btn btn-timeout" onClick={() => startEditClub(c)}>Editar</button>
              </>
            )}
            <select
              className="admin-role-select"
              value={managerPick[c.id] || ''}
              onChange={(e) => setManagerPick({ ...managerPick, [c.id]: e.target.value })}
            >
              <option value="">Elegir persona…</option>
              {users.filter((u) => !c.managerUids.includes(u.id)).map((u) => (
                <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
              ))}
            </select>
            <button
              className="btn btn-timeout"
              disabled={!managerPick[c.id]}
              onClick={async () => {
                await addManager(c.id, managerPick[c.id]);
                setManagerPick({ ...managerPick, [c.id]: '' });
              }}
            >
              Asignar gestor
            </button>
            {c.managerUids.map((uid) => (
              <button key={uid} className="btn btn-timeout btn-danger-text" onClick={() => removeManager(c.id, uid)}>
                Quitar {usersById(uid)?.displayName || uid}
              </button>
            ))}
            <button className="btn btn-timeout btn-danger-text" onClick={() => removeClub(c.id)}>Borrar club</button>
          </div>
        ))}
        {clubs.length === 0 && <p className="modal-hint">Todavía no hay clubes.</p>}
      </div>
    </div>
  );
}
