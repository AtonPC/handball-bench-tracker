import { useState } from 'react';

// Lista de jugadores (dorsal + nombre) para elegir a quién se anota una
// acción — sustituye a teclear el dorsal, que solo se sigue haciendo con el
// rival. `disabledReason(p)` devuelve un texto si ese jugador no puede recibir
// la acción (p. ej. "Ya tiene amarilla").
// Opcionales:
//  - `extraPlayers` (+ `extraLabel`): una segunda lista plegada tras un botón
//    "Ver suplentes (N)" — para cuando el jugador buscado puede no estar en
//    pista (p. ej. quien hizo la falta de un 7m y ya ha sido sustituido).
//  - `onSkip` (+ `skipLabel`): botón para seguir sin elegir a nadie. Con
//    `cancelLabel={null}` se oculta el botón Cancelar (cuando cerrar el
//    diálogo equivale a omitir, y no hay nada que cancelar).
export default function PlayerPickerModal({
  title, hint, players, extraPlayers = [], extraLabel = 'Suplentes', disabledReason,
  onSelect, onSkip, skipLabel = 'Omitir', cancelLabel = 'Cancelar', onCancel,
}) {
  const [showExtra, setShowExtra] = useState(false);

  function renderOptions(list) {
    return (
      <div className="picker-grid">
        {list.map((p) => {
          const reason = disabledReason ? disabledReason(p) : null;
          return (
            <button
              key={p.id}
              type="button"
              className={`picker-option${p.isGK ? ' picker-option--gk' : ''}`}
              disabled={!!reason}
              onClick={() => onSelect(p.id)}
            >
              <span className="picker-number">{p.number}</span>
              <span className="picker-name">{p.name}{p.isGK ? ' (P)' : ''}</span>
              {reason && <span className="picker-reason">{reason}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {hint && <p className="modal-hint">{hint}</p>}
        {players.length === 0 && <p className="modal-hint">No hay nadie disponible en pista para esta acción.</p>}
        {renderOptions(players)}

        {extraPlayers.length > 0 && (showExtra ? (
          <>
            <p className="modal-hint">{extraLabel}</p>
            {renderOptions(extraPlayers)}
          </>
        ) : (
          <button type="button" className="btn btn-timeout" onClick={() => setShowExtra(true)}>
            Ver {extraLabel.toLowerCase()} ({extraPlayers.length})
          </button>
        ))}

        {onSkip && (
          <button type="button" className="btn btn-timeout" onClick={onSkip}>{skipLabel}</button>
        )}
        {cancelLabel && <button className="modal-cancel" onClick={onCancel}>{cancelLabel}</button>}
      </div>
    </div>
  );
}
