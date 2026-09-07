import StatStepper from './StatStepper';

export default function RivalPanel({ rivalGoals, rivalShots, onGoal, onShot, onOpenGoalDetail }) {
  return (
    <div className="rival-panel">
      <span className="rival-panel-label">Equipo rival</span>
      <div className="stepper-group">
        <span className="stepper-caption">Goles</span>
        <StatStepper icon="GOL" label="Goles rival" count={rivalGoals} onInc={onOpenGoalDetail} onDec={() => onGoal(-1)} />
      </div>
      <div className="stepper-group">
        <span className="stepper-caption">Tiros</span>
        <StatStepper icon="TIRO" label="Tiros rival" count={rivalShots} onInc={() => onShot(1)} onDec={() => onShot(-1)} />
      </div>
    </div>
  );
}
