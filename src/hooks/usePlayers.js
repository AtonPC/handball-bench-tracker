import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const playersCol = collection(db, 'players');

// Plantilla del club (todos los jugadores, con o sin convocatoria activa).
export function usePlayers(enabled) {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setPlayers([]);
      return undefined;
    }
    const unsub = onSnapshot(query(playersCol, orderBy('number', 'asc')), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [enabled]);

  const addPlayer = useCallback((data) => {
    return addDoc(playersCol, { ...data, active: true, createdAt: Date.now() });
  }, []);

  const updatePlayer = useCallback((id, data) => updateDoc(doc(db, 'players', id), data), []);

  const removePlayer = useCallback((id) => deleteDoc(doc(db, 'players', id)), []);

  return { players, addPlayer, updatePlayer, removePlayer };
}
