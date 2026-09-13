import { useEffect, useState } from 'react';
import { useTeams } from '../hooks/useTeams';
import { useStaffMemberships } from '../hooks/useStaffMemberships';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import { CAPABILITIES, CAPABILITY_LABELS, DEFAULT_CAPABILITIES_BY_LABEL, STAFF_LABELS } from '../permissions';

export default function StaffAdmin({ clubId }) {
  const { teams } = useTeams(clubId);
  const users = useUsersDirectory(true);
  const [teamId, setTeamId] = useState('');
  const activeTeamId = teamId || teams[0]?.id || '';
  const { memberships, addMembership, updateMembership, removeMembership } = useStaffMemberships(activeTeamId);
  const [personUid, setPersonUid] = useState('');
  const [label, setLabel] = useState('coach');

  function usersById(uid) {
    return users.find((u) => u.id === uid);
  }

  // Rellena personDisplayName para membresías creadas antes de que este
  // campo existiera — es un espejo público (como rosterDirectory) para que
  // un Seguidor pueda ver quién es el staff sin necesitar leer "users",
  // que sigue bloqueado para cualquiera que no sea admin/gestor.
  useEffect(() => {
    for (const m of memberships) {
      if (!m.personDisplayName) {
        const name = usersById(m.personUid)?.displayName;
        if (name) updateMembership(m.id, { personDisplayName: name });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships, users]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!activeTeamId || !personUid) return;
    await addMembership(clubId, personUid, label, usersById(personUid)?.displayName);
    setPersonUid('');
  }

  function toggleCapability(membership, capability) {
    updateMembership(membership.id, {
      capabilities: { ...membership.capabilities, [capability]: !membership.capabilities[capability] },
    });
  }

  return (
    <div className="admin-panel">
      <p className="modal-hint">Staff y permisos</p>

      <select className="player-form-input" style={{ marginBottom: 10 }} value={activeTeamId} onChange={(e) => setTeamId(e.target.value)}>
        {teams.length === 0 && <option value="">Sin equipos todavía</option>}
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      {activeTeamId && (
        <form className="player-form" onSubmit={handleAdd}>
          <select className="player-form-input" value={personUid} onChange={(e) => setPersonUid(e.target.value)} required>
            <option value="">Elegir persona…</option>
            {users
              .filter((u) => !memberships.some((m) => m.personUid === u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
              ))}
          </select>
          <select className="player-form-input" value={label} onChange={(e) => setLabel(e.target.value)}>
            {Object.entries(STAFF_LABELS).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <p className="modal-hint" style={{ margin: 0 }}>
            Capacidades por defecto para {STAFF_LABELS[label]}:{' '}
            {CAPABILITIES.filter((c) => DEFAULT_CAPABILITIES_BY_LABEL[label][c]).map((c) => CAPABILITY_LABELS[c]).join(', ') || 'ninguna'}
          </p>
          <button className="btn btn-clock btn-start" type="submit">AÑADIR AL STAFF</button>
        </form>
      )}

      <div className="admin-list">
        {memberships.map((m) => (
          <div key={m.id} className="admin-row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div className="admin-user-info">
              <span className="admin-user-name">{usersById(m.personUid)?.displayName || m.personUid}</span>
              <span className="admin-user-email">{STAFF_LABELS[m.label] || m.label}</span>
            </div>
            {CAPABILITIES.map((c) => (
              <label key={c} className="player-form-checkbox">
                <input type="checkbox" checked={!!m.capabilities[c]} onChange={() => toggleCapability(m, c)} />
                {CAPABILITY_LABELS[c]}
              </label>
            ))}
            <button className="btn btn-timeout btn-danger-text" onClick={() => removeMembership(m.id)}>Quitar</button>
          </div>
        ))}
        {activeTeamId && memberships.length === 0 && <p className="modal-hint">Todavía no hay staff en este equipo.</p>}
      </div>
    </div>
  );
}
