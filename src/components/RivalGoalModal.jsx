import { useState } from 'react';
import { SHOT_ZONES, GOAL_ZONES } from '../shotZones';

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export default function RivalGoalModal({ onConfirm, onCancel }) {
  const [number, setNumber] = useState('');
  const [shotZone, setShotZone] = useState(null);
  const [goalZone, setGoalZone] = useState(null);

  function pressDigit(key) {
    if (key === 'C') {
      setNumber('');
    } else if (key === '⌫') {
      setNumber((n) => n.slice(0, -1));
    } else if (number.length < 2) {
      setNumber((n) => n + key);
    }
  }

  function handleConfirm() {
    if (!number) return;
    onConfirm({ number: Number(number), shotZone, goalZone });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal rival-goal-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Gol rival — ¿qué dorsal ha marcado?</h2>

        <div className="rival-goal-display">{number || '—'}</div>

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

        <p className="modal-hint">Zona de entrada a portería (opcional)</p>
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
          <button className="btn btn-clock btn-start" disabled={!number} onClick={handleConfirm}>
            REGISTRAR GOL
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
