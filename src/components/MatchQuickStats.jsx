import { formatClock } from '../utils/time';

function StatsGroupTable({ title, players }) {
  return (
    <>
      <h3 className="stats-section-title">{title}</h3>
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Min.</th>
              <th>Goles</th>
              <th>Fallos</th>
              <th>Excl.</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>{p.number}</td>
                <td>{p.name}{p.disqualified && <span className="ref-card ref-card--red" />}</td>
                <td>{formatClock(p.accumulatedMs)}</td>
                <td>{p.goals}</td>
                <td>{p.shots}</td>
                <td>{p.exclusionsCount || 0}</td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr><td colSpan={6}><span className="modal-hint">Nadie en este grupo.</span></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Consulta rápida durante el partido, sin salir de la consola: separa
// titulares (los elegidos al armar el partido) de suplentes, con lo básico
// que suele preguntar la entrenadora — goles, fallos, exclusiones, minutos.
export default function MatchQuickStats({ state, onClose }) {
  const allPlayers = Object.values(state.players).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const startingIds = state.startingLineupIds.length ? state.startingLineupIds : state.courtSlots;
  const startingSet = new Set(startingIds);
  const starters = allPlayers.filter((p) => startingSet.has(p.id));
  const subs = allPlayers.filter((p) => !startingSet.has(p.id));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal quick-stats-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Estadísticas rápidas</h2>
        <StatsGroupTable title="Titulares" players={starters} />
        <StatsGroupTable title="Suplentes" players={subs} />
        <button className="modal-cancel" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
