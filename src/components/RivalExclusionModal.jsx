import { useState } from 'react';

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

// Exclusión rival: solo el dorsal, sin zonas — a diferencia del gol rival.
export default function RivalExclusionModal({ onConfirm, onCancel }) {
  const [number, setNumber] = useState('');

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
    onConfirm({ number: Number(number) });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal rival-goal-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Exclusión rival — ¿qué dorsal?</h2>

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

        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" disabled={!number} onClick={handleConfirm}>
            REGISTRAR EXCLUSIÓN
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
