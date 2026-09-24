import { useCallback, useEffect, useState } from 'react';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const clubsCol = collection(db, 'clubs');

// Clubes: los crea el Administrador de Sistema, sin gestor asignado todavía.
export function useClubs(enabled) {
  const [clubs, setClubs] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setClubs([]);
      return undefined;
    }
    const unsub = onSnapshot(query(clubsCol, orderBy('name', 'asc')), (snap) => {
      setClubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [enabled]);

  const addClub = useCallback((name) => {
    return addDoc(clubsCol, { name, managerUids: [], createdAt: Date.now() });
  }, []);

  // Fichar un club rival nuevo (2026-09-24, MatchesAdmin.jsx): a diferencia de
  // addClub (Administrador de Sistema, sin gestor todavía), aquí quien lo crea
  // queda como su gestor — hace falta para que las reglas de Firestore lo
  // permitan (un gestor de club normal solo puede crear un club si él mismo
  // queda en managerUids, ver firestore.rules) y para poder corregirlo después.
  const addClubAsManager = useCallback((name, uid) => {
    return addDoc(clubsCol, { name, managerUids: [uid], createdAt: Date.now() });
  }, []);

  const renameClub = useCallback((clubId, name) => {
    return updateDoc(doc(db, 'clubs', clubId), { name });
  }, []);

  const addManager = useCallback((clubId, uid) => {
    return updateDoc(doc(db, 'clubs', clubId), { managerUids: arrayUnion(uid) });
  }, []);

  const removeManager = useCallback((clubId, uid) => {
    return updateDoc(doc(db, 'clubs', clubId), { managerUids: arrayRemove(uid) });
  }, []);

  const removeClub = useCallback((id) => deleteDoc(doc(db, 'clubs', id)), []);

  return { clubs, addClub, addClubAsManager, renameClub, addManager, removeManager, removeClub };
}
