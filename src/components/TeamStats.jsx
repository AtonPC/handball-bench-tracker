import { useMemo, useState } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useTeamStats } from '../hooks/useTeamStats';
import PlayerStatsTable from './PlayerStatsTable';

export default function TeamStats({ clubId, teamId, teamName, onOpenMatchStats }) {
  const { matches } = useMatches(clubId, teamId);
  const finishedMatches = useMemo(() => matches.filter((m) => m.lifecycle === 'finished'), [matches]);
  const finishedIds = useMemo(() => finishedMatches.map((m) => m.id), [finishedMatches]);
  const { totals, teamTotalMs, teamRivalGoalsConceded, loading } = useTeamStats(finishedIds);
  const [search, setSearch] = useState('');

  const players = useMemo(() => {
    return Object.entries(totals).map(([id, p]) => ({
      id,
      ...p,
      attempts: p.goals + p.shots,
      shotsFaced: (p.saves || 0) + teamRivalGoalsConceded,
      disqualified: p.disqualifications || 0,
    }));
  }, [totals, teamRivalGoalsConceded]);

  const visiblePlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((p) => `${p.name || ''} ${p.number ?? ''}`.toLowerCase().includes(needle));
  }, [players, search]);

  const topScorers = useMemo(() => [...players].filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5), [players]);
  const topRecoverers = useMemo(() => [...players].filter((p) => p.recoveries > 0).sort((a, b) => b.recoveries - a.recoveries).slice(0, 5), [players]);

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
          <PlayerStatsTable
            rows={visiblePlayers}
            minutesTotalMs={teamTotalMs}
            showMatches
            showMinutes
            emptyMessage="Ningún jugador coincide con el filtro."
          />

          <div className="card-grid" style={{ marginTop: 20 }}>
            <div className="card">
              <h4>Máximos goleadores</h4>
              {topScorers.length === 0 && <p>Todavía nadie ha marcado.</p>}
              {topScorers.map((p, i) => (
                <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.goals} gol{p.goals === 1 ? '' : 'es'}</p>
              ))}
            </div>
            <div className="card">
              <h4>Máximos recuperadores</h4>
              {topRecoverers.length === 0 && <p>Todavía nadie ha recuperado.</p>}
              {topRecoverers.map((p, i) => (
                <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.recoveries} recup.</p>
              ))}
            </div>
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
