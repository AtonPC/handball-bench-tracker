import { useEffect } from 'react';

const CONFETTI_PIECES = Array.from({ length: 16 }, (_, i) => i);

// Aviso de gol para la vista de Seguidor: escudo del equipo (grande) +
// confeti en CSS puro (sin librería nueva) + frase de gol si el equipo la
// tiene configurada + foto/dorsal/nombre de quien ha marcado. Respeta
// imageAuthorized: si el jugador no tiene autorizada la imagen, no se
// muestra ni su foto ni su nombre, solo el dorsal. Se autodestruye sola.
export default function GoalCelebration({ crestUrl, goalPhrase, player, playerAuthorized, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 4200);
    return () => clearTimeout(timer);
  }, [onDone]);

  const showPlayerName = playerAuthorized !== false;

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
        {player && (
          <div className="goal-celebration-scorer">
            {showPlayerName && player.photoUrl && (
              <img src={player.photoUrl} alt="" className="goal-celebration-scorer-photo" />
            )}
            <span className="goal-celebration-scorer-name">
              #{player.number}{showPlayerName && player.name ? ` ${player.name}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
