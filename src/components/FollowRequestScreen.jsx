import { useState } from 'react';
import { requestFollow, requestGuardianship, useAccessRequestActions } from '../hooks/useFollowRequests';
import { useRosterDirectory } from '../hooks/useRosterDirectory';

function TeamRequestRow({ team, grant, user }) {
  const [mode, setMode] = useState(null); // null | 'guardianship'
  const [playerId, setPlayerId] = useState('');
  const { retryRequest } = useAccessRequestActions();
  // Solo se pide la plantilla pública (rosterDirectory) cuando hace falta
  // elegir jugador/a — nada de leerla de más si solo se va a "seguir".
  const roster = useRosterDirectory(mode === 'guardianship' ? team.id : null);

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
          onClick={() => retryRequest(
            grant.kind, team.id, user,
            grant.kind === 'guardianship' ? { id: grant.playerId, displayName: grant.playerName, number: grant.playerNumber } : undefined
          )}
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
          <select className="player-form-input" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Selecciona jugador/a…</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>#{p.number} {p.displayName}</option>
            ))}
          </select>
          {roster.length === 0 && <span className="modal-hint">Esta plantilla todavía no tiene jugadores.</span>}
          <button
            className="btn btn-clock btn-start"
            disabled={!playerId}
            onClick={() => {
              const player = roster.find((p) => p.id === playerId);
              requestGuardianship(team.id, player, user);
              setMode(null);
              setPlayerId('');
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
// puede pedir seguir a un equipo, o pedir tutela eligiendo de qué
// jugador/a es familiar en un desplegable (rosterDirectory: solo nombre y
// dorsal, abierto a cualquier persona registrada — la plantilla completa
// sigue exigiendo el acceso aprobado que da follow/guardianship).
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
