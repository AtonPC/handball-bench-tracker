import { LINEUP_SIZE } from '../utils/lineups';
import { periodShortLabel } from '../utils/periods';

// Quién EMPEZÓ cada tiempo o cuarto (solo dorsales, en columnas), de un vistazo.
// Cada columna tiene 7 filas y la primera es SIEMPRE el portero, resaltado con
// su color. Lo usan la pestaña "Jugadores" de la consola y, con la columna del
// periodo que va a empezar editable, LineupModal.
export default function LineupsGrid({ lineups, players, periodCount, title }) {
  const periods = Array.from({ length: periodCount }, (_, i) => i + 1).filter((p) => lineups[p]?.length);
  if (periods.length === 0) return null;
  const numberOf = (id) => players[id]?.number ?? '?';
  const nameOf = (id) => players[id]?.name || '';

  return (
    <div className="lineups-view">
      {title && <h3 className="stats-section-title">{title}</h3>}
      <div className="lineup-grid" style={{ gridTemplateColumns: `22px repeat(${periods.length}, minmax(0, 1fr))` }}>
        <span />
        {periods.map((p) => (
          <span key={p} className="lineup-head">{periodShortLabel(p, periodCount)}</span>
        ))}
        {Array.from({ length: LINEUP_SIZE }, (_, row) => (
          <RowCells key={row} row={row} periods={periods} lineups={lineups} numberOf={numberOf} nameOf={nameOf} />
        ))}
      </div>
      <p className="modal-hint lineup-legend">
        <span className="lineup-pill lineup-pill--gk lineup-pill--legend">P</span> = portero (primera fila). Solo dorsales:
        toca y mantén, o mira la plantilla, para el nombre.
      </p>
    </div>
  );
}

function RowCells({ row, periods, lineups, numberOf, nameOf }) {
  return (
    <>
      <span className={`lineup-row-label${row === 0 ? ' lineup-row-label--gk' : ''}`}>{row === 0 ? 'P' : ''}</span>
      {periods.map((p) => {
        const id = lineups[p][row];
        return (
          <span key={p} className="lineup-cell">
            {id ? (
              <span className={`lineup-pill${row === 0 ? ' lineup-pill--gk' : ''}`} title={nameOf(id)}>{numberOf(id)}</span>
            ) : (
              <span className="lineup-pill lineup-pill--empty">—</span>
            )}
          </span>
        );
      })}
    </>
  );
}
