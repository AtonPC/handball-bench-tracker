import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

const teamsCol = collection(db, 'teams');

// Equipos de un club concreto (los crea/gestiona el Gestor de Club).
export function useTeams(clubId) {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    if (!clubId) {
      setTeams([]);
      return undefined;
    }
    const unsub = onSnapshot(query(teamsCol, where('clubId', '==', clubId)), (snap) => {
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [clubId]);

  const addTeam = useCallback((data) => {
    return addDoc(teamsCol, {
      clubId,
      leagueId: null,
      crestUrl: '',
      primaryColor: '',
      secondaryColor: '',
      goalPhrase: '',
      ...data,
      createdAt: Date.now(),
    });
  }, [clubId]);

  const updateTeam = useCallback((id, data) => updateDoc(doc(db, 'teams', id), data), []);

  const removeTeam = useCallback((id) => deleteDoc(doc(db, 'teams', id)), []);

  return { teams, addTeam, updateTeam, removeTeam };
}
