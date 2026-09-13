import { useClubs } from '../hooks/useClubs';
import { useLeagues } from '../hooks/useLeagues';
import { useStaffMemberships } from '../hooks/useStaffMemberships';
import { STAFF_LABELS } from '../permissions';

export default function FollowerClub({ clubId, teamId, team }) {
  const { clubs } = useClubs(true);
  const { leagues } = useLeagues(true);
  const { memberships } = useStaffMemberships(teamId);
  const club = clubs.find((c) => c.id === clubId);
  const league = leagues.find((l) => l.id === team?.leagueId);
  const activeStaff = memberships.filter((m) => m.active !== false);

  return (
    <div>
      <h3 className="stats-section-title">Club</h3>
      <div className="card-grid" style={{ marginTop: 'var(--space-3)' }}>
        <div className="card">
          <h4>{club?.name || 'Club'}</h4>
          <p>Equipo: {team?.name || '—'}</p>
          {team?.category && <p>Categoría: {team.category}</p>}
          {league && <p>Liga: {league.name}{league.season ? ` (${league.season})` : ''}</p>}
        </div>
        {team?.crestUrl && (
          <div className="card">
            <img src={team.crestUrl} alt="" className="team-crest" style={{ width: 64, height: 64 }} />
          </div>
        )}
        <div className="card">
          <h4>Staff</h4>
          {activeStaff.length === 0 && <p>Todavía no hay staff asignado.</p>}
          {activeStaff.map((m) => (
            <p key={m.id}>{STAFF_LABELS[m.label] || m.label}: {m.personDisplayName || 'Sin nombre'}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
