import { useState } from 'react';
import ShotZoneDiagram from './ShotZoneDiagram';
import { missingZoneWarning } from '../shotZones';

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

// Gol o fallo del rival — mismo teclado de dorsal + mismo diagrama que
// ShotDetailModal usa para los propios, con showOut solo en un Fallo (un
// gol, por definición, entró). Antes esto era RivalGoalModal, solo para
// goles; ahora también registra un fallo rival (tiró fuera, sin que
// parásemos nada) — necesario para que "Tiros del rival" sea un dato real.
export default function RivalShotModal({ kind = 'goal', onConfirm, onCancel }) {
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
    const warning = missingZoneWarning(shotZone, goalZone);
    if (warning && !confirm(warning)) return;
    onConfirm({ number: Number(number), shotZone, goalZone });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal rival-goal-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{kind === 'goal' ? 'Gol rival' : 'Fallo rival'} — ¿qué dorsal ha {kind === 'goal' ? 'marcado' : 'fallado'}?</h2>

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
          <button className="btn btn-clock btn-start" disabled={!number} onClick={handleConfirm}>
            {kind === 'goal' ? 'REGISTRAR GOL' : 'REGISTRAR FALLO'}
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
