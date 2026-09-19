import { useMemo, useState } from 'react';
import { LINEUP_SIZE, lineupAdvice, validateLineup } from '../utils/lineups';
import { periodShortLabel } from '../utils/periods';

// Equipo titular del siguiente tiempo o cuarto, elegido ANTES de darle al ▶
// (2026-09-19). Es OPCIONAL y solo AVISA: nada impide iniciar el periodo, ni
// siquiera repetir a quienes empezaron el anterior — la app se usa también en
// entrenamientos y amistosos. Una columna por periodo con los dorsales de
// quienes lo empezaron; las anteriores solo se consultan, la del periodo que va
// a empezar se rellena aquí, y la primera fila es SIEMPRE el portero (color
// aparte). Con las reglas de Alevín puestas (`alevinRules`), se avisa de quien
// repite: con 14 o más convocados no se debería repetir a nadie; con menos, sí
// se puede y se recuerda cuántos hay que repetir como mínimo.
export default function LineupModal({ period, periodCount, players, lineups, alevinRules, convocados, onConfirm, onCancel }) {
  const prevIds = lineups[period - 1] || [];
  const [ids, setIds] = useState(() => {
    const existing = lineups[period];
    return existing ? [...existing] : Array(LINEUP_SIZE).fill('');
  });
  // Los expulsados (roja) no pueden volver a jugar: no se ofrecen.
  const eligible = useMemo(
    () => Object.values(players).filter((p) => !p.disqualified).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [players]
  );
  const check = validateLineup({ ids, prevIds });
  const advice = alevinRules ? lineupAdvice({ repeated: check.repeated, convocados }) : null;
  const short = (p) => periodShortLabel(p, periodCount);
  const numberOf = (id) => players[id]?.number ?? '?';
  const dorsales = (list) => list.map((id) => `#${numberOf(id)}`).join(', ');
  const chosenElsewhere = (index) => new Set(ids.filter((id, i) => id && i !== index));

  function setSlot(index, id) {
    setIds((prev) => prev.map((x, i) => (i === index ? id : x)));
  }

  const adviceText = !advice ? null
    : advice.level === 'warn'
      ? `${dorsales(advice.repeated)} ya empezó el ${short(period - 1)}. Con ${convocados} convocados no se debería repetir a nadie del periodo anterior (solo se puede con menos de 14).`
      : `Con ${convocados} convocados se puede repetir, pero hay que repetir como mínimo ${advice.needed}.${advice.tooMany ? ` Repites ${advice.repeated.length} (${dorsales(advice.repeated)}): podrías repetir menos.` : ''}`;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--wide lineup-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Equipo titular del {short(period)}</h2>
        <p className="modal-hint" style={{ margin: 0 }}>
          Elige quién empieza. La primera fila es el portero. Es opcional: puedes iniciar sin rellenarlo.
        </p>

        <div className="lineup-grid" style={{ gridTemplateColumns: `22px repeat(${periodCount}, minmax(0, 1fr))` }}>
          <span />
          {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => (
            <span key={p} className={`lineup-head${p === period ? ' lineup-head--now' : ''}`}>{short(p)}</span>
          ))}
          {Array.from({ length: LINEUP_SIZE }, (_, row) => (
            <LineupRow
              key={row}
              row={row}
              period={period}
              periodCount={periodCount}
              lineups={lineups}
              ids={ids}
              eligible={eligible}
              taken={chosenElsewhere(row)}
              repeated={check.repeated}
              repeatLevel={advice?.level}
              numberOf={numberOf}
              onChange={(id) => setSlot(row, id)}
            />
          ))}
        </div>

        {adviceText && (
          <p className={`lineup-advice lineup-advice--${advice.level}`}>
            {advice.level === 'warn' ? '⚠ ' : 'ℹ '}{adviceText} <em>Es solo un aviso: puedes confirmar igualmente.</em>
          </p>
        )}
        {!check.canConfirm && (
          <p className="modal-hint" style={{ margin: 0 }}>Rellena los 7 puestos (el primero es el portero) para poder confirmarlo.</p>
        )}

        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" disabled={!check.canConfirm} onClick={() => onConfirm(ids)}>
            {advice?.level === 'warn' ? 'CONFIRMAR IGUALMENTE' : 'CONFIRMAR EQUIPO TITULAR'}
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function LineupRow({ row, period, periodCount, lineups, ids, eligible, taken, repeated, repeatLevel, numberOf, onChange }) {
  const isGK = row === 0;
  return (
    <>
      <span className={`lineup-row-label${isGK ? ' lineup-row-label--gk' : ''}`}>{isGK ? 'P' : ''}</span>
      {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => {
        if (p < period) {
          const id = lineups[p]?.[row];
          // El del periodo anterior se marca si se repite en el nuevo.
          const repeats = p === period - 1 && id && repeated.includes(id);
          return (
            <span key={p} className="lineup-cell">
              {id
                ? <span className={`lineup-pill${isGK ? ' lineup-pill--gk' : ''}${repeats ? ` lineup-pill--repeat-${repeatLevel || 'info'}` : ''}`}>{numberOf(id)}</span>
                : <span className="lineup-pill lineup-pill--empty">—</span>}
            </span>
          );
        }
        if (p > period) {
          return <span key={p} className="lineup-cell"><span className="lineup-pill lineup-pill--future">·</span></span>;
        }
        const value = ids[row];
        const repeats = value && repeated.includes(value);
        return (
          <span key={p} className="lineup-cell">
            <select
              className={`lineup-select${isGK ? ' lineup-select--gk' : ''}${repeats ? ` lineup-select--repeat-${repeatLevel || 'info'}` : ''}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={isGK ? 'Portero' : `Puesto ${row + 1}`}
            >
              <option value="">—</option>
              {eligible.filter((pl) => !taken.has(pl.id)).map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.number} · {pl.name}</option>
              ))}
            </select>
          </span>
        );
      })}
    </>
  );
}
