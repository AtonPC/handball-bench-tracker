import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useMatches } from '../hooks/useMatches';

// TEMPORAL — diagnosticar el reporte del usuario (2026-09-16): "las
// estadísticas de Goles/Paradas solo marcan la portería, no el campo".
// Lee de verdad shotEvents/saveEvents de cada partido y cuenta cuántos
// tienen shotZone (origen/campo) guardado frente a goalZone (entrada/
// portería) — así se distingue si es un problema de DATOS (nunca se tocó
// la zona de origen al registrar) de uno de CÓDIGO (se guardó pero no se
// pinta). Borrar este archivo y su entrada en App.jsx en cuanto se
// confirme la causa — no es una pantalla pensada para quedarse.
function summarize(list) {
  return {
    total: list.length,
    conOrigen: list.filter((e) => e.shotZone).length,
    conEntrada: list.filter((e) => e.goalZone).length,
  };
}

export default function ZoneDataDiagnostic({ clubId, teamId }) {
  const { matches } = useMatches(clubId, teamId);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const out = [];
    for (const m of matches) {
      const shotSnap = await getDocs(collection(db, 'matches', m.id, 'shotEvents'));
      const saveSnap = await getDocs(collection(db, 'matches', m.id, 'saveEvents'));
      const shots = shotSnap.docs.map((d) => d.data());
      const saves = saveSnap.docs.map((d) => d.data());
      const goals = shots.filter((e) => e.type === 'goal');
      const misses = shots.filter((e) => e.type === 'miss');
      out.push({
        id: m.id,
        label: `${m.rivalName || '?'} — ${m.lifecycle}`,
        goals: summarize(goals),
        misses: summarize(misses),
        saves: summarize(saves),
      });
    }
    setRows(out);
    setLoading(false);
  }

  const totals = rows
    ? rows.reduce(
        (acc, r) => {
          for (const key of ['goals', 'misses', 'saves']) {
            acc[key].total += r[key].total;
            acc[key].conOrigen += r[key].conOrigen;
            acc[key].conEntrada += r[key].conEntrada;
          }
          return acc;
        },
        { goals: { total: 0, conOrigen: 0, conEntrada: 0 }, misses: { total: 0, conOrigen: 0, conEntrada: 0 }, saves: { total: 0, conOrigen: 0, conEntrada: 0 } }
      )
    : null;

  return (
    <div className="admin-panel">
      <p className="modal-hint">
        Diagnóstico temporal — cuenta cuántos goles/fallos/paradas tienen zona de origen (campo) guardada frente a
        zona de entrada (portería), leyendo los datos reales.
      </p>
      <button className="btn btn-clock btn-start" onClick={run} disabled={loading}>
        {loading ? 'Leyendo…' : 'Leer datos de todos los partidos'}
      </button>

      {totals && (
        <div className="card" style={{ marginTop: 'var(--space-3)' }}>
          <h4>Total ({rows.length} partidos)</h4>
          <p>Goles: {totals.goals.total} total · {totals.goals.conOrigen} con origen · {totals.goals.conEntrada} con entrada</p>
          <p>Fallos: {totals.misses.total} total · {totals.misses.conOrigen} con origen · {totals.misses.conEntrada} con entrada</p>
          <p>Paradas: {totals.saves.total} total · {totals.saves.conOrigen} con origen · {totals.saves.conEntrada} con entrada</p>
        </div>
      )}

      {rows && (
        <div className="admin-list" style={{ marginTop: 'var(--space-3)' }}>
          {rows.map((r) => (
            <div key={r.id} className="admin-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <strong>{r.label}</strong>
              <span>Goles: {r.goals.total} total, {r.goals.conOrigen} con origen, {r.goals.conEntrada} con entrada</span>
              <span>Fallos: {r.misses.total} total, {r.misses.conOrigen} con origen, {r.misses.conEntrada} con entrada</span>
              <span>Paradas: {r.saves.total} total, {r.saves.conOrigen} con origen, {r.saves.conEntrada} con entrada</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
