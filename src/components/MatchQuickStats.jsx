import { formatClock } from '../utils/time';
import LineupsGrid from './LineupsGrid';

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
                <td>
                  {p.name}
                  {p.yellowCard && <span className="ref-card ref-card--yellow" style={{ marginLeft: 4 }} />}
                  {p.disqualified && <span className="ref-card ref-card--red" style={{ marginLeft: 4 }} />}
                </td>
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

// Consulta rápida durante el partido, ahora una pestaña más de la consola
// (antes era un modal aparte, con su propio botón "ESTADÍSTICAS" en la
// cabecera — 2026-09-16, mockup "Consola Luminosa"): separa titulares (los
// elegidos al armar el partido) de suplentes, con lo básico que suele
// preguntar la entrenadora — goles, fallos, exclusiones, minutos.
export default function MatchQuickStats({ state }) {
  const allPlayers = Object.values(state.players).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const startingIds = state.startingLineupIds.length ? state.startingLineupIds : state.courtSlots;
  const startingSet = new Set(startingIds);
  const starters = allPlayers.filter((p) => startingSet.has(p.id));
  const subs = allPlayers.filter((p) => !startingSet.has(p.id));

  return (
    <>
      {/* Quién empezó cada tiempo o cuarto (solo dorsales; el portero, primera
          fila) — para no repetir titulares de un cuarto a otro. */}
      <LineupsGrid
        title={state.clock.periodCount === 4 ? 'Titulares de cada cuarto' : 'Titulares de cada tiempo'}
        lineups={state.lineups}
        players={state.players}
        periodCount={state.clock.periodCount}
      />
      <StatsGroupTable title="Titulares" players={starters} />
      <StatsGroupTable title="Suplentes" players={subs} />
    </>
  );
}
