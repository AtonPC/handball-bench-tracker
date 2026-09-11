import { useEffect } from 'react';

const CONFETTI_PIECES = Array.from({ length: 16 }, (_, i) => i);

// Aviso de gol para la vista de Seguidor. Dos variantes bien separadas para
// que nunca se mezclen datos de un equipo con el aspecto del otro:
// - "own" (gol propio): escudo y color del propio equipo, confeti, texto
//   animado, foto/dorsal/nombre de quien marca (respeta imageAuthorized).
// - "rival" (gol rival): escudo y color del rival, sin confeti ni
//   animaciones, solo el dorsal (el rival nunca tiene nombre en el sistema).
// Ambas muestran minuto y resultado. Se autodestruye sola.
export default function GoalCelebration({
  variant = 'own',
  crestUrl,
  goalPhrase,
  player,
  playerAuthorized,
  minute,
  leftName,
  rightName,
  leftScore,
  rightScore,
  onDone,
}) {
  const isRival = variant === 'rival';

  useEffect(() => {
    const timer = setTimeout(onDone, isRival ? 3000 : 4200);
    return () => clearTimeout(timer);
  }, [onDone, isRival]);

  const showPlayerName = !isRival && playerAuthorized !== false;

  return (
    <div className={`goal-celebration${isRival ? ' goal-celebration--rival' : ''}`} onClick={onDone}>
      {!isRival && (
        <div className="goal-celebration-confetti">
          {CONFETTI_PIECES.map((i) => (
            <span key={i} className="confetti-piece" />
          ))}
        </div>
      )}
      <div className="goal-celebration-body">
        {crestUrl && <img src={crestUrl} alt="" className="goal-celebration-crest" />}
        <span className="goal-celebration-text">{isRival ? 'GOL RIVAL' : '¡GOL!'}</span>
        {!isRival && goalPhrase && <span className="goal-celebration-phrase">{goalPhrase}</span>}
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
        {minute != null && <span className="goal-celebration-minute">Min. {minute}'</span>}
        {leftScore != null && rightScore != null && (
          <div className="goal-celebration-score">
            <span>{leftName}</span>
            <span className="goal-celebration-score-value">{leftScore} - {rightScore}</span>
            <span>{rightName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
