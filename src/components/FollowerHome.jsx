import { useEffect, useState } from 'react';

// Esqueleto de la vista de Seguidor/tutor: solo enrutado + selector de
// equipo por ahora. El contenido En Directo llega en una fase posterior
// (marcador, goles, exclusiones) y el de Acumuladas en la siguiente.
export default function FollowerHome({ identity, approvedTeamIds, user, onLogout }) {
  const teams = (identity.allTeams || []).filter((t) => approvedTeamIds.includes(t.id));
  const [teamId, setTeamId] = useState(teams[0]?.id || '');

  useEffect(() => {
    if (!teams.some((t) => t.id === teamId)) setTeamId(teams[0]?.id || '');
  }, [teams, teamId]);

  const activeTeam = teams.find((t) => t.id === teamId) || null;

  return (
    <div className="app-shell">
      <nav className="admin-nav">
        <span className="admin-nav-role">{user.displayName || user.email}</span>
        {teams.length > 1 && (
          <select
            className="admin-role-select"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            title="Equipo seguido"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <button className="btn btn-logout" onClick={onLogout}>SALIR</button>
      </nav>
      <div className="admin-panel">
        {activeTeam ? (
          <p className="modal-hint">Sigues a <strong>{activeTeam.name}</strong>.</p>
        ) : (
          <p className="modal-hint">No se encuentra el equipo aprobado.</p>
        )}
      </div>
    </div>
  );
}
