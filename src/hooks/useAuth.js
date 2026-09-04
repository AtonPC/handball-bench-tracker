import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Esta cuenta se auto-asigna como Administrador de Sistema la primera vez que
// inicia sesión, para no depender de que alguien más le dé permisos a mano.
const OWNER_EMAIL = 'aperlesc@gmail.com';

const googleProvider = new GoogleAuthProvider();

// Resuelve, además de la sesión de Firebase Auth, la "identidad" de la
// persona en el modelo multi-club: si es administrador de sistema, qué
// clubes gestiona y en qué equipos tiene una membresía de staff activa.
export function useAuth() {
  const [user, setUser] = useState(null);
  const [systemRole, setSystemRole] = useState(null);
  const [managedClubs, setManagedClubs] = useState([]);
  const [staffMemberships, setStaffMemberships] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [allClubs, setAllClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const selfHealAttempted = useRef(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      selfHealAttempted.current = false;
      if (!firebaseUser) {
        setSystemRole(null);
        setManagedClubs([]);
        setStaffMemberships([]);
        setLoading(false);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setSystemRole(data?.systemRole || null);
      setLoading(false);
      // Autocorrige, una sola vez por sesión, cuentas propietarias que ya
      // existían antes de este modelo (se habían quedado con el viejo
      // campo `role`, sin `systemRole`). Un solo intento evita machacar
      // Firestore en bucle si el despliegue de reglas todavía no incluye
      // el permiso de autopromoción.
      if (data && user.email === OWNER_EMAIL && data.systemRole !== 'admin' && !selfHealAttempted.current) {
        selfHealAttempted.current = true;
        setDoc(userDocRef, { systemRole: 'admin' }, { merge: true }).catch(() => {});
      }
    });
    const unsubClubs = onSnapshot(
      query(collection(db, 'clubs'), where('managerUids', 'array-contains', user.uid)),
      (snap) => setManagedClubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubMemberships = onSnapshot(
      query(collection(db, 'staffMemberships'), where('personUid', '==', user.uid)),
      (snap) => setStaffMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snap) => {
      setAllTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubAllClubs = onSnapshot(collection(db, 'clubs'), (snap) => {
      setAllClubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubUser();
      unsubClubs();
      unsubMemberships();
      unsubTeams();
      unsubAllClubs();
    };
  }, [user]);

  const identity = useMemo(() => {
    if (!user) return null;
    const teamsById = {};
    for (const t of allTeams) teamsById[t.id] = t;
    return {
      uid: user.uid,
      systemRole,
      managedClubs,
      managedClubIds: managedClubs.map((c) => c.id),
      staffMemberships,
      allTeams,
      teamsById,
      allClubs,
    };
  }, [user, systemRole, managedClubs, staffMemberships, allTeams, allClubs]);

  async function loginWithGoogle() {
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const userDocRef = doc(db, 'users', cred.user.uid);
      const existing = await getDoc(userDocRef);
      if (!existing.exists()) {
        await setDoc(userDocRef, {
          displayName: cred.user.displayName || cred.user.email,
          email: cred.user.email,
          systemRole: cred.user.email === OWNER_EMAIL ? 'admin' : null,
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  return { user, identity, loading, error, loginWithGoogle, logout };
}
