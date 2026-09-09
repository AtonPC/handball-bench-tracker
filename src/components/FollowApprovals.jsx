import { useState } from 'react';
import { useTeams } from '../hooks/useTeams';
import { useAccessApprovals, useTeamAccessRequests } from '../hooks/useAccessApprovals';

const KIND_LABEL = { follow: 'Seguidor', guardianship: 'Tutela' };

export default function FollowApprovals({ clubId, identity }) {
  const { teams } = useTeams(clubId);
  const [teamId, setTeamId] = useState('');
  const activeTeamId = teamId || teams[0]?.id || '';
  const { pending, approved, rejected } = useTeamAccessRequests(activeTeamId);
  const { approveRequest, rejectRequest } = useAccessApprovals();

  return (
    <div className="admin-panel">
      <p className="modal-hint">Solicitudes de acceso de seguidores y tutores</p>

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
                {KIND_LABEL[r.kind]}{r.kind === 'guardianship' && r.playerLabel ? ` · ${r.playerLabel}` : ''} · {r.personEmail}
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
                    {KIND_LABEL[r.kind]}{r.kind === 'guardianship' && r.playerLabel ? ` · ${r.playerLabel}` : ''}
                  </span>
                </div>
                <button className="btn btn-timeout btn-danger-text" onClick={() => rejectRequest(r.kind, r.id, identity)}>Revocar</button>
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
