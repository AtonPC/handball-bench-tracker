import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

const trainingsCol = collection(db, 'trainings');

// Entrenamientos de un equipo con su lista de asistencia. Un documento por
// sesión, con el mapa de asistencia dentro — así pasar lista es un solo
// documento que se actualiza jugador a jugador (dot-path por playerId), sin
// pisar lo que otra persona haya marcado en otro jugador a la vez. Se
// filtra por club y por equipo a la vez para que las reglas de seguridad
// puedan comprobar el permiso sobre la propia consulta.
export function useTrainings(clubId, teamId) {
  const [trainings, setTrainings] = useState([]);

  useEffect(() => {
    if (!clubId || !teamId) {
      setTrainings([]);
      return undefined;
    }
    const q = query(trainingsCol, where('teamId', '==', teamId), where('clubId', '==', clubId));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0));
      setTrainings(list);
    });
    return unsub;
  }, [clubId, teamId]);

  const createTraining = useCallback(async ({ date, note }) => {
    const ref = await addDoc(trainingsCol, {
      clubId,
      teamId,
      date,
      note: note || '',
      attendance: {},
      createdAt: Date.now(),
    });
    return ref.id;
  }, [clubId, teamId]);

  const updateTraining = useCallback((id, data) => updateDoc(doc(db, 'trainings', id), data), []);

  // marks = { [playerId]: mark | null }. Un mark null borra la marca de ese
  // jugador (vuelve a "sin marcar"). Varios jugadores a la vez en una sola
  // escritura (p. ej. "todos asisten").
  const setMarks = useCallback((trainingId, marks) => {
    const patch = {};
    for (const [playerId, mark] of Object.entries(marks)) {
      patch[`attendance.${playerId}`] = mark ?? deleteField();
    }
    return updateDoc(doc(db, 'trainings', trainingId), patch);
  }, []);

  const setMark = useCallback((trainingId, playerId, mark) => setMarks(trainingId, { [playerId]: mark }), [setMarks]);

  const removeTraining = useCallback((id) => deleteDoc(doc(db, 'trainings', id)), []);

  return { trainings, createTraining, updateTraining, setMark, setMarks, removeTraining };
}
