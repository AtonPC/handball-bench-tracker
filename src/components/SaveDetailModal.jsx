import { useState } from 'react';
import ShotZoneDiagram from './ShotZoneDiagram';

// Se abre al marcar Parada del portero: de dónde vino el lanzamiento y
// dónde paró el balón, ambas opcionales (sin "Fuera" — por definición una
// parada se queda dentro del marco). La zona de origen es la única forma
// de saber si una parada fue de 7 metros.
export default function SaveDetailModal({ playerName, onConfirm, onCancel }) {
  const [shotZone, setShotZone] = useState(null);
  const [goalZone, setGoalZone] = useState(null);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal rival-goal-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Parada — {playerName}</h2>

        <p className="modal-hint">De dónde vino y dónde paró el balón (opcional)</p>
        <ShotZoneDiagram
          showGoal
          showOrigin
          shotZone={shotZone}
          onShotZone={setShotZone}
          goalZone={goalZone}
          onGoalZone={setGoalZone}
        />

        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" onClick={() => onConfirm({ shotZone, goalZone })}>
            REGISTRAR
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
