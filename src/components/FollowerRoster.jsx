import { usePlayers } from '../hooks/usePlayers';
import { rosterDisplayName } from '../utils/followerHelpers';

export default function FollowerRoster({ clubId, teamId }) {
  const { players } = usePlayers(clubId, teamId);
  const active = players
    .filter((p) => p.active !== false)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  return (
    <div>
      <h3 className="stats-section-title">Plantilla</h3>
      <div className="card-grid" style={{ marginTop: 'var(--space-3)' }}>
        {active.map((p) => {
          const authorized = p.imageAuthorized !== false;
          const name = authorized ? (rosterDisplayName(p) || `#${p.number ?? '?'}`) : `Jugador/a #${p.number ?? '?'}`;
          return (
            <div className="card" key={p.id}>
              {authorized && p.photoUrl ? (
                <img className="player-thumb" src={p.photoUrl} alt="" />
              ) : (
                <div className="player-thumb player-thumb--placeholder">{p.number ?? '?'}</div>
              )}
              <h4>#{p.number} {name}{p.isGK ? ' (P)' : ''}</h4>
              {p.position && <p>{p.position}</p>}
            </div>
          );
        })}
        {active.length === 0 && <p className="modal-hint">Todavía no hay jugadores en la plantilla.</p>}
      </div>
    </div>
  );
}
