import { useState } from 'react';
import { useMatches } from '../hooks/useMatches';
import FollowerMatchDetail from './FollowerMatchDetail';

const LIFECYCLE_LABEL = { scheduled: 'Programado', live: 'En directo', finished: 'Finalizado' };

export default function FollowerMatches({ clubId, teamId, team, tier }) {
  const { matches } = useMatches(clubId, teamId);
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  const sorted = [...matches].sort((a, b) => (b.scheduledAt || 0) - (a.scheduledAt || 0));

  if (selectedMatchId) {
    return <FollowerMatchDetail clubId={clubId} teamId={teamId} team={team} tier={tier} matchId={selectedMatchId} onBack={() => setSelectedMatchId(null)} />;
  }

  return (
    <div>
      <h3 className="stats-section-title">Partidos</h3>
      <div className="admin-list">
        {sorted.map((m) => (
          <div key={m.id} className="admin-row">
            <div className="admin-user-info">
              <span className="admin-user-name">
                vs {m.rivalName || 'Rival'} ({m.isHome ? 'Local' : 'Visitante'})
              </span>
              <span className="admin-user-email">
                {m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString() : 'Sin fecha'}
                {m.jornada != null ? ` · Jornada ${m.jornada}` : ''}
                {' · '}{LIFECYCLE_LABEL[m.lifecycle] || m.lifecycle}
                {m.lifecycle === 'finished' ? ` · ${m.score?.own ?? '—'}-${m.score?.rival ?? '—'}` : ''}
              </span>
            </div>
            {m.lifecycle === 'finished' && (
              <button type="button" className="btn btn-timeout" onClick={() => setSelectedMatchId(m.id)}>Ver estadísticas</button>
            )}
          </div>
        ))}
        {sorted.length === 0 && <p className="modal-hint">Todavía no hay partidos para {team?.name || 'este equipo'}.</p>}
      </div>
    </div>
  );
}
