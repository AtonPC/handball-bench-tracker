import { useCallback } from 'react';
import { collection, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { resolveCounters } from '../utils/actionEditing';

// Escritura directa (sin log de deshacer) para corregir un partido ya
// finalizado: errores de anotación, o adaptar el resultado a lo que registró
// la federación. Distinto de useMatchStore, pensado para el directo.
export function useMatchEditor(matchId) {
  const updateMatchInfo = useCallback((data) => updateDoc(doc(db, 'matches', matchId), data), [matchId]);

  const updatePlayerStats = useCallback(
    (playerId, data) => updateDoc(doc(db, 'matches', matchId, 'players', playerId), data),
    [matchId]
  );

  // Aplica un plan de actions (ver utils/actionEditing.js: borrar, corregir
  // o añadir UNA acción) de una sola vez: documentos de detalle + contadores
  // de jugadores + marcador, o todo o nada — así el detalle y los contadores
  // no se quedan descuadrados a medias. `players` y `score` son los valores
  // actuales, de donde salen los nuevos contadores absolutos.
  const applyPlan = useCallback(async (plan, { players, score }) => {
    const batch = writeBatch(db);
    const sub = (name) => collection(db, 'matches', matchId, name);

    // Una Parada y su Fallo rival comparten pairId (= id de la parada).
    const pairId = plan.creates.some((c) => c.idFromPair) ? doc(sub('saveEvents')).id : null;
    for (const c of plan.creates) {
      const ref = c.idFromPair ? doc(db, 'matches', matchId, c.sub, pairId) : doc(sub(c.sub));
      batch.set(ref, { ...c.data, ...(c.data.pairId === '$pair' ? { pairId } : {}) });
    }
    for (const p of plan.patches) batch.update(doc(db, 'matches', matchId, p.sub, p.id), p.data);
    for (const d of plan.deletes) batch.delete(doc(db, 'matches', matchId, d.sub, d.id));

    const { playerUpdates, scoreUpdate } = resolveCounters(plan.effects, players, score);
    for (const [pid, data] of Object.entries(playerUpdates)) batch.update(doc(db, 'matches', matchId, 'players', pid), data);
    if (Object.keys(scoreUpdate).length > 0) batch.update(doc(db, 'matches', matchId), scoreUpdate);

    await batch.commit();
  }, [matchId]);

  return { updateMatchInfo, updatePlayerStats, applyPlan };
}
