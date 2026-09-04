import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Directorio de personas que ya han iniciado sesión alguna vez — se usa para
// elegir a quién asignar como gestor de club o miembro de staff, igual que
// hacía el panel de administración original.
export function useUsersDirectory(enabled) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setUsers([]);
      return undefined;
    }
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [enabled]);

  return users;
}
