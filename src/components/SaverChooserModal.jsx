// Un Fallo rival por parada necesita saber a qué portero acreditarle la
// parada. Normalmente es el único portero en pista y se elige solo; este
// selector solo sale cuando no está claro (ninguno o más de uno en pista,
// p. ej. el portero está excluido). Se puede registrar el tiro sin parada.
export default function SaverChooserModal({ candidates, onSelect, onWithoutSave, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>¿Qué portero la paró?</h2>
        <p className="modal-hint">
          {candidates.length === 0
            ? 'No hay ningún portero en pista ahora mismo.'
            : 'Hay más de un portero en pista.'}{' '}
          Elige a quién se le anota la parada.
        </p>
        <div className="bench-list">
          {candidates.map((p) => (
            <button key={p.id} className="bench-option" onClick={() => onSelect(p.id)}>
              <span className="bench-number">#{p.number}</span>
              <span className="bench-name">{p.name}{p.isGK ? ' (P)' : ''}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-timeout" onClick={onWithoutSave} style={{ marginTop: 'var(--space-3)' }}>
          Registrar sin parada (solo fallo del rival)
        </button>
        <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
