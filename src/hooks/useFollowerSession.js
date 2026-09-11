import { useEffect, useRef } from 'react';
import { addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const HEARTBEAT_MS = 30000;

// Registra una sesión de Seguidor: cuándo se conecta, qué pantallas ve
// (contador por vista, no un registro con marca de tiempo de cada toque,
// para no hacer crecer el documento sin límite) y hasta cuándo ha estado
// activa (lastActiveAt, actualizado con un "latido" periódico + en cada
// cambio de vista — la única forma fiable de estimar cuánto dura una
// sesión sin un evento de "cierre" garantizado en el navegador).
// No se usa en previewMode (cuando el staff mira "Vista de Seguidor" para
// comprobar qué ven las familias, eso no es una sesión real de Seguidor).
export function useFollowerSession({ enabled, personUid, personDisplayName, personEmail, teamId, teamName, clubId }) {
  const sessionRef = useRef(null);
  const viewCountsRef = useRef({});

  useEffect(() => {
    if (!enabled || !personUid || !teamId) return undefined;
    let cancelled = false;
    const now = Date.now();
    viewCountsRef.current = {};

    addDoc(collection(db, 'followerSessions'), {
      personUid,
      personDisplayName: personDisplayName || '',
      personEmail: personEmail || '',
      teamId,
      teamName: teamName || '',
      clubId: clubId || '',
      startedAt: now,
      lastActiveAt: now,
      viewCounts: {},
    }).then((ref) => {
      if (!cancelled) sessionRef.current = ref;
      else updateDoc(ref, { lastActiveAt: Date.now() }).catch(() => {});
    }).catch(() => {});

    const heartbeat = setInterval(() => {
      if (sessionRef.current) updateDoc(sessionRef.current, { lastActiveAt: Date.now() }).catch(() => {});
    }, HEARTBEAT_MS);

    function handleUnload() {
      if (sessionRef.current) updateDoc(sessionRef.current, { lastActiveAt: Date.now() }).catch(() => {});
    }
    document.addEventListener('visibilitychange', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      handleUnload();
      sessionRef.current = null;
    };
    // Una sesión nueva por cada combinación de persona+equipo que se abre
    // (p. ej. si cambia de equipo seguido, cuenta como otra sesión).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, personUid, teamId]);

  function logView(viewName) {
    if (!sessionRef.current || !viewName) return;
    viewCountsRef.current[viewName] = (viewCountsRef.current[viewName] || 0) + 1;
    updateDoc(sessionRef.current, {
      lastActiveAt: Date.now(),
      [`viewCounts.${viewName}`]: viewCountsRef.current[viewName],
    }).catch(() => {});
  }

  return { logView };
}
