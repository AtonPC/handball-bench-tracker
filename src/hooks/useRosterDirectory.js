import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Versión mínima y pública de la plantilla de un equipo (solo nombre y
// dorsal): a diferencia de "players", cualquier persona registrada puede
// leerla, para poder elegir "de qué jugador/a soy familiar" al pedir
// tutela sin tener todavía acceso aprobado a ese equipo.
export function useRosterDirectory(teamId) {
  const [roster, setRoster] = useState([]);

  useEffect(() => {
    if (!teamId) {
      setRoster([]);
      return undefined;
    }
    const unsub = onSnapshot(collection(db, 'teams', teamId, 'rosterDirectory'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
      setRoster(list);
    });
    return unsub;
  }, [teamId]);

  return roster;
}
