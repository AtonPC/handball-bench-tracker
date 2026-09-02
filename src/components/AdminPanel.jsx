import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ROLE_LABELS, ASSIGNABLE_BY_TEAM_ADMIN } from '../roles';

export default function AdminPanel({ myRole, myUid }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  function rolesAssignableTo(targetRole) {
    if (myRole === 'admin') return Object.keys(ROLE_LABELS);
    // team_admin: solo puede operar sobre cuentas que ya están en su ámbito
    if (ASSIGNABLE_BY_TEAM_ADMIN.includes(targetRole)) return ASSIGNABLE_BY_TEAM_ADMIN;
    return null; // fuera de su ámbito (admin / team_admin): no editable
  }

  function handleChange(userId, newRole) {
    updateDoc(doc(db, 'users', userId), { role: newRole });
  }

  return (
    <div className="admin-panel">
      <p className="modal-hint">Gestión de usuarios y roles</p>
      <div className="admin-list">
        {users.map((u) => {
          const options = rolesAssignableTo(u.role);
          const editable = u.id !== myUid && options !== null;
          return (
            <div key={u.id} className="admin-row">
              <div className="admin-user-info">
                <span className="admin-user-name">{u.displayName || u.email || u.id}</span>
                <span className="admin-user-email">{u.email}</span>
              </div>
              {editable ? (
                <select
                  className="admin-role-select"
                  value={u.role}
                  onChange={(e) => handleChange(u.id, e.target.value)}
                >
                  {options.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              ) : (
                <span className="admin-role-locked">{ROLE_LABELS[u.role] || u.role}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
