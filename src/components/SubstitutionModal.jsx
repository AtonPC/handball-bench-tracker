export default function SubstitutionModal({ outPlayer, benchPlayers, onSelect, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cambio por #{outPlayer.number} {outPlayer.name}</h2>
        <p className="modal-hint">Selecciona el jugador entrante del banquillo</p>
        <div className="bench-list">
          {benchPlayers.length === 0 && <p className="modal-hint">No hay jugadores en el banquillo.</p>}
          {benchPlayers.map((p) => (
            <button key={p.id} className="bench-option" onClick={() => onSelect(p.id)}>
              <span className="bench-number">#{p.number}</span>
              <span className="bench-name">{p.name}</span>
            </button>
          ))}
        </div>
        <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
