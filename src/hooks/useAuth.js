import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Esta cuenta se auto-asigna como Administrador de Sistemas la primera vez que
// inicia sesión, para no depender de que alguien más le dé permisos a mano.
const OWNER_EMAIL = 'aperlesc@gmail.com';

// Cualquier otra cuenta nueva entra como 'family' (solo lectura) hasta que
// un administrador le asigne un rol distinto desde el panel de usuarios.
const DEFAULT_ROLE = 'family';

const googleProvider = new GoogleAuthProvider();

export function useAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setRole(null);
        setLoading(false);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const unsubRole = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setRole(snap.exists() ? snap.data().role : DEFAULT_ROLE);
      setLoading(false);
    });
    return unsubRole;
  }, [user]);

  async function loginWithGoogle() {
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const userDocRef = doc(db, 'users', cred.user.uid);
      const existing = await getDoc(userDocRef);
      if (!existing.exists()) {
        const role = cred.user.email === OWNER_EMAIL ? 'admin' : DEFAULT_ROLE;
        await setDoc(userDocRef, {
          displayName: cred.user.displayName || cred.user.email,
          email: cred.user.email,
          role,
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

  return { user, role, loading, error, loginWithGoogle, logout };
}
