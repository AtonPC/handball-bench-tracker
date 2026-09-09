import { useState } from 'react';
import { SHOT_ZONES, GOAL_ZONES, OUT_ZONES } from '../shotZones';

// Se abre al marcar Gol o Fallo de un jugador propio: zonas opcionales, igual
// que en el gol rival — si no hay tiempo, se pulsa Registrar sin elegir nada.
// En un Fallo, "por dónde falló" incluye también salir fuera de la portería
// (no toda falla es una parada del rival).
export default function ShotDetailModal({ playerName, kind, onConfirm, onCancel }) {
  const [shotZone, setShotZone] = useState(null);
  const [goalZone, setGoalZone] = useState(null);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal rival-goal-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{kind === 'goal' ? 'Gol' : 'Fallo'} — {playerName}</h2>

        <p className="modal-hint">Zona de lanzamiento (opcional)</p>
        <div className="zone-grid">
          {SHOT_ZONES.map((z) => (
            <button
              key={z}
              type="button"
              className={`zone-btn${shotZone === z ? ' zone-btn--active' : ''}`}
              onClick={() => setShotZone(shotZone === z ? null : z)}
            >
              {z}
            </button>
          ))}
        </div>

        <p className="modal-hint">{kind === 'goal' ? 'Zona de entrada a portería (opcional)' : 'Por dónde falló: parada o fuera (opcional)'}</p>
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
          {kind === 'miss' && OUT_ZONES.map((z) => (
            <button
              key={z}
              type="button"
              className={`zone-btn zone-btn--out${goalZone === z ? ' zone-btn--active' : ''}`}
              onClick={() => setGoalZone(goalZone === z ? null : z)}
            >
              {z}
            </button>
          ))}
        </div>

        <div className="player-form-actions">
          <button
            className="btn btn-clock btn-start"
            onClick={() => onConfirm({ shotZone, goalZone })}
          >
            REGISTRAR
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
