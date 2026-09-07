import { useMemo, useState } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useTeamStats } from '../hooks/useTeamStats';
import { useSortableTable } from '../hooks/useSortableTable';
import SortableTh from './SortableTh';
import { formatClock } from '../utils/time';

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

function ratio(part, total) {
  return total ? part / total : 0;
}

export default function TeamStats({ clubId, teamId, teamName, onOpenMatchStats }) {
  const { matches } = useMatches(clubId, teamId);
  const finishedMatches = useMemo(() => matches.filter((m) => m.lifecycle === 'finished'), [matches]);
  const finishedIds = useMemo(() => finishedMatches.map((m) => m.id), [finishedMatches]);
  const { totals, loading } = useTeamStats(finishedIds);
  const [search, setSearch] = useState('');

  const players = useMemo(() => {
    return Object.entries(totals).map(([id, p]) => ({ id, ...p, attempts: p.goals + p.shots }));
  }, [totals]);

  const visiblePlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((p) => `${p.name || ''} ${p.number ?? ''}`.toLowerCase().includes(needle));
  }, [players, search]);

  const columns = [
    { key: 'number', value: (p) => p.number ?? 0 },
    { key: 'name', value: (p) => p.name || '' },
    { key: 'matches', value: (p) => p.matchesPlayed },
    { key: 'time', value: (p) => p.accumulatedMs },
    { key: 'goals', value: (p) => p.goals },
    { key: 'shots', value: (p) => p.shots },
    { key: 'attempts', value: (p) => p.attempts },
    { key: 'accPct', value: (p) => ratio(p.goals, p.attempts) },
    { key: 'saves', value: (p) => p.saves || 0 },
    { key: 'recoveries', value: (p) => p.recoveries },
    { key: 'exclusions', value: (p) => p.exclusionsCount || 0 },
    { key: 'disqualifications', value: (p) => p.disqualifications || 0 },
  ];
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(visiblePlayers, columns, 'number');

  // El resumen de equipo siempre suma sobre todos los jugadores, no sobre el filtro
  // de búsqueda — filtrar es para encontrar a alguien, no para recalcular el equipo.
  const teamGoals = players.reduce((sum, p) => sum + p.goals, 0);
  const teamMisses = players.reduce((sum, p) => sum + p.shots, 0);
  const teamAttempts = teamGoals + teamMisses;
  const teamSaves = players.reduce((sum, p) => sum + (p.saves || 0), 0);
  const teamRecoveries = players.reduce((sum, p) => sum + p.recoveries, 0);
  const teamExclusions = players.reduce((sum, p) => sum + (p.exclusionsCount || 0), 0);
  const teamDisqualifications = players.reduce((sum, p) => sum + (p.disqualifications || 0), 0);

  return (
    <div className="admin-panel">
      <p className="modal-hint">Resumen de <strong>{teamName}</strong> ({finishedMatches.length} partido{finishedMatches.length === 1 ? '' : 's'} finalizado{finishedMatches.length === 1 ? '' : 's'})</p>

      {loading && <p className="modal-hint">Calculando…</p>}

      {!loading && finishedMatches.length === 0 && (
        <p className="modal-hint">Todavía no hay partidos finalizados para este equipo.</p>
      )}

      {!loading && finishedMatches.length > 0 && (
        <>
          <div className="list-search">
            <input
              className="player-form-input"
              placeholder="Filtrar por jugador o dorsal…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <SortableTh label="#" columnKey="number" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Jugador" columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Partidos" columnKey="matches" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Tiempo total" columnKey="time" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Goles" columnKey="goals" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Fallos" columnKey="shots" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Tiros" columnKey="attempts" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="% acierto" columnKey="accPct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Paradas" columnKey="saves" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Recup." columnKey="recoveries" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Excl." columnKey="exclusions" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Expulsiones" columnKey="disqualifications" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>{p.number}</td>
                  <td>{p.name}{p.isGK ? ' (P)' : ''}</td>
                  <td>{p.matchesPlayed}</td>
                  <td>{formatClock(p.accumulatedMs)}</td>
                  <td>{p.goals}</td>
                  <td>{p.shots}</td>
                  <td>{p.attempts}</td>
                  <td>{pct(p.goals, p.attempts)}</td>
                  <td>{p.saves || 0}</td>
                  <td>{p.recoveries}</td>
                  <td>{p.exclusionsCount || 0}</td>
                  <td>{p.disqualifications || 0}</td>
                </tr>
              ))}
              {visiblePlayers.length === 0 && (
                <tr><td colSpan={12}><p className="modal-hint">Ningún jugador coincide con el filtro.</p></td></tr>
              )}
              <tr>
                <td /><td><strong>Equipo</strong></td><td /><td />
                <td><strong>{teamGoals}</strong></td>
                <td><strong>{teamMisses}</strong></td>
                <td><strong>{teamAttempts}</strong></td>
                <td><strong>{pct(teamGoals, teamAttempts)}</strong></td>
                <td><strong>{teamSaves}</strong></td>
                <td><strong>{teamRecoveries}</strong></td>
                <td><strong>{teamExclusions}</strong></td>
                <td><strong>{teamDisqualifications}</strong></td>
              </tr>
            </tbody>
          </table>
          </div>

          <p className="modal-hint" style={{ marginTop: 20 }}>Partidos incluidos en este resumen</p>
          <div className="admin-list">
            {finishedMatches.map((m) => (
              <div key={m.id} className="admin-row">
                <div className="admin-user-info">
                  <span className="admin-user-name">
                    {m.isHome ? `${m.ownTeamName || teamName} vs ${m.rivalName}` : `${m.rivalName} vs ${m.ownTeamName || teamName}`}
                  </span>
                  <span className="admin-user-email">
                    {m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString() : ''} · {m.score?.own ?? '—'}-{m.score?.rival ?? '—'}
                  </span>
                </div>
                <button className="btn btn-timeout" onClick={() => onOpenMatchStats(m.id)}>Ver este partido</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
