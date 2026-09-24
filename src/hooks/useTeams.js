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
      // Por defecto, un equipo dado de alta aquí (Equipos del club) es un equipo
      // propio, no un rival — 2026-09-24, ver más abajo isClub/isRival.
      isClub: true,
      isRival: false,
      ...data,
      createdAt: Date.now(),
    });
  }, [clubId]);

  const updateTeam = useCallback((id, data) => updateDoc(doc(db, 'teams', id), data), []);

  const removeTeam = useCallback((id) => deleteDoc(doc(db, 'teams', id)), []);

  return { teams, addTeam, updateTeam, removeTeam };
}

// Equipos rivales — GLOBAL, no acotado a un club (2026-09-24): un equipo marcado
// como rival (isRival:true) lo puede ver y elegir cualquier club a la hora de crear
// un partido, para no duplicar el mismo rival real una vez por cada club que juega
// contra él. `teams` ya era de lectura abierta a cualquier usuario con sesión
// (firestore.rules), así que no hace falta ningún permiso nuevo para leer esto.
// Un equipo puede ser rival Y propio a la vez (dos equipos del mismo club en la
// misma liga son rivales entre sí) — isClub/isRival son independientes.
export function useRivalTeams() {
  const [rivalTeams, setRivalTeams] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(query(teamsCol, where('isRival', '==', true)), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setRivalTeams(list);
    });
    return unsub;
  }, []);

  return rivalTeams;
}

// Crear el equipo de un club rival recién fichado (2026-09-24, MatchesAdmin.jsx: "crear
// nuevo club" al elegir el rival de un partido) — función suelta, sin suscripción,
// para no tener que montar useTeams(clubId) solo para esta escritura puntual.
export function addRivalTeam(clubId, data) {
  return addDoc(teamsCol, {
    leagueId: null,
    crestUrl: '',
    primaryColor: '',
    secondaryColor: '',
    goalPhrase: '',
    isClub: false,
    isRival: true,
    ...data,
    clubId,
    createdAt: Date.now(),
  });
}
