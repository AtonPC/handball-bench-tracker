import { useState } from 'react';
import { GOAL_ZONES } from '../shotZones';

// Se abre al marcar Parada del portero: solo pide la zona donde paró el
// balón (sin "Fuera" — por definición una parada se queda dentro del marco).
export default function SaveDetailModal({ playerName, onConfirm, onCancel }) {
  const [goalZone, setGoalZone] = useState(null);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal rival-goal-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Parada — {playerName}</h2>

        <p className="modal-hint">Zona de la parada (opcional)</p>
        <div className="zone-grid">
          {GOAL_ZONES.map((z) => (
            <button
              key={z}
              type="button"
              className={`zone-btn${goalZone === z ? ' zone-btn--active' : ''}`}
              onClick={() => setGoalZone(goalZone === z ? null : z)}
            >
              {z}
            </button>
          ))}
        </div>

        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" onClick={() => onConfirm({ goalZone })}>
            REGISTRAR
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
