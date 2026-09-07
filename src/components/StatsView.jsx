import { Fragment, useMemo, useState } from 'react';
import { formatClock } from '../utils/time';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useShotEvents } from '../hooks/useShotEvents';
import { useSortableTable } from '../hooks/useSortableTable';
import SortableTh from './SortableTh';
import { SHOT_ZONES, GOAL_ZONES } from '../shotZones';

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

function ratio(part, total) {
  return total ? part / total : 0;
}

const ANY = '';

export default function StatsView({ store }) {
  const { state, matchId } = store;
  const rivalGoals = useRivalGoals(matchId);
  const rivalGoalsByNumber = useMemo(() => {
    const map = {};
    for (const g of rivalGoals) {
      map[g.number] = (map[g.number] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [rivalGoals]);

  const shotEvents = useShotEvents(matchId);
  const nameById = useMemo(() => {
    const map = {};
    for (const p of Object.values(state.players)) map[p.id] = p.name;
    return map;
  }, [state.players]);

  const players = Object.values(state.players)
    .map((p) => ({ ...p, attempts: p.goals + p.shots }))
    .sort((a, b) => a.number - b.number);

  const teamGoals = players.reduce((sum, p) => sum + p.goals, 0);
  const teamMisses = players.reduce((sum, p) => sum + p.shots, 0);
  const teamAttempts = teamGoals + teamMisses;
  const teamRecoveries = players.reduce((sum, p) => sum + p.recoveries, 0);
  const teamSaves = players.reduce((sum, p) => sum + (p.saves || 0), 0);
  const teamExclusions = players.reduce((sum, p) => sum + (p.exclusionsCount || 0), 0);
  const teamDisqualifications = players.filter((p) => p.disqualified).length;

  const columns = [
    { key: 'number', value: (p) => p.number ?? 0 },
    { key: 'name', value: (p) => p.name || '' },
    { key: 'time', value: (p) => p.accumulatedMs },
    { key: 'timePct', value: (p) => ratio(p.accumulatedMs, state.clock.elapsedMs) },
    { key: 'goals', value: (p) => p.goals },
    { key: 'shots', value: (p) => p.shots },
    { key: 'attempts', value: (p) => p.attempts },
    { key: 'accPct', value: (p) => ratio(p.goals, p.attempts) },
    { key: 'saves', value: (p) => p.saves || 0 },
    { key: 'recoveries', value: (p) => p.recoveries },
    { key: 'recPct', value: (p) => ratio(p.recoveries, teamRecoveries) },
    { key: 'exclusions', value: (p) => p.exclusionsCount || 0 },
    { key: 'disqualified', value: (p) => (p.disqualified ? 1 : 0) },
  ];
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(players, columns, 'number');

  // Toca Goles/Fallos/Tiros para desplegar de dónde vino cada uno — un toque
  // funciona igual en tablet/móvil que un hover, que ahí no existe.
  const [expanded, setExpanded] = useState(null); // { playerId, type: 'goal'|'miss'|'attempts' }

  function eventsFor(playerId, type) {
    return shotEvents
      .filter((s) => s.playerId === playerId && (type === 'attempts' || s.type === type))
      .sort((a, b) => a.minute - b.minute);
  }

  function toggleExpand(playerId, type) {
    setExpanded((cur) => (cur?.playerId === playerId && cur?.type === type ? null : { playerId, type }));
  }

  // --- Filtros de "Goles rivales" ---
  const [rivalFilter, setRivalFilter] = useState({ number: ANY, shotZone: ANY, goalZone: ANY, minMinute: '', maxMinute: '' });
  const rivalNumbers = useMemo(() => [...new Set(rivalGoals.map((g) => g.number))].sort((a, b) => a - b), [rivalGoals]);
  const filteredRivalGoals = useMemo(() => {
    return rivalGoals.filter((g) => {
      if (rivalFilter.number !== ANY && String(g.number) !== rivalFilter.number) return false;
      if (rivalFilter.shotZone !== ANY && g.shotZone !== rivalFilter.shotZone) return false;
      if (rivalFilter.goalZone !== ANY && g.goalZone !== rivalFilter.goalZone) return false;
      if (rivalFilter.minMinute && g.minute < Number(rivalFilter.minMinute)) return false;
      if (rivalFilter.maxMinute && g.minute > Number(rivalFilter.maxMinute)) return false;
      return true;
    });
  }, [rivalGoals, rivalFilter]);

  // --- Filtros de "Lanzamientos propios" ---
  const [shotFilter, setShotFilter] = useState({ playerId: ANY, type: ANY, shotZone: ANY, goalZone: ANY, minMinute: '', maxMinute: '' });
  const filteredShotEvents = useMemo(() => {
    return shotEvents.filter((s) => {
      if (shotFilter.playerId !== ANY && s.playerId !== shotFilter.playerId) return false;
      if (shotFilter.type !== ANY && s.type !== shotFilter.type) return false;
      if (shotFilter.shotZone !== ANY && s.shotZone !== shotFilter.shotZone) return false;
      if (shotFilter.goalZone !== ANY && s.goalZone !== shotFilter.goalZone) return false;
      if (shotFilter.minMinute && s.minute < Number(shotFilter.minMinute)) return false;
      if (shotFilter.maxMinute && s.minute > Number(shotFilter.maxMinute)) return false;
      return true;
    });
  }, [shotEvents, shotFilter]);

  return (
    <div className="stats-view">
      <div className="stats-summary">
        <div className="stats-summary-item">
          <span className="stats-summary-label">Marcador</span>
          <span className="stats-summary-value">{state.score.own} - {state.score.rival}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Tiempo de partido</span>
          <span className="stats-summary-value">{formatClock(state.clock.elapsedMs)}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Tiros totales (goles + fallos)</span>
          <span className="stats-summary-value">{teamAttempts}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">% de acierto</span>
          <span className="stats-summary-value">{pct(teamGoals, teamAttempts)}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Recuperaciones</span>
          <span className="stats-summary-value">{teamRecoveries}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Paradas</span>
          <span className="stats-summary-value">{teamSaves}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Exclusiones</span>
          <span className="stats-summary-value">{teamExclusions}</span>
        </div>
        <div className="stats-summary-item">
          <span className="stats-summary-label">Expulsiones</span>
          <span className="stats-summary-value">{teamDisqualifications}</span>
        </div>
      </div>

      <p className="modal-hint">Toca Goles, Fallos o Tiros de un jugador para ver de dónde vino cada uno (si tiene zona registrada).</p>
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <SortableTh label="#" columnKey="number" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Jugador" columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Tiempo" columnKey="time" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="% tiempo" columnKey="timePct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Goles" columnKey="goals" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Fallos" columnKey="shots" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Tiros" columnKey="attempts" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="% acierto" columnKey="accPct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Paradas" columnKey="saves" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Recup." columnKey="recoveries" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="% recup. equipo" columnKey="recPct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Excl." columnKey="exclusions" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Expulsado" columnKey="disqualified" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{p.number}</td>
                  <td>{p.name}{p.isGK ? ' (P)' : ''}</td>
                  <td>{formatClock(p.accumulatedMs)}</td>
                  <td>{pct(p.accumulatedMs, state.clock.elapsedMs)}</td>
                  <td><button type="button" className="stat-cell-btn" onClick={() => toggleExpand(p.id, 'goal')}>{p.goals}</button></td>
                  <td><button type="button" className="stat-cell-btn" onClick={() => toggleExpand(p.id, 'miss')}>{p.shots}</button></td>
                  <td><button type="button" className="stat-cell-btn" onClick={() => toggleExpand(p.id, 'attempts')}>{p.attempts}</button></td>
                  <td>{pct(p.goals, p.attempts)}</td>
                  <td>{p.saves || 0}</td>
                  <td>{p.recoveries}</td>
                  <td>{pct(p.recoveries, teamRecoveries)}</td>
                  <td>{p.exclusionsCount || 0}</td>
                  <td>{p.disqualified ? 'Sí' : '—'}</td>
                </tr>
                {expanded?.playerId === p.id && (
                  <tr className="stats-detail-row">
                    <td colSpan={13}>
                      {eventsFor(p.id, expanded.type).length === 0 ? (
                        <span className="modal-hint">Sin lanzamientos con zona registrados para esto.</span>
                      ) : (
                        <ul className="stats-detail-list">
                          {eventsFor(p.id, expanded.type).map((s) => (
                            <li key={s.id}>
                              Min. {s.minute}' — {s.type === 'goal' ? 'Gol' : 'Fallo'} · lanzó desde: {s.shotZone || 'sin zona'}
                              {s.type === 'goal' ? ` · entró por: ${s.goalZone || 'sin zona'}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {rivalGoals.length > 0 && (
        <>
          <h3 className="stats-section-title">Goles rivales</h3>
          <div className="list-filters">
            <select className="player-form-input" value={rivalFilter.number} onChange={(e) => setRivalFilter({ ...rivalFilter, number: e.target.value })}>
              <option value={ANY}>Todos los dorsales</option>
              {rivalNumbers.map((n) => <option key={n} value={n}>#{n}</option>)}
            </select>
            <select className="player-form-input" value={rivalFilter.shotZone} onChange={(e) => setRivalFilter({ ...rivalFilter, shotZone: e.target.value })}>
              <option value={ANY}>Toda zona de lanzamiento</option>
              {SHOT_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <select className="player-form-input" value={rivalFilter.goalZone} onChange={(e) => setRivalFilter({ ...rivalFilter, goalZone: e.target.value })}>
              <option value={ANY}>Toda zona de entrada</option>
              {GOAL_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <input className="player-form-input player-form-input--number" type="number" placeholder="Minuto desde" value={rivalFilter.minMinute} onChange={(e) => setRivalFilter({ ...rivalFilter, minMinute: e.target.value })} />
            <input className="player-form-input player-form-input--number" type="number" placeholder="Minuto hasta" value={rivalFilter.maxMinute} onChange={(e) => setRivalFilter({ ...rivalFilter, maxMinute: e.target.value })} />
          </div>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Min.</th>
                  <th>Dorsal</th>
                  <th>Zona de lanzamiento</th>
                  <th>Zona de entrada</th>
                </tr>
              </thead>
              <tbody>
                {filteredRivalGoals.map((g) => (
                  <tr key={g.id}>
                    <td>{g.minute}'</td>
                    <td>#{g.number}</td>
                    <td>{g.shotZone || '—'}</td>
                    <td>{g.goalZone || '—'}</td>
                  </tr>
                ))}
                {filteredRivalGoals.length === 0 && (
                  <tr><td colSpan={4}><p className="modal-hint">Ningún gol rival coincide con el filtro.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="modal-hint">
            Por dorsal: {rivalGoalsByNumber.map(([number, count]) => `#${number} (${count})`).join(' · ')}
          </p>
        </>
      )}

      {shotEvents.length > 0 && (
        <>
          <h3 className="stats-section-title">Lanzamientos propios (con zona)</h3>
          <div className="list-filters">
            <select className="player-form-input" value={shotFilter.playerId} onChange={(e) => setShotFilter({ ...shotFilter, playerId: e.target.value })}>
              <option value={ANY}>Todos los jugadores</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="player-form-input" value={shotFilter.type} onChange={(e) => setShotFilter({ ...shotFilter, type: e.target.value })}>
              <option value={ANY}>Gol y fallo</option>
              <option value="goal">Solo goles</option>
              <option value="miss">Solo fallos</option>
            </select>
            <select className="player-form-input" value={shotFilter.shotZone} onChange={(e) => setShotFilter({ ...shotFilter, shotZone: e.target.value })}>
              <option value={ANY}>Toda zona de lanzamiento</option>
              {SHOT_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <select className="player-form-input" value={shotFilter.goalZone} onChange={(e) => setShotFilter({ ...shotFilter, goalZone: e.target.value })}>
              <option value={ANY}>Toda zona de entrada</option>
              {GOAL_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <input className="player-form-input player-form-input--number" type="number" placeholder="Minuto desde" value={shotFilter.minMinute} onChange={(e) => setShotFilter({ ...shotFilter, minMinute: e.target.value })} />
            <input className="player-form-input player-form-input--number" type="number" placeholder="Minuto hasta" value={shotFilter.maxMinute} onChange={(e) => setShotFilter({ ...shotFilter, maxMinute: e.target.value })} />
          </div>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Min.</th>
                  <th>Jugador</th>
                  <th>Resultado</th>
                  <th>Zona de lanzamiento</th>
                  <th>Zona de entrada</th>
                </tr>
              </thead>
              <tbody>
                {filteredShotEvents.map((s) => (
                  <tr key={s.id}>
                    <td>{s.minute}'</td>
                    <td>{nameById[s.playerId] || s.playerId}</td>
                    <td>{s.type === 'goal' ? 'Gol' : 'Fallo'}</td>
                    <td>{s.shotZone || '—'}</td>
                    <td>{s.goalZone || '—'}</td>
                  </tr>
                ))}
                {filteredShotEvents.length === 0 && (
                  <tr><td colSpan={5}><p className="modal-hint">Ningún lanzamiento coincide con el filtro.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
