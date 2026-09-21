import { ownPlayerLabel } from '../utils/followerHelpers';
import EventIcon from './EventIcon';

// Icono + texto de un suceso — se reutiliza igual en modo compacto (el
// ticker del marcador en directo) y en la lista completa, solo cambia el
// contenedor alrededor.
function eventIconType(entry) {
  if (entry.type === 'miss') return entry.missKind === 'saved' ? 'miss-saved' : 'miss-out'; // el palo usa el icono de fuera
  if (entry.type === 'exclusion') return entry.disqualified ? 'card-red' : 'twoFingers';
  if (entry.type === 'yellowCard') return 'card-yellow';
  if (entry.type === 'save') return 'save';
  if (entry.type === 'goal') return 'goal';
  if (entry.type === 'recovery') return 'recovery';
  if (entry.type === 'sevenMeter') return 'sevenMeter';
  return null;
}

function eventLabel(entry) {
  if (entry.type === 'miss') {
    if (entry.missKind === 'saved') return 'Fallo — parada rival';
    if (entry.missKind === 'out') return 'Fallo — fuera';
    if (entry.missKind === 'post') return 'Fallo — palo';
    return 'Fallo';
  }
  return {
    goal: 'Gol',
    save: 'Parada',
    recovery: 'Recuperación',
    exclusion: entry.disqualified ? 'Roja' : 'Exclusión',
    yellowCard: 'Tarjeta amarilla',
    sevenMeter: '7 metros provocados',
  }[entry.type];
}

// `anonymize` (Seguidor Estándar): un suceso de NUESTRO equipo no dice qué
// jugador fue, salvo los goles (el goleador es lo que se celebra en directo).
// Los del rival siguen con su dorsal: no son jugadores nuestros.
export default function ChronologyRow({ entry, playersById, authorizedById, compact, anonymize = false }) {
  const hideName = anonymize && entry.side === 'own' && entry.type !== 'goal';
  const who = hideName
    ? null
    : entry.side === 'own'
      ? ownPlayerLabel(playersById, authorizedById, entry.playerId)
      : (entry.number != null ? `Rival #${entry.number}` : 'Rival');
  const label = eventLabel(entry);
  const iconType = eventIconType(entry);

  if (compact) {
    return (
      <p className="chrono-compact-row">
        <span className="chrono-compact-minute">{entry.minute}'</span>
        {iconType && <span className="chrono-compact-icon"><EventIcon type={iconType} size={13} /></span>}
        <span>{who ? `${label} — ${who}` : label}</span>
      </p>
    );
  }

  const isOwn = entry.side === 'own';
  return (
    <div className={`chrono-row${isOwn ? '' : ' chrono-row--rival'}`}>
      <div className="chrono-row-side">
        {isOwn && iconType && (
          <>
            <span className="chrono-row-icon"><EventIcon type={iconType} /></span>
            <span className="chrono-row-text">
              {who && <span className="chrono-row-who">{who}</span>}
              <span className="chrono-row-label">{label}</span>
            </span>
          </>
        )}
      </div>
      <div className="chrono-row-mid">
        <span className="chrono-row-minute">{entry.minute}'</span>
        {entry.ownScore != null && <span className="chrono-row-score">{entry.ownScore}-{entry.rivalScore}</span>}
      </div>
      <div className="chrono-row-side chrono-row-side--rival">
        {!isOwn && iconType && (
          <>
            <span className="chrono-row-text chrono-row-text--rival">
              <span className="chrono-row-who">{who}</span>
              <span className="chrono-row-label">{label}</span>
            </span>
            <span className="chrono-row-icon"><EventIcon type={iconType} /></span>
          </>
        )}
      </div>
    </div>
  );
}
