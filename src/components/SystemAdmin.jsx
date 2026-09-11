import { useMemo, useState } from 'react';
import { useLeagues } from '../hooks/useLeagues';
import { useClubs } from '../hooks/useClubs';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import { useFollowerSessions } from '../hooks/useFollowerSessions';
import { CATEGORIES } from '../categories';
import { SEASONS } from '../seasons';
import { formatClock } from '../utils/time';

const emptyLeague = { name: '', category: CATEGORIES[0], season: SEASONS[0] };

const VIEW_LABELS = { live: 'Directo', 'match-stats': 'Estadísticas', chronology: 'Cronología', season: 'Temporada' };
const ACTIVE_THRESHOLD_MS = 90000; // 3x el "latido" de 30s de useFollowerSession

export default function SystemAdmin() {
  const { leagues, addLeague, updateLeague, removeLeague } = useLeagues(true);
  const { clubs, addClub, renameClub, addManager, removeManager, removeClub } = useClubs(true);
  const users = useUsersDirectory(true);
  const sessions = useFollowerSessions(true);
  const [userSearch, setUserSearch] = useState('');
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

  const visibleUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    const filtered = needle
      ? users.filter((u) => `${u.displayName || ''} ${u.email || ''}`.toLowerCase().includes(needle))
      : users;
    return [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [users, userSearch]);

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

      <p className="modal-hint" style={{ marginTop: 24 }}>Usuarios registrados ({users.length})</p>
      <div className="list-search">
        <input
          className="player-form-input"
          placeholder="Buscar por nombre o email…"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
      </div>
      <div className="admin-list">
        {visibleUsers.map((u) => (
          <div key={u.id} className="admin-row">
            <div className="admin-user-info">
              <span className="admin-user-name">
                {u.displayName || u.email}{u.systemRole === 'admin' ? ' · Administrador' : ''}
              </span>
              <span className="admin-user-email">
                {u.email} · Desde {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        ))}
        {users.length > 0 && visibleUsers.length === 0 && <p className="modal-hint">Ningún usuario coincide con la búsqueda.</p>}
        {users.length === 0 && <p className="modal-hint">Todavía no hay usuarios registrados.</p>}
      </div>

      <p className="modal-hint" style={{ marginTop: 24 }}>
        Actividad de Seguidores — cuándo se conectan, a qué equipo y qué ven
      </p>
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Equipo</th>
              <th>Conectado</th>
              <th>Última actividad</th>
              <th>Duración</th>
              <th>Qué ha visto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const isActiveNow = Date.now() - (s.lastActiveAt || 0) < ACTIVE_THRESHOLD_MS;
              const duration = Math.max(0, (s.lastActiveAt || s.startedAt || 0) - (s.startedAt || 0));
              const viewsSummary = Object.entries(s.viewCounts || {})
                .map(([k, v]) => `${VIEW_LABELS[k] || k} (${v})`)
                .join(', ') || '—';
              return (
                <tr key={s.id} className={isActiveNow ? 'stats-row--warning' : undefined}>
                  <td>{s.personDisplayName || s.personEmail || '—'}</td>
                  <td>{s.teamName || '—'}</td>
                  <td>{s.startedAt ? new Date(s.startedAt).toLocaleString() : '—'}</td>
                  <td>{s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleTimeString() : '—'}</td>
                  <td>{formatClock(duration)}</td>
                  <td>{viewsSummary}</td>
                  <td>{isActiveNow ? 'Activo ahora' : '—'}</td>
                </tr>
              );
            })}
            {sessions.length === 0 && (
              <tr><td colSpan={7}><p className="modal-hint">Todavía no hay sesiones de Seguidor registradas.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
