import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { followDocId, guardianshipDocId } from '../permissions';

const KIND_TO_COLLECTION = { follow: 'follows', guardianship: 'guardianships' };
const KIND_TO_DOC_ID = { follow: followDocId, guardianship: guardianshipDocId };

// Solicitudes de acceso de la propia persona (Seguidor/tutor), a follows y
// guardianships a la vez — ambas colecciones dan hoy el mismo acceso de
// lectura a todo el equipo, solo cambia el motivo por el que se pidió.
export function useMyAccessGrants(uid) {
  const [follows, setFollows] = useState([]);
  const [guardianships, setGuardianships] = useState([]);

  useEffect(() => {
    if (!uid) {
      setFollows([]);
      setGuardianships([]);
      return undefined;
    }
    const unsubFollows = onSnapshot(
      query(collection(db, 'follows'), where('personUid', '==', uid)),
      (snap) => setFollows(snap.docs.map((d) => ({ id: d.id, kind: 'follow', ...d.data() })))
    );
    const unsubGuardianships = onSnapshot(
      query(collection(db, 'guardianships'), where('personUid', '==', uid)),
      (snap) => setGuardianships(snap.docs.map((d) => ({ id: d.id, kind: 'guardianship', ...d.data() })))
    );
    return () => {
      unsubFollows();
      unsubGuardianships();
    };
  }, [uid]);

  const all = [...follows, ...guardianships];
  const approvedTeamIds = [...new Set(all.filter((r) => r.status === 'approved').map((r) => r.teamId))];
  const pending = all.filter((r) => r.status === 'pending');
  const rejected = all.filter((r) => r.status === 'rejected');

  return { all, approvedTeamIds, pending, rejected };
}

// `user` es el usuario de Firebase Auth (auth.user), no el `identity` del
// modelo multi-club — es de ahí de donde salen displayName/email a guardar
// de forma desnormalizada (un gestor no puede leer el perfil de otro usuario).
export function requestFollow(teamId, user) {
  return setDoc(doc(db, 'follows', followDocId(teamId, user.uid)), {
    personUid: user.uid,
    personDisplayName: user.displayName || user.email || '',
    personEmail: user.email || '',
    teamId,
    status: 'pending',
    createdAt: Date.now(),
    respondedAt: null,
    respondedByUid: null,
  });
}

export function requestGuardianship(teamId, playerId, user) {
  return setDoc(doc(db, 'guardianships', guardianshipDocId(teamId, user.uid)), {
    personUid: user.uid,
    personDisplayName: user.displayName || user.email || '',
    personEmail: user.email || '',
    teamId,
    playerId,
    status: 'pending',
    createdAt: Date.now(),
    respondedAt: null,
    respondedByUid: null,
  });
}

// Reintentar tras un rechazo borra la solicitud anterior y crea una nueva —
// las reglas solo dejan actualizar el estado a un admin/gestor, así que un
// "setDoc" directo sobre un doc rechazado se trataría como update y fallaría.
export function useAccessRequestActions() {
  const cancelRequest = useCallback((kind, teamId, uid) => {
    return deleteDoc(doc(db, KIND_TO_COLLECTION[kind], KIND_TO_DOC_ID[kind](teamId, uid)));
  }, []);

  const retryRequest = useCallback(async (kind, teamId, user, playerId) => {
    await deleteDoc(doc(db, KIND_TO_COLLECTION[kind], KIND_TO_DOC_ID[kind](teamId, user.uid)));
    if (kind === 'guardianship') return requestGuardianship(teamId, playerId, user);
    return requestFollow(teamId, user);
  }, []);

  return { cancelRequest, retryRequest };
}
