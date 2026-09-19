import { useState } from 'react';
import { useTeams } from '../hooks/useTeams';
import { useAccessApprovals, useTeamAccessRequests } from '../hooks/useAccessApprovals';
import { FOLLOWER_TIERS, normalizeTier } from '../utils/followerTier';

const KIND_LABEL = { follow: 'Seguidor', guardianship: 'Tutela' };

// playerLabel es el campo antiguo (texto libre) de antes del selector de
// jugador/a — se mantiene como respaldo por si queda alguna solicitud
// creada con esa versión.
function guardianshipPlayerText(r) {
  if (r.kind !== 'guardianship') return '';
  if (r.playerName) return ` · #${r.playerNumber ?? '?'} ${r.playerName}`;
  if (r.playerLabel) return ` · ${r.playerLabel}`;
  return '';
}

export default function FollowApprovals({ clubId, identity }) {
  const { teams } = useTeams(clubId);
  const [teamId, setTeamId] = useState('');
  const activeTeamId = teamId || teams[0]?.id || '';
  const { pending, approved, rejected } = useTeamAccessRequests(activeTeamId);
  const { approveRequest, rejectRequest, setTier } = useAccessApprovals();

  return (
    <div className="admin-panel">
      <p className="modal-hint">Solicitudes de acceso de seguidores y tutores</p>
      <p className="modal-hint">
        Al aprobar, entran como <strong>Estándar</strong> (solo estadísticas del equipo). Puedes subir a <strong>Pro</strong>
        (también estadísticas individuales de jugadores) a quien corresponda desde "Aprobados".
      </p>

      <select className="player-form-input" style={{ marginBottom: 10 }} value={activeTeamId} onChange={(e) => setTeamId(e.target.value)}>
        {teams.length === 0 && <option value="">Sin equipos todavía</option>}
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <h4>Pendientes</h4>
      <div className="admin-list">
        {pending.map((r) => (
          <div key={`${r.kind}-${r.id}`} className="admin-row">
            <div className="admin-user-info">
              <span className="admin-user-name">{r.personDisplayName || r.personEmail}</span>
              <span className="admin-user-email">
                {KIND_LABEL[r.kind]}{guardianshipPlayerText(r)} · {r.personEmail}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-clock btn-start" onClick={() => approveRequest(r.kind, r.id, identity)}>Aprobar</button>
              <button className="btn btn-timeout btn-danger-text" onClick={() => rejectRequest(r.kind, r.id, identity)}>Rechazar</button>
            </div>
          </div>
        ))}
        {activeTeamId && pending.length === 0 && <p className="modal-hint">No hay solicitudes pendientes.</p>}
      </div>

      {approved.length > 0 && (
        <>
          <h4 style={{ marginTop: 20 }}>Aprobados</h4>
          <div className="admin-list">
            {approved.map((r) => (
              <div key={`${r.kind}-${r.id}`} className="admin-row">
                <div className="admin-user-info">
                  <span className="admin-user-name">{r.personDisplayName || r.personEmail}</span>
                  <span className="admin-user-email">
                    {KIND_LABEL[r.kind]}{guardianshipPlayerText(r)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="player-form-input tier-select"
                    value={normalizeTier(r.tier)}
                    onChange={(e) => setTier(r.kind, r.id, e.target.value)}
                    title="Estándar: solo estadísticas del equipo. Pro: también las individuales."
                    aria-label="Nivel de seguidor"
                  >
                    {Object.entries(FOLLOWER_TIERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  <button className="btn btn-timeout btn-danger-text" onClick={() => rejectRequest(r.kind, r.id, identity)}>Revocar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {rejected.length > 0 && (
        <>
          <h4 style={{ marginTop: 20 }}>Rechazados</h4>
          <div className="admin-list">
            {rejected.map((r) => (
              <div key={`${r.kind}-${r.id}`} className="admin-row">
                <div className="admin-user-info">
                  <span className="admin-user-name">{r.personDisplayName || r.personEmail}</span>
                  <span className="admin-user-email">{KIND_LABEL[r.kind]}</span>
                </div>
                <button className="btn btn-clock btn-start" onClick={() => approveRequest(r.kind, r.id, identity)}>Aprobar</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
