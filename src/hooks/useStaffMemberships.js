import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_CAPABILITIES_BY_LABEL, membershipDocId } from '../permissions';

// Membresías de staff de un equipo concreto: persona + etiqueta + capacidades.
export function useStaffMemberships(teamId) {
  const [memberships, setMemberships] = useState([]);

  useEffect(() => {
    if (!teamId) {
      setMemberships([]);
      return undefined;
    }
    const unsub = onSnapshot(query(collection(db, 'staffMemberships'), where('teamId', '==', teamId)), (snap) => {
      setMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [teamId]);

  const addMembership = useCallback((clubId, personUid, label) => {
    const id = membershipDocId(teamId, personUid);
    return setDoc(doc(db, 'staffMemberships', id), {
      personUid,
      teamId,
      clubId,
      label,
      capabilities: DEFAULT_CAPABILITIES_BY_LABEL[label],
      active: true,
      createdAt: Date.now(),
    });
  }, [teamId]);

  const updateMembership = useCallback((id, data) => updateDoc(doc(db, 'staffMemberships', id), data), []);

  const removeMembership = useCallback((id) => deleteDoc(doc(db, 'staffMemberships', id)), []);

  return { memberships, addMembership, updateMembership, removeMembership };
}
