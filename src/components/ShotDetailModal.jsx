import { useState } from 'react';
import ShotZoneDiagram from './ShotZoneDiagram';
import { missingZoneWarning } from '../shotZones';

// Se abre al marcar Gol o Fallo de un jugador propio: zonas opcionales, igual
// que en el gol rival — si no hay tiempo, se pulsa Registrar sin elegir nada.
// En un Fallo, "por dónde falló" incluye también salir fuera de la portería
// (no toda falla es una parada del rival).
export default function ShotDetailModal({ playerName, kind, onConfirm, onCancel }) {
  const [shotZone, setShotZone] = useState(null);
  const [goalZone, setGoalZone] = useState(null);

  function handleConfirm() {
    const warning = missingZoneWarning(shotZone, goalZone);
    if (warning && !confirm(warning)) return;
    onConfirm({ shotZone, goalZone });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal rival-goal-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{kind === 'goal' ? 'Gol' : 'Fallo'} — {playerName}</h2>

        <p className="modal-hint">
          {kind === 'goal' ? 'De dónde vino y por dónde entró (opcional)' : 'De dónde vino y por dónde falló: parada o fuera (opcional)'}
        </p>
        <ShotZoneDiagram
          showGoal
          showOut={kind === 'miss'}
          showOrigin
          shotZone={shotZone}
          onShotZone={setShotZone}
          goalZone={goalZone}
          onGoalZone={setGoalZone}
        />

        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" onClick={handleConfirm}>
            REGISTRAR
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
