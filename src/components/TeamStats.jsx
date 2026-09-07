import { useMemo, useState } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useTeamStats } from '../hooks/useTeamStats';
import { formatClock } from '../utils/time';

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

export default function TeamStats({ clubId, teamId, teamName, onOpenMatchStats }) {
  const { matches } = useMatches(clubId, teamId);
  const finishedMatches = useMemo(() => matches.filter((m) => m.lifecycle === 'finished'), [matches]);
  const finishedIds = useMemo(() => finishedMatches.map((m) => m.id), [finishedMatches]);
  const { totals, loading } = useTeamStats(finishedIds);
  const [search, setSearch] = useState('');

  const players = useMemo(() => {
    return Object.entries(totals)
      .map(([id, p]) => ({ id, ...p, attempts: p.goals + p.shots }))
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  }, [totals]);

  const visiblePlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((p) => `${p.name || ''} ${p.number ?? ''}`.toLowerCase().includes(needle));
  }, [players, search]);

  // El resumen de equipo siempre suma sobre todos los jugadores, no sobre el filtro
  // de búsqueda — filtrar es para encontrar a alguien, no para recalcular el equipo.
  const teamGoals = players.reduce((sum, p) => sum + p.goals, 0);
  const teamMisses = players.reduce((sum, p) => sum + p.shots, 0);
  const teamAttempts = teamGoals + teamMisses;
  const teamSaves = players.reduce((sum, p) => sum + (p.saves || 0), 0);
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
                <th>#</th>
                <th>Jugador</th>
                <th>Partidos</th>
                <th>Tiempo total</th>
                <th>Goles</th>
                <th>Fallos</th>
                <th>Tiros</th>
                <th>% acierto</th>
                <th>Paradas</th>
                <th>Recup.</th>
                <th>Excl.</th>
                <th>Expulsiones</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map((p) => (
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
