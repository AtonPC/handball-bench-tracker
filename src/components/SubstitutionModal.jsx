import { formatClock } from '../utils/time';

export default function SubstitutionModal({ outPlayer, benchPlayers, disqualifiedPlayers, onSelect, onCancel, forced }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {forced ? 'Roja — ' : 'Cambio por '}
          #{outPlayer.number} {outPlayer.name}
        </h2>
        <p className="modal-hint">
          {forced ? 'Elige quién entra en su lugar' : 'Selecciona el jugador entrante del banquillo'}
        </p>
        <div className="bench-list">
          {benchPlayers.length === 0 && <p className="modal-hint">No hay jugadores en el banquillo.</p>}
          {benchPlayers.map((p) => (
            <button key={p.id} className="bench-option" onClick={() => onSelect(p.id)}>
              <span className="bench-number">#{p.number}</span>
              <span className="bench-name">{p.name}</span>
              <span className="bench-stats">
                G:{p.goals} · F:{p.shots} · Excl:{p.exclusionsCount || 0} · {formatClock(p.accumulatedMs)}
              </span>
            </button>
          ))}
          {disqualifiedPlayers?.map((p) => (
            <div key={p.id} className="bench-option bench-option--disabled" aria-disabled="true">
              <span className="bench-number">#{p.number}</span>
              <span className="bench-name">{p.name}</span>
              <span className="bench-stats">Roja — no puede entrar</span>
            </div>
          ))}
        </div>
        <button className="modal-cancel" onClick={onCancel}>
          {forced ? 'Decidir más tarde' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}
