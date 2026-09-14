import { ownPlayerLabel } from '../utils/followerHelpers';

export default function ChronologyRow({ entry, playersById, authorizedById, compact }) {
  const who = entry.side === 'own'
    ? ownPlayerLabel(playersById, authorizedById, entry.playerId)
    : `Rival #${entry.number}`;
  const label = {
    goal: 'Gol',
    miss: 'Fallo',
    save: 'Parada',
    recovery: 'Recuperación',
    exclusion: entry.disqualified ? 'Roja' : 'Exclusión',
    sevenMeter: '7 metros',
  }[entry.type];

  if (compact) {
    return (
      <p>
        {entry.minute}' {label}
        {entry.type === 'exclusion' && (
          <span className={`ref-card ref-card--${entry.disqualified ? 'red' : 'amber'}`} style={{ margin: '0 4px' }} />
        )}
        {' '}{who}
      </p>
    );
  }

  return (
    <p>
      Min. {entry.minute}' — {label}
      {entry.type === 'exclusion' && (
        <span className={`ref-card ref-card--${entry.disqualified ? 'red' : 'amber'}`} style={{ margin: '0 4px' }} />
      )}
      {' '}{who}
    </p>
  );
}
