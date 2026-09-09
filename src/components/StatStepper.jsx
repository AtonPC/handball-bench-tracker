export default function StatStepper({ icon, label, count, onInc, onDec, disabled }) {
  return (
    <div className="stat-stepper" aria-label={label}>
      <button className="stat-btn stat-minus" onClick={onDec} disabled={disabled || count === 0}>−</button>
      <div className="stat-display">
        <span className="stat-icon">{icon}</span>
        <span className="stat-count">{count}</span>
      </div>
      <button className="stat-btn stat-plus" onClick={onInc} disabled={disabled}>+</button>
    </div>
  );
}
