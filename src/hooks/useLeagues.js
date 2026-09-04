import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const leaguesCol = collection(db, 'leagues');

// Ligas: nombre, categoría, temporada y sistema de puntos. Las crea el
// Administrador de Sistema; un equipo puede enlazarse a una (opcional).
export function useLeagues(enabled) {
  const [leagues, setLeagues] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setLeagues([]);
      return undefined;
    }
    const unsub = onSnapshot(query(leaguesCol, orderBy('name', 'asc')), (snap) => {
      setLeagues(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [enabled]);

  const addLeague = useCallback((data) => {
    return addDoc(leaguesCol, {
      pointsWin: 2,
      pointsDraw: 1,
      pointsLoss: 0,
      ...data,
      createdAt: Date.now(),
    });
  }, []);

  const updateLeague = useCallback((id, data) => updateDoc(doc(db, 'leagues', id), data), []);

  const removeLeague = useCallback((id) => deleteDoc(doc(db, 'leagues', id)), []);

  return { leagues, addLeague, updateLeague, removeLeague };
}
