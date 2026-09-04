import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

const playersCol = collection(db, 'players');

// Plantilla de un equipo concreto.
export function usePlayers(clubId, teamId) {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (!teamId) {
      setPlayers([]);
      return undefined;
    }
    const unsub = onSnapshot(query(playersCol, where('teamId', '==', teamId)), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
      setPlayers(list);
    });
    return unsub;
  }, [teamId]);

  const addPlayer = useCallback((data) => {
    return addDoc(playersCol, {
      clubId,
      teamId,
      imageAuthorized: true,
      active: true,
      ...data,
      createdAt: Date.now(),
    });
  }, [clubId, teamId]);

  const updatePlayer = useCallback((id, data) => updateDoc(doc(db, 'players', id), data), []);

  const removePlayer = useCallback((id) => deleteDoc(doc(db, 'players', id)), []);

  return { players, addPlayer, updatePlayer, removePlayer };
}
