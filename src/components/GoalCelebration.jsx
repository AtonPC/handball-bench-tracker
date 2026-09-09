import { useEffect } from 'react';

const CONFETTI_PIECES = Array.from({ length: 16 }, (_, i) => i);

// Aviso de gol para la vista de Seguidor: escudo del equipo + confeti en CSS
// puro (sin librería nueva) + frase de gol si el equipo la tiene configurada.
// Se autodestruye a los pocos segundos.
export default function GoalCelebration({ crestUrl, goalPhrase, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="goal-celebration" onClick={onDone}>
      <div className="goal-celebration-confetti">
        {CONFETTI_PIECES.map((i) => (
          <span key={i} className="confetti-piece" />
        ))}
      </div>
      <div className="goal-celebration-body">
        {crestUrl && <img src={crestUrl} alt="" className="goal-celebration-crest" />}
        <span className="goal-celebration-text">¡GOL!</span>
        {goalPhrase && <span className="goal-celebration-phrase">{goalPhrase}</span>}
      </div>
    </div>
  );
}
