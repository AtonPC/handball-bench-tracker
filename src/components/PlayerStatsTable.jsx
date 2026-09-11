import { useSortableTable } from '../hooks/useSortableTable';
import SortableTh from './SortableTh';

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

function ratio(part, total) {
  return total ? part / total : 0;
}

// Misma tabla de estadísticas de jugador, tanto si es de un partido concreto
// como del acumulado de la temporada, y tanto si la ve el staff como un
// Seguidor — para que nunca vuelvan a desincronizarse entre sí. `minutesTotalMs`
// es el total sobre el que se calcula "% Minutos": el tiempo del partido en
// curso, o la suma de la duración de todos los partidos finalizados si es el
// acumulado de temporada. Nunca se muestra el tiempo jugado en minutos, solo
// el porcentaje — así de un vistazo se ve el reparto sin dar pie a discutir
// "le has puesto 3 minutos menos" partido a partido.
function buildPlayerStatsColumns({ minutesTotalMs, showMatches }) {
  const columns = [
    { key: 'number', label: '#', value: (p) => p.number ?? 0, render: (p) => p.number },
    { key: 'name', label: 'Jugador/a', value: (p) => p.name || '', render: (p) => `${p.name}${p.isGK ? ' (P)' : ''}` },
  ];
  if (showMatches) {
    columns.push(
      { key: 'matchesPlayed', label: 'Jugados', value: (p) => p.matchesPlayed ?? 0, render: (p) => p.matchesPlayed ?? 0 },
      { key: 'matchesCalledUp', label: 'Convocados', value: (p) => p.matchesCalledUp ?? 0, render: (p) => p.matchesCalledUp ?? 0 }
    );
  }
  columns.push(
    { key: 'minutesPct', label: '% Minutos', value: (p) => ratio(p.accumulatedMs, minutesTotalMs), render: (p) => pct(p.accumulatedMs, minutesTotalMs) },
    { key: 'goals', label: 'Goles/Tiros', value: (p) => p.goals, render: (p) => `${p.goals}/${p.attempts}` },
    { key: 'accPct', label: '% Acierto', value: (p) => ratio(p.goals, p.attempts), render: (p) => pct(p.goals, p.attempts) },
    { key: 'saves', label: 'Paradas/Tiros', value: (p) => (p.isGK ? p.saves || 0 : -1), render: (p) => (p.isGK ? `${p.saves || 0}/${p.shotsFaced}` : '—') },
    { key: 'savePct', label: '% Paradas', value: (p) => (p.isGK ? ratio(p.saves || 0, p.shotsFaced) : -1), render: (p) => (p.isGK ? pct(p.saves || 0, p.shotsFaced) : '—') },
    { key: 'recoveries', label: 'Recup.', value: (p) => p.recoveries, render: (p) => p.recoveries },
    { key: 'exclusions', label: 'Excl.', value: (p) => p.exclusionsCount || 0, render: (p) => p.exclusionsCount || 0 },
    // En un partido, `disqualified` es un booleano (Sí/—); en el acumulado de
    // temporada es cuántas veces ha pasado (0 se muestra igual como "—").
    { key: 'disqualified', label: 'Expulsado', value: (p) => Number(p.disqualified) || 0, render: (p) => (typeof p.disqualified === 'number' ? p.disqualified || '—' : (p.disqualified ? 'Sí' : '—')) }
  );
  return columns;
}

// `rows` ya trae `attempts` y `shotsFaced` calculados (quién concede qué gol
// rival no se sabe por portero, así que `shotsFaced` es del equipo, no 1:1
// del portero si hubo más de uno en el partido/temporada).
export default function PlayerStatsTable({ rows, minutesTotalMs, showMatches, emptyMessage, rowClassName }) {
  const columns = buildPlayerStatsColumns({ minutesTotalMs, showMatches });
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(rows, columns, 'number');

  return (
    <div className="stats-table-wrap">
      <table className="stats-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <SortableTh key={c.key} label={c.label} columnKey={c.key} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className={rowClassName?.(p) || undefined}>
              {columns.map((c) => <td key={c.key}>{c.render(p)}</td>)}
            </tr>
          ))}
          {sorted.length === 0 && emptyMessage && (
            <tr><td colSpan={columns.length}><p className="modal-hint">{emptyMessage}</p></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
