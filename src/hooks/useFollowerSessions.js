import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Todas las sesiones de Seguidor, para el administrador de sistema — quién
// se ha conectado, cuándo, a qué equipo y qué ha visto.
export function useFollowerSessions(enabled) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setSessions([]);
      return undefined;
    }
    const unsub = onSnapshot(
      query(collection(db, 'followerSessions'), orderBy('startedAt', 'desc')),
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [enabled]);

  return sessions;
}
