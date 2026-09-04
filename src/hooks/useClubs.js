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

  return { clubs, addClub, renameClub, addManager, removeManager, removeClub };
}
