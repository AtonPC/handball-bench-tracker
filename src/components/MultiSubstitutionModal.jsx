import { useState } from 'react';
import { formatClock } from '../utils/time';

// Cambios múltiples de una vez: una fila por cada jugador en pista (el
// portero primero) con un desplegable de suplentes. Solo hace falta tocar las
// filas que cambian. Un suplente no puede elegirse en dos filas a la vez.
// Un excluido (cumpliendo sus 2 minutos) no se puede cambiar; un expulsado
// (roja) sí — y no vuelve al banquillo, lo gestiona substituteMany.
export default function MultiSubstitutionModal({ courtPlayers, benchPlayers, onConfirm, onCancel }) {
  const [choice, setChoice] = useState({}); // { [outId]: inId }
  const rows = [...courtPlayers].sort((a, b) => Number(!!b.isGK) - Number(!!a.isGK) || (a.number ?? 0) - (b.number ?? 0));
  const available = benchPlayers.filter((p) => !p.disqualified);
  const chosenIds = new Set(Object.values(choice).filter(Boolean));
  const pairs = Object.entries(choice).filter(([, inId]) => inId).map(([outId, inId]) => ({ outId, inId }));

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2>Cambio</h2>
        <p className="modal-hint">Elige quién entra por cada jugador que sale. Deja "sin cambio" a quien se queda.</p>

        {available.length === 0 && <p className="modal-hint">No hay suplentes disponibles en el banquillo.</p>}

        <div className="multisub-rows">
          {rows.map((p) => {
            const serving = p.excluded && !p.disqualified;
            return (
              <div key={p.id} className={`multisub-row${p.isGK ? ' multisub-row--gk' : ''}`}>
                <span className="multisub-out">
                  <span className="picker-number">{p.number}</span>
                  <span className="multisub-name">{p.name}{p.isGK ? ' (P)' : ''}</span>
                </span>
                {serving ? (
                  <span className="multisub-note">Excluido — no se puede cambiar</span>
                ) : (
                  <select
                    className="player-form-input multisub-select"
                    value={choice[p.id] || ''}
                    onChange={(e) => setChoice((c) => ({ ...c, [p.id]: e.target.value }))}
                    aria-label={`Quién entra por ${p.name}`}
                  >
                    <option value="">{p.disqualified ? 'Roja — elige quién entra' : '— sin cambio —'}</option>
                    {available
                      .filter((b) => !chosenIds.has(b.id) || choice[p.id] === b.id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>#{b.number} {b.name} · {formatClock(b.accumulatedMs)}</option>
                      ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" disabled={pairs.length === 0} onClick={() => onConfirm(pairs)}>
            {pairs.length === 0 ? 'HACER CAMBIO' : `HACER ${pairs.length} CAMBIO${pairs.length === 1 ? '' : 'S'}`}
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
