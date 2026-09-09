import { useState } from 'react';
import { requestFollow, requestGuardianship, useAccessRequestActions } from '../hooks/useFollowRequests';

function TeamRequestRow({ team, grant, user }) {
  const [mode, setMode] = useState(null); // null | 'guardianship'
  const [playerLabel, setPlayerLabel] = useState('');
  const { retryRequest } = useAccessRequestActions();

  if (grant?.status === 'pending') {
    return (
      <div className="admin-row">
        <div className="admin-user-info">
          <span className="admin-user-name">{team.name}</span>
          <span className="admin-user-email">
            {grant.kind === 'guardianship' ? 'Solicitud de tutela' : 'Solicitud de seguimiento'} pendiente de aprobación
          </span>
        </div>
      </div>
    );
  }

  if (grant?.status === 'rejected') {
    return (
      <div className="admin-row">
        <div className="admin-user-info">
          <span className="admin-user-name">{team.name}</span>
          <span className="admin-user-email">Solicitud rechazada</span>
        </div>
        <button
          className="btn btn-timeout"
          onClick={() => retryRequest(grant.kind, team.id, user, grant.playerLabel)}
        >
          Volver a solicitar
        </button>
      </div>
    );
  }

  return (
    <div className="admin-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div className="admin-user-info">
        <span className="admin-user-name">{team.name}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-timeout" onClick={() => requestFollow(team.id, user)}>
          Seguir este equipo
        </button>
        <button className="btn btn-timeout" onClick={() => setMode(mode === 'guardianship' ? null : 'guardianship')}>
          Soy familiar de un jugador/a
        </button>
      </div>
      {mode === 'guardianship' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="player-form-input"
            placeholder="Nombre y dorsal de tu hijo/a"
            value={playerLabel}
            onChange={(e) => setPlayerLabel(e.target.value)}
          />
          <button
            className="btn btn-clock btn-start"
            disabled={!playerLabel.trim()}
            onClick={() => {
              requestGuardianship(team.id, playerLabel.trim(), user);
              setMode(null);
              setPlayerLabel('');
            }}
          >
            Enviar solicitud
          </button>
        </div>
      )}
    </div>
  );
}

// Pantalla para quien todavía no tiene acceso de staff a ningún equipo:
// puede pedir seguir a un equipo, o pedir tutela indicando a mano de qué
// jugador/a es familiar (no se le puede mostrar la plantilla real todavía —
// las reglas de "players" ya exigen tener acceso aprobado para leerla).
export default function FollowRequestScreen({ identity, user, onLogout, myGrants }) {
  const myGrantsByTeam = Object.fromEntries(myGrants.map((g) => [g.teamId, g]));
  const clubs = identity.allClubs || [];
  const teams = identity.allTeams || [];

  return (
    <div className="app-shell">
      <nav className="admin-nav">
        <span className="admin-nav-role">{user.displayName || user.email}</span>
        <button className="btn btn-logout" onClick={onLogout}>SALIR</button>
      </nav>
      <div className="admin-panel">
        <p className="modal-hint">
          Todavía no tienes acceso a ningún equipo. Solicita seguir a tu equipo, o indica que eres familiar de un
          jugador/a — el club tendrá que aprobar la solicitud antes de que puedas ver nada.
        </p>
        {clubs.map((club) => {
          const clubTeams = teams.filter((t) => t.clubId === club.id);
          if (clubTeams.length === 0) return null;
          return (
            <div key={club.id} style={{ marginTop: 16 }}>
              <h4>{club.name}</h4>
              <div className="admin-list">
                {clubTeams.map((team) => (
                  <TeamRequestRow key={team.id} team={team} grant={myGrantsByTeam[team.id]} user={user} />
                ))}
              </div>
            </div>
          );
        })}
        {clubs.length === 0 && <p className="modal-hint">Todavía no hay ningún club dado de alta.</p>}
      </div>
    </div>
  );
}
