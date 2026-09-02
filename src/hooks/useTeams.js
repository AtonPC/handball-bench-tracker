import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const teamsCol = collection(db, 'teams');

// Equipos conocidos (el propio y los rivales), con datos básicos: nombre y lugar.
export function useTeams(enabled) {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setTeams([]);
      return undefined;
    }
    const unsub = onSnapshot(query(teamsCol, orderBy('name', 'asc')), (snap) => {
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [enabled]);

  const addTeam = useCallback((data) => {
    return addDoc(teamsCol, { ...data, isDefault: false, createdAt: Date.now() });
  }, []);

  // Solo puede haber un equipo marcado como "el mío" a la vez.
  const setDefaultTeam = useCallback(async (teamId, currentTeams) => {
    const batch = writeBatch(db);
    for (const t of currentTeams) {
      if (t.isDefault && t.id !== teamId) batch.update(doc(db, 'teams', t.id), { isDefault: false });
    }
    batch.update(doc(db, 'teams', teamId), { isDefault: true });
    await batch.commit();
  }, []);

  const removeTeam = useCallback((id) => deleteDoc(doc(db, 'teams', id)), []);

  return { teams, addTeam, setDefaultTeam, removeTeam };
}
