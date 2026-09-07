import { useCallback } from 'react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Escritura directa (sin log de deshacer) para corregir un partido ya
// finalizado: errores de anotación, o adaptar el resultado a lo que registró
// la federación. Distinto de useMatchStore, pensado para el directo.
export function useMatchEditor(matchId) {
  const updateMatchInfo = useCallback((data) => updateDoc(doc(db, 'matches', matchId), data), [matchId]);

  const updatePlayerStats = useCallback(
    (playerId, data) => updateDoc(doc(db, 'matches', matchId, 'players', playerId), data),
    [matchId]
  );

  const addRivalGoalRecord = useCallback(
    (data) => addDoc(collection(db, 'matches', matchId, 'rivalGoals'), { ...data, createdAt: Date.now() }),
    [matchId]
  );

  const removeRivalGoalRecord = useCallback(
    (rivalGoalId) => deleteDoc(doc(db, 'matches', matchId, 'rivalGoals', rivalGoalId)),
    [matchId]
  );

  return { updateMatchInfo, updatePlayerStats, addRivalGoalRecord, removeRivalGoalRecord };
}
