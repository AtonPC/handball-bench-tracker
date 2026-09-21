import { useMemo, useState } from 'react';
import { LINEUP_SIZE, lineupAdvice, validateLineup } from '../utils/lineups';
import { periodLongLabel, periodShortLabel } from '../utils/periods';

// Equipo titular del siguiente tiempo o cuarto, elegido ANTES de darle al ▶ (mockup
// aprobado, 2026-09-21). Con las reglas de Alevín puestas es un PASO OBLIGATORIO: sin
// confirmarlo no se puede iniciar el periodo. Lo que se elija aquí NUNCA se bloquea:
// repetir a quienes empezaron el anterior solo avisa (la app se usa también en
// entrenamientos y amistosos; el interruptor del partido lo desactiva entero).
//  - Izquierda: los equipos titulares de los periodos ya jugados (solo dorsales; la
//    primera fila es el portero) para no repetir de un periodo a otro.
//  - Derecha: los 7 puestos (el primero, el portero) y la plantilla debajo. Se toca un
//    puesto y luego a quien lo ocupa; el siguiente puesto libre se marca solo. Quien
//    empezó el periodo anterior sale marcado («empezó 1C»).
//  - Con menos de 7 jugadores se pide una segunda confirmación.
// Con las reglas de Alevín, se avisa de quien repite: con 14 o más convocados no se
// debería repetir a nadie; con menos, sí se puede y se recuerda cuántos hay que
// repetir como mínimo.
export default function LineupModal({ period, periodCount, players, lineups, alevinRules, convocados, onConfirm, onCancel }) {
  const prevIds = lineups[period - 1] || [];
  const [ids, setIds] = useState(() => {
    const existing = lineups[period];
    return existing ? [...existing, ...Array(LINEUP_SIZE).fill('')].slice(0, LINEUP_SIZE) : Array(LINEUP_SIZE).fill('');
  });
  const [active, setActive] = useState(0); // puesto que se está rellenando
  const [checking, setChecking] = useState(false); // segunda confirmación (menos de 7)
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

  // Toca a un jugador: ocupa el puesto activo (si ya estaba en otro, lo deja libre; si
  // ya ocupaba el activo, lo quita) y el siguiente puesto libre pasa a ser el activo.
  function pick(id) {
    setChecking(false);
    if (ids[active] === id) {
      setIds((prev) => prev.map((x, i) => (i === active ? '' : x)));
      return;
    }
    const next = ids.map((x) => (x === id ? '' : x));
    next[active] = id;
    let nx = next.findIndex((x, i) => i > active && !x);
    if (nx < 0) nx = next.findIndex((x) => !x);
    setIds(next);
    setActive(nx < 0 ? active : nx);
  }

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
          <div className="lu-pick">
            <div className="lu-slots">
              {ids.map((id, i) => {
                const rep = id && prevIds.includes(id);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`lu-slot${i === 0 ? ' lu-slot--gk' : ''}${active === i ? ' lu-slot--act' : ''}${rep ? ' lu-slot--rep' : ''}`}
                    onClick={() => { setActive(i); setChecking(false); }}
                    aria-label={`${i === 0 ? 'Portero' : `Puesto ${i + 1}`}: ${id ? `#${numberOf(id)} ${players[id]?.name}` : 'vacío'}`}
                  >
                    <i>{i === 0 ? 'P' : ''}</i>{id ? `#${numberOf(id)} ${players[id]?.name}` : '—'}
                  </button>
                );
              })}
            </div>
            <div className="lu-roster">
              {roster.map((p) => {
                const inn = ids.includes(p.id);
                const rep = prevIds.includes(p.id);
                return (
                  <button key={p.id} type="button" className={`lu-rp${inn ? ' lu-rp--in' : ''}${rep ? ' lu-rp--rep' : ''}`} onClick={() => pick(p.id)}>
                    <b>{p.number}</b>{(p.name || '').split(' ')[0]}<small>{rep ? `empezó ${short(period - 1)}` : ''}</small>
                  </button>
                );
              })}
            </div>
          </div>
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
