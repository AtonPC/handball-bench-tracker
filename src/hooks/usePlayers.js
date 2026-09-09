import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

const playersCol = collection(db, 'players');

function rosterDirRef(teamId, playerId) {
  return doc(db, 'teams', teamId, 'rosterDirectory', playerId);
}

// Plantilla de un equipo concreto. Cada escritura aquí también mantiene al
// día "rosterDirectory" (solo nombre+dorsal, sin foto ni otros datos): es
// la versión mínima y pública de la plantilla que necesita, por ejemplo,
// quien pide tutela de un jugador/a sin tener todavía acceso aprobado.
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

  const addPlayer = useCallback(async (data) => {
    const ref = await addDoc(playersCol, {
      clubId,
      teamId,
      imageAuthorized: true,
      active: true,
      ...data,
      createdAt: Date.now(),
    });
    await setDoc(rosterDirRef(teamId, ref.id), {
      clubId,
      teamId,
      displayName: data.displayName || '',
      number: data.number ?? null,
    });
    return ref;
  }, [clubId, teamId]);

  const updatePlayer = useCallback(async (id, data) => {
    await updateDoc(doc(db, 'players', id), data);
    // Si el jugador se mueve a otro equipo, el espejo se mueve con él —
    // vive en teams/{teamId}/rosterDirectory, no es un documento aparte.
    if (data.teamId && data.teamId !== teamId) {
      await deleteDoc(rosterDirRef(teamId, id)).catch(() => {});
      await setDoc(rosterDirRef(data.teamId, id), {
        clubId: data.clubId || clubId,
        teamId: data.teamId,
        displayName: data.displayName,
        number: data.number,
      });
      return;
    }
    if (data.displayName !== undefined || data.number !== undefined) {
      const patch = {};
      if (data.displayName !== undefined) patch.displayName = data.displayName;
      if (data.number !== undefined) patch.number = data.number;
      await setDoc(rosterDirRef(teamId, id), patch, { merge: true });
    }
  }, [clubId, teamId]);

  const removePlayer = useCallback(async (id) => {
    await deleteDoc(doc(db, 'players', id));
    await deleteDoc(rosterDirRef(teamId, id)).catch(() => {});
  }, [teamId]);

  // Rellena rosterDirectory para jugadores que ya existían antes de que este
  // espejo se introdujera. No se llama automáticamente desde aquí (este
  // hook también lo usan pantallas de solo lectura sin capacidad de
  // gestionar plantilla) — la llama explícitamente PlayersAdmin una vez.
  const backfillRosterDirectory = useCallback(async () => {
    await Promise.all(players.map((p) => setDoc(rosterDirRef(teamId, p.id), {
      clubId: p.clubId || clubId,
      teamId,
      displayName: p.displayName || '',
      number: p.number ?? null,
    }, { merge: true }).catch(() => {})));
  }, [players, clubId, teamId]);

  return { players, addPlayer, updatePlayer, removePlayer, backfillRosterDirectory };
}
