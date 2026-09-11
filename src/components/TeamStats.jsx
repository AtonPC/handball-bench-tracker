import { useMemo, useState } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useTeamStats } from '../hooks/useTeamStats';
import PlayerStatsTable from './PlayerStatsTable';

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

const ANY = '';

export default function TeamStats({ clubId, teamId, teamName, onOpenMatchStats }) {
  const { matches } = useMatches(clubId, teamId);
  const finishedMatches = useMemo(() => matches.filter((m) => m.lifecycle === 'finished'), [matches]);

  const [search, setSearch] = useState('');
  const [matchFilter, setMatchFilter] = useState(ANY);
  const [dateFilter, setDateFilter] = useState('');
  const [jornadaFilter, setJornadaFilter] = useState(ANY);
  const [venueFilter, setVenueFilter] = useState(ANY);
  const [rivalFilter, setRivalFilter] = useState(ANY);

  const jornadaOptions = useMemo(
    () => [...new Set(finishedMatches.map((m) => m.jornada).filter((j) => j != null))].sort((a, b) => a - b),
    [finishedMatches]
  );
  const venueOptions = useMemo(
    () => [...new Set(finishedMatches.map((m) => m.venue).filter(Boolean))].sort(),
    [finishedMatches]
  );
  const rivalOptions = useMemo(
    () => [...new Set(finishedMatches.map((m) => m.rivalName).filter(Boolean))].sort(),
    [finishedMatches]
  );

  const filteredMatches = useMemo(() => finishedMatches.filter((m) => {
    if (matchFilter !== ANY && m.id !== matchFilter) return false;
    if (dateFilter && (!m.scheduledAt || new Date(m.scheduledAt).toISOString().slice(0, 10) !== dateFilter)) return false;
    if (jornadaFilter !== ANY && String(m.jornada) !== jornadaFilter) return false;
    if (venueFilter !== ANY && m.venue !== venueFilter) return false;
    if (rivalFilter !== ANY && m.rivalName !== rivalFilter) return false;
    return true;
  }), [finishedMatches, matchFilter, dateFilter, jornadaFilter, venueFilter, rivalFilter]);
  const filteredIds = useMemo(() => filteredMatches.map((m) => m.id), [filteredMatches]);

  const { totals, teamTotalMs, teamRivalGoalsConceded, loading } = useTeamStats(filteredIds);

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

  const matchCount = filteredMatches.length;
  const avgOwn = matchCount ? filteredMatches.reduce((s, m) => s + (m.score?.own || 0), 0) / matchCount : 0;
  const avgRival = matchCount ? filteredMatches.reduce((s, m) => s + (m.score?.rival || 0), 0) / matchCount : 0;
  const teamGoals = players.reduce((sum, p) => sum + p.goals, 0);
  const teamAttempts = players.reduce((sum, p) => sum + p.attempts, 0);
  const teamSaves = players.reduce((sum, p) => sum + (p.saves || 0), 0);
  const teamShotsFaced = teamSaves + teamRivalGoalsConceded;
  const teamRecoveries = players.reduce((sum, p) => sum + p.recoveries, 0);
  const avgRecoveries = matchCount ? (teamRecoveries / matchCount).toFixed(1) : '0';
  const teamExclusions = players.reduce((sum, p) => sum + (p.exclusionsCount || 0), 0);
  const avgExclusions = matchCount ? (teamExclusions / matchCount).toFixed(1) : '0';
  // Con un solo partido filtrado, la "media" es matemáticamente ese mismo
  // dato (dividir entre 1) — se quita la palabra "medio/as" para que no
  // parezca un cálculo distinto al ver un único partido.
  const isSingleMatch = matchCount === 1;

  const topScorers = useMemo(() => [...players].filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5), [players]);
  const topRecoverers = useMemo(() => [...players].filter((p) => p.recoveries > 0).sort((a, b) => b.recoveries - a.recoveries).slice(0, 5), [players]);
  const topSavers = useMemo(
    () => [...players].filter((p) => p.isGK && p.saves > 0).sort((a, b) => b.saves - a.saves).slice(0, 5),
    [players]
  );

  function clearFilters() {
    setMatchFilter(ANY);
    setDateFilter('');
    setJornadaFilter(ANY);
    setVenueFilter(ANY);
    setRivalFilter(ANY);
  }
  const hasActiveFilters = matchFilter !== ANY || dateFilter || jornadaFilter !== ANY || venueFilter !== ANY || rivalFilter !== ANY;

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
          <div className="list-filters">
            <select className="player-form-input" value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)}>
              <option value={ANY}>Todos los partidos</option>
              {finishedMatches.map((m) => (
                <option key={m.id} value={m.id}>vs {m.rivalName} — {m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString() : 'sin fecha'}</option>
              ))}
            </select>
            <input
              className="player-form-input"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filtrar por día"
            />
            <select className="player-form-input" value={jornadaFilter} onChange={(e) => setJornadaFilter(e.target.value)}>
              <option value={ANY}>Toda jornada</option>
              {jornadaOptions.map((j) => <option key={j} value={j}>Jornada {j}</option>)}
            </select>
            <select className="player-form-input" value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}>
              <option value={ANY}>Todo lugar</option>
              {venueOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="player-form-input" value={rivalFilter} onChange={(e) => setRivalFilter(e.target.value)}>
              <option value={ANY}>Todo rival</option>
              {rivalOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {hasActiveFilters && (
              <button type="button" className="btn btn-timeout" onClick={clearFilters}>Limpiar filtros</button>
            )}
          </div>

          {matchCount === 0 ? (
            <p className="modal-hint">Ningún partido coincide con los filtros.</p>
          ) : (
            <>
              <div className="stats-summary">
                <div className="stats-summary-item stats-summary-item--score">
                  <span className="stats-summary-label">{isSingleMatch ? 'Resultado' : 'Resultado medio'}</span>
                  <span className="stats-summary-value">{Math.round(avgOwn)} - {Math.round(avgRival)}</span>
                </div>
                <div className="stats-summary-item">
                  <span className="stats-summary-label">Goles/Tiros</span>
                  <span className="stats-summary-value">{teamGoals}/{teamAttempts}</span>
                </div>
                <div className="stats-summary-item">
                  <span className="stats-summary-label">% Acierto</span>
                  <span className="stats-summary-value">{pct(teamGoals, teamAttempts)}</span>
                </div>
                <div className="stats-summary-item">
                  <span className="stats-summary-label">Paradas/Tiros</span>
                  <span className="stats-summary-value">{teamSaves}/{teamShotsFaced}</span>
                </div>
                <div className="stats-summary-item">
                  <span className="stats-summary-label">% Paradas</span>
                  <span className="stats-summary-value">{pct(teamSaves, teamShotsFaced)}</span>
                </div>
                <div className="stats-summary-item">
                  <span className="stats-summary-label">{isSingleMatch ? 'Recuperaciones' : 'Recuperaciones medias'}</span>
                  <span className="stats-summary-value">{isSingleMatch ? teamRecoveries : avgRecoveries}</span>
                </div>
                <div className="stats-summary-item">
                  <span className="stats-summary-label">{isSingleMatch ? 'Exclusiones' : 'Exclusiones medias'}</span>
                  <span className="stats-summary-value">{isSingleMatch ? teamExclusions : avgExclusions}</span>
                </div>
              </div>

              <div className="card-grid" style={{ marginTop: 20 }}>
                <div className="card">
                  <h4>Máximos goleadores</h4>
                  {topScorers.length === 0 && <p>Todavía nadie ha marcado.</p>}
                  {topScorers.map((p, i) => (
                    <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.goals} gol{p.goals === 1 ? '' : 'es'} · {pct(p.goals, p.attempts)} acierto</p>
                  ))}
                </div>
                <div className="card">
                  <h4>Máximos recuperadores</h4>
                  {topRecoverers.length === 0 && <p>Todavía nadie ha recuperado.</p>}
                  {topRecoverers.map((p, i) => (
                    <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.recoveries} recup. · {(p.recoveries / (p.matchesPlayed || 1)).toFixed(1)} media/partido</p>
                  ))}
                </div>
                <div className="card">
                  <h4>Más paradas</h4>
                  {topSavers.length === 0 && <p>Todavía nadie ha parado.</p>}
                  {topSavers.map((p, i) => (
                    <p key={p.id}>{i + 1}. #{p.number} {p.name} — {p.saves} paradas · {pct(p.saves, p.shotsFaced)} paradas</p>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <PlayerStatsTable
                  rows={visiblePlayers}
                  minutesTotalMs={teamTotalMs}
                  showMatches
                  showMinutes
                  emptyMessage="Ningún jugador coincide con el filtro."
                />
              </div>
            </>
          )}

          <p className="modal-hint" style={{ marginTop: 20 }}>Partidos incluidos en este resumen</p>
          <div className="admin-list">
            {filteredMatches.map((m) => (
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
