import { useState } from 'react';

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

// Teclado numérico para anotar una acción rival identificada solo por
// dorsal, sin zonas (exclusión, 7 metros cometido...). Genérico: título y
// texto del botón los pone quien lo abre.
export default function DorsalNumberModal({ title, confirmLabel, onConfirm, onCancel }) {
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
        <h2>{title}</h2>

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
            {confirmLabel}
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
