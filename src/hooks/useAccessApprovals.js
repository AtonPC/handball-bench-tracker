import { useCallback, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

const KIND_TO_COLLECTION = { follow: 'follows', guardianship: 'guardianships' };

// Cola de solicitudes de acceso (follows + guardianships) de un equipo, para
// quien puede gestionar el club dueño.
export function useTeamAccessRequests(teamId) {
  const [follows, setFollows] = useState([]);
  const [guardianships, setGuardianships] = useState([]);

  useEffect(() => {
    if (!teamId) {
      setFollows([]);
      setGuardianships([]);
      return undefined;
    }
    const unsubFollows = onSnapshot(
      query(collection(db, 'follows'), where('teamId', '==', teamId)),
      (snap) => setFollows(snap.docs.map((d) => ({ id: d.id, kind: 'follow', ...d.data() })))
    );
    const unsubGuardianships = onSnapshot(
      query(collection(db, 'guardianships'), where('teamId', '==', teamId)),
      (snap) => setGuardianships(snap.docs.map((d) => ({ id: d.id, kind: 'guardianship', ...d.data() })))
    );
    return () => {
      unsubFollows();
      unsubGuardianships();
    };
  }, [teamId]);

  const all = [...follows, ...guardianships];
  return {
    pending: all.filter((r) => r.status === 'pending'),
    approved: all.filter((r) => r.status === 'approved'),
    rejected: all.filter((r) => r.status === 'rejected'),
  };
}

export function useAccessApprovals() {
  const approveRequest = useCallback((kind, id, identity) => {
    return updateDoc(doc(db, KIND_TO_COLLECTION[kind], id), {
      status: 'approved',
      respondedAt: Date.now(),
      respondedByUid: identity.uid,
    });
  }, []);

  const rejectRequest = useCallback((kind, id, identity) => {
    return updateDoc(doc(db, KIND_TO_COLLECTION[kind], id), {
      status: 'rejected',
      respondedAt: Date.now(),
      respondedByUid: identity.uid,
    });
  }, []);

  // Nivel de Seguidor (ver utils/followerTier.js). Lo cambia el gestor del
  // club; las reglas solo dejan actualizar estas solicitudes a un gestor o
  // administrador.
  const setTier = useCallback((kind, id, tier) => {
    return updateDoc(doc(db, KIND_TO_COLLECTION[kind], id), { tier });
  }, []);

  return { approveRequest, rejectRequest, setTier };
}
