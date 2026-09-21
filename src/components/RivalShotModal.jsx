import { useState } from 'react';
import ShotZoneDiagram from './ShotZoneDiagram';
import { missKindOf, missingZoneWarning } from '../shotZones';

// Teclado en DOS filas de 6 (1-6 / 7-9 0 C ⌫) con el dorsal a la izquierda, en
// vez de 4 filas de 3 con el dorsal encima: así el dorsal, el teclado y el
// diagrama de zonas caben juntos en la pantalla de un móvil, sin scroll.
const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'C', '⌫'];

// UN solo interfaz para todo lo que anota un tiro del rival (2026-09-19):
// dorsal + de dónde vino + por dónde fue. Cambia solo qué se anota al
// confirmar, según `kind`:
//  - 'goal' : gol rival (dorsal obligatorio; las zonas, opcionales).
//  - 'miss' : botón FALLO del rival. Todas las zonas de portería, las 9 de
//    dentro y las 3 de "Fuera". Zona de dentro = lo paró nuestro portero:
//    se anota a la vez su Parada y el fallo rival. "Fuera" (o sin zona) =
//    solo fallo del rival, nada para nuestro equipo.
//  - 'save' : botón PARADA de nuestro portero (`playerName`). Solo las 9
//    zonas de dentro: una parada, por definición, se queda dentro del marco.
//    Anota la Parada y, a la vez, el fallo rival emparejado.
// El dorsal del que tiró es opcional en 'miss' y 'save' (si no da tiempo a
// verlo no bloquea); solo un gol lo exige. `saverName` (solo 'miss') es el
// portero al que se le anotaría la parada, si ya se sabe cuál es.
export default function RivalShotModal({ kind = 'goal', playerName, saverName, onConfirm, onCancel }) {
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

  const numberRequired = kind === 'goal';

  function handleConfirm() {
    if (numberRequired && !number) return;
    const warning = missingZoneWarning(shotZone, goalZone);
    if (warning && !confirm(warning)) return;
    onConfirm({ number: number ? Number(number) : null, shotZone, goalZone });
  }

  const title = kind === 'goal'
    ? 'Gol rival'
    : kind === 'miss'
      ? 'Fallo rival'
      : `Parada — ${playerName}`;

  const hint = kind === 'goal'
    ? 'Dorsal que marcó (obligatorio) · de dónde vino y por dónde entró (opcional)'
    : kind === 'miss'
      ? 'Dorsal (opcional) · de dónde vino y por dónde fue: zona de portería = la paró nuestro portero; "Fuera" = solo fallo'
      : 'Dorsal que tiró (opcional) · de dónde vino y dónde paró el balón';

  // Lo que va a pasar al confirmar, con la zona elegida: para que en un
  // Fallo nadie se lleve una parada (o se quede sin ella) sin saberlo.
  let effect = null;
  if (kind === 'miss') {
    const saved = missKindOf(goalZone) === 'saved';
    if (saved) {
      effect = saverName
        ? `Lo paró ${saverName}: se le anota una parada y cuenta como fallo del rival.`
        : 'Lo paró nuestro portero: se anotará una parada y un fallo del rival.';
    } else if (goalZone) {
      effect = 'Se fue fuera: solo cuenta como fallo del rival, sin parada para nosotros.';
    } else {
      effect = 'Sin zona de portería: solo cuenta como fallo del rival. Marca por dónde fue para anotar también la parada.';
    }
  } else if (kind === 'save') {
    effect = 'Se anota la parada y, a la vez, un fallo del rival.';
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal rival-goal-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>

        <div className="keypad-compact">
          <div className="keypad-compact-display" aria-label="Dorsal rival">{number || '—'}</div>
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

        <p className="modal-hint rival-modal-hint">{hint}</p>
        <ShotZoneDiagram
          showGoal
          showOut={kind === 'miss'}
          showOrigin
          shotZone={shotZone}
          onShotZone={setShotZone}
          goalZone={goalZone}
          onGoalZone={setGoalZone}
        />
        {effect && <p className="modal-hint rival-modal-hint rival-shot-effect">{effect}</p>}

        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" disabled={numberRequired && !number} onClick={handleConfirm}>
            {kind === 'goal' ? 'REGISTRAR GOL' : kind === 'miss' ? 'REGISTRAR FALLO' : 'REGISTRAR PARADA'}
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
