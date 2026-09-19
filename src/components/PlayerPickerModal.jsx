// Lista de jugadores (dorsal + nombre) para elegir a quién se anota una
// acción en la vista reducida — sustituye a teclear el dorsal, que solo se
// sigue haciendo con el rival. `disabledReason(p)` devuelve un texto si ese
// jugador no puede recibir la acción (p. ej. "Ya tiene amarilla").
export default function PlayerPickerModal({ title, hint, players, disabledReason, onSelect, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {hint && <p className="modal-hint">{hint}</p>}
        {players.length === 0 && <p className="modal-hint">No hay nadie disponible en pista para esta acción.</p>}
        <div className="picker-grid">
          {players.map((p) => {
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
        <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
