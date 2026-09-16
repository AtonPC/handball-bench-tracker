export default function StatStepper({ icon, label, count, onInc, onDec, disabled, compact }) {
  return (
    <div className={`stat-stepper${compact ? ' stat-stepper--compact' : ''}`} aria-label={label}>
      {/* Sin onDec (p. ej. un contador agregado del rival sin corrección
          rápida propia) el botón "−" se deshabilita solo, en vez de quedar
          clicable sin hacer nada. */}
      <button className="stat-btn stat-minus" onClick={onDec} disabled={disabled || count === 0 || !onDec}>−</button>
      <div className="stat-display">
        <span className="stat-icon">{icon}</span>
        <span className="stat-count">{count}</span>
      </div>
      <button className="stat-btn stat-plus" onClick={onInc} disabled={disabled}>+</button>
    </div>
  );
}
