import { useState } from 'react';
import ShotZoneDiagram from './ShotZoneDiagram';
import { missingZoneWarning } from '../shotZones';

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

// Se abre al marcar Parada del portero: de dónde vino el lanzamiento y
// dónde paró el balón, ambas opcionales (sin "Fuera" — por definición una
// parada se queda dentro del marco). La zona de origen es la única forma
// de saber si una parada fue de 7 metros.
// Una parada nuestra es, a la vez, un tiro fallado del rival — el dorsal
// de quien tiró es opcional (como todo lo demás aquí, si no hay tiempo de
// verlo no bloquea registrar la parada) pero permite sacar "tiros por
// dorsal" del rival igual que ya existe para sus goles.
export default function SaveDetailModal({ playerName, onConfirm, onCancel }) {
  const [shotZone, setShotZone] = useState(null);
  const [goalZone, setGoalZone] = useState(null);
  const [rivalNumber, setRivalNumber] = useState('');

  function pressDigit(key) {
    if (key === 'C') {
      setRivalNumber('');
    } else if (key === '⌫') {
      setRivalNumber((n) => n.slice(0, -1));
    } else if (rivalNumber.length < 2) {
      setRivalNumber((n) => n + key);
    }
  }

  function handleConfirm() {
    const warning = missingZoneWarning(shotZone, goalZone);
    if (warning && !confirm(warning)) return;
    onConfirm({ shotZone, goalZone, rivalNumber: rivalNumber ? Number(rivalNumber) : null });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal rival-goal-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Parada — {playerName}</h2>

        <p className="modal-hint">¿Qué dorsal rival ha tirado? (opcional)</p>
        <div className="rival-goal-display">{rivalNumber || '—'}</div>
        <div className="keypad">
          {KEYPAD_DIGITS.map((key) => (
            <button
              key={key}
              type="button"
              className={`keypad-btn${key === 'C' || key === '⌫' ? ' keypad-btn--alt' : ''}`}
              onClick={() => pressDigit(key)}
            >
              {key}
            </button>
          ))}
        </div>

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
          <button className="btn btn-clock btn-start" onClick={handleConfirm}>
            REGISTRAR
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
