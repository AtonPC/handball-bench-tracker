import { useMemo, useState } from 'react';
import { LINEUP_SIZE, lineupAdvice, validateLineup } from '../utils/lineups';
import { periodLongLabel, periodShortLabel } from '../utils/periods';
import LineupBoard from './LineupBoard';

// Equipo titular del siguiente tiempo o cuarto, elegido ANTES de darle al ▶ (mockup
// aprobado, 2026-09-21; tablero arrastrable desde 2026-09-26). Con las reglas de
// Alevín puestas es un PASO OBLIGATORIO: sin confirmarlo no se puede iniciar el
// periodo. Lo que se elija aquí NUNCA se bloquea: repetir a quienes empezaron el
// anterior solo avisa (la app se usa también en entrenamientos y amistosos; el
// interruptor del partido lo desactiva entero).
//  - Izquierda: los equipos titulares de los periodos ya jugados (solo dorsales; la
//    primera fila es el portero) para no repetir de un periodo a otro.
//  - Derecha: LineupBoard.jsx — una cancha con los 6 puestos (EI/LI/C/LD/ED/Pivote)
//    más el portero aparte, precargada con quién empezó el periodo anterior; se
//    arrastra a cada convocado a su puesto (o se toca el puesto y luego a quien lo
//    ocupa) para sustituirlo en el sitio.
//  - Con menos de 7 jugadores se pide una segunda confirmación.
// Con las reglas de Alevín, se avisa de quien repite: con 14 o más convocados no se
// debería repetir a nadie; con menos, sí se puede y se recuerda cuántos hay que
// repetir como mínimo.
export default function LineupModal({ period, periodCount, players, lineups, alevinRules, convocados, onConfirm, onCancel }) {
  const prevIds = lineups[period - 1] || [];
  // Se precarga con el equipo del periodo anterior si este todavía no se ha
  // tocado (2026-09-26, a petición del usuario) — así solo hace falta
  // arrastrar a quien sustituye, no rehacer el equipo entero cada vez.
  const [ids, setIds] = useState(() => {
    const existing = lineups[period] || prevIds;
    return existing && existing.length ? [...existing, ...Array(LINEUP_SIZE).fill('')].slice(0, LINEUP_SIZE) : Array(LINEUP_SIZE).fill('');
  });
  const [checking, setChecking] = useState(false); // segunda confirmación (menos de 7)

  function handleIdsChange(next) {
    setIds(next);
    setChecking(false);
  }
  // Los expulsados (roja) no pueden volver a jugar: no se ofrecen.
  const roster = useMemo(
    () => Object.values(players).filter((p) => !p.disqualified).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [players]
  );
  const check = validateLineup({ ids, prevIds });
  const advice = alevinRules ? lineupAdvice({ repeated: check.repeated, convocados }) : null;
  const short = (p) => periodShortLabel(p, periodCount);
  const numberOf = (id) => players[id]?.number ?? '?';
  const dorsales = (list) => list.map((id) => `#${numberOf(id)}`).join(', ');
  const filled = ids.filter(Boolean);
  const past = Array.from({ length: period - 1 }, (_, i) => i + 1);

  function handleConfirm() {
    if (check.complete) onConfirm(ids);
    else setChecking(true);
  }

  const adviceText = !advice ? null
    : advice.level === 'warn'
      ? `${dorsales(advice.repeated)} ya empezó el ${short(period - 1)}. Con ${convocados} convocados no se debería repetir a nadie del periodo anterior (solo se puede con menos de 14).`
      : `Con ${convocados} convocados se puede repetir, pero hay que repetir como mínimo ${advice.needed}.${advice.tooMany ? ` Repites ${advice.repeated.length} (${dorsales(advice.repeated)}): podrías repetir menos.` : ''}`;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--wide lu-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Equipo titular del ${periodLongLabel(period, periodCount)}`}>
        <h2>Equipo titular del {periodLongLabel(period, periodCount)}</h2>
        <p className="lu-hint">
          Elige quién empieza. El primer puesto es el portero. Hay que confirmarlo para poder iniciar el periodo; los avisos de repetidos no impiden confirmarlo, y con menos de 7 jugadores se pide una segunda confirmación.
        </p>

        <div className={`lu-grid${past.length === 0 ? ' lu-grid--nopast' : ''}`}>
          {past.length > 0 && (
            <div className="lu-past" style={{ gridTemplateColumns: `22px repeat(${past.length}, minmax(0, 1fr))` }} aria-label="Equipos titulares de los periodos anteriores">
              <span />
              {past.map((p) => <span key={p} className="lu-past-h">{short(p)}</span>)}
              {Array.from({ length: LINEUP_SIZE }, (_, row) => (
                <PastRow key={row} row={row} past={past} lineups={lineups} ids={ids} numberOf={numberOf} isLast={(p) => p === period - 1} />
              ))}
            </div>
          )}
          <LineupBoard ids={ids} onChange={handleIdsChange} roster={roster} prevIds={prevIds.length ? prevIds : undefined} />
        </div>

        {adviceText && (
          <div className={`lu-adv lu-adv--${advice.level}`}>{advice.level === 'warn' ? '⚠ ' : 'ℹ '}{adviceText} <em>Es solo un aviso: puedes confirmar igualmente.</em></div>
        )}
        {!check.canConfirm && <p className="lu-hint">Elige al menos un jugador (el primero es el portero) para poder confirmarlo.</p>}

        {checking ? (
          <div className="lu-chk" role="alertdialog" aria-label="Confirmar equipo incompleto">
            <span>
              <strong>Solo has elegido {filled.length} de {LINEUP_SIZE} jugadores</strong>
              {!check.hasGoalkeeper ? ' y no has puesto portero' : ''}. ¿Es correcto?
            </span>
            <button type="button" className="lu-btn" onClick={() => onConfirm(ids)}>SÍ, ES CORRECTO</button>
            <button type="button" className="lu-btn lu-btn--g" onClick={() => setChecking(false)}>VOLVER A REVISAR</button>
          </div>
        ) : (
          <div className="lu-btns">
            <button type="button" className="lu-btn" disabled={!check.canConfirm} onClick={handleConfirm}>
              {advice?.level === 'warn' ? 'CONFIRMAR IGUALMENTE' : 'CONFIRMAR EQUIPO TITULAR'}
            </button>
            <button type="button" className="lu-btn lu-btn--g" onClick={onCancel}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PastRow({ row, past, lineups, ids, numberOf, isLast }) {
  const isGK = row === 0;
  return (
    <>
      <span className="lu-past-r">{isGK ? 'P' : ''}</span>
      {past.map((p) => {
        const id = lineups[p]?.[row];
        // Los del periodo anterior se marcan si se repiten en el nuevo.
        const rep = isLast(p) && id && ids.includes(id);
        return <span key={p} className={`lu-pc${isGK ? ' lu-pc--gk' : ''}${rep ? ' lu-pc--rep' : ''}`}>{id ? numberOf(id) : '—'}</span>;
      })}
    </>
  );
}
