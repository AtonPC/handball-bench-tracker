import { useMemo, useState } from 'react';
import { useRecoveryEvents } from '../hooks/useRecoveryEvents';
import { useExclusionEvents } from '../hooks/useExclusionEvents';
import { useYellowCardEvents } from '../hooks/useYellowCardEvents';
import { useRivalSevenMeters } from '../hooks/useRivalSevenMeters';
import { useTeamActionEvents } from '../hooks/useTeamActionEvents';
import { useAssistEvents } from '../hooks/useAssistEvents';
import { buildChronology } from '../utils/followerHelpers';
import { periodLongLabel, withPeriodDividers } from '../utils/periods';
import ChronologyRow from './ChronologyRow';

// Pestaña "Cronología" de la consola en directo: todo lo que ha pasado en el
// partido, de lo más reciente a lo más antiguo, con el minuto de cada cosa y
// el marcador en ese momento — para consultar "¿qué pasó en el minuto X?" sin
// salir de la consola. Es la MISMA cronología que ve el Seguidor
// (buildChronology + ChronologyRow), pero con todos los nombres (aquí es
// staff). Los detalles que la consola ya tiene cargados llegan por props; los
// que solo hacen falta aquí (recuperaciones, exclusiones y amarillas propias,
// 7 metros rivales) se piden al abrir la pestaña, no durante todo el partido.
export default function ConsoleChronology({
  matchId, state, shotEvents, saveEvents, rivalGoals, rivalMisses, rivalExclusions, rivalYellowCards,
}) {
  const recoveryEvents = useRecoveryEvents(matchId);
  const exclusionEvents = useExclusionEvents(matchId);
  const yellowCardEvents = useYellowCardEvents(matchId);
  const rivalSevenMeters = useRivalSevenMeters(matchId);
  const teamActions = useTeamActionEvents(matchId);
  const assistEvents = useAssistEvents(matchId);
  const [minute, setMinute] = useState('');

  // ChronologyRow espera jugadores de la plantilla (displayName); aquí son
  // jugadores del partido, que guardan el nombre en `name`.
  const playersById = useMemo(
    () => Object.fromEntries(Object.values(state.players).map((p) => [p.id, { ...p, displayName: p.name }])),
    [state.players]
  );

  const chronology = useMemo(
    () => buildChronology({
      ownGoals: shotEvents.filter((e) => e.type === 'goal'),
      ownMisses: shotEvents.filter((e) => e.type === 'miss'),
      ownSaves: saveEvents,
      ownRecoveries: recoveryEvents,
      ownExclusions: exclusionEvents,
      ownYellowCards: yellowCardEvents,
      rivalGoals,
      rivalMisses,
      rivalExclusions,
      rivalSevenMeters,
      rivalYellowCards,
      teamActions,
      ownAssists: assistEvents,
    }),
    [shotEvents, saveEvents, recoveryEvents, exclusionEvents, yellowCardEvents, rivalGoals, rivalMisses, rivalExclusions, rivalSevenMeters, rivalYellowCards, teamActions, assistEvents]
  );

  const wanted = minute === '' ? null : Number(minute);
  const visible = wanted == null || Number.isNaN(wanted) ? chronology : chronology.filter((e) => e.minute === wanted);
  // Separadores de fin/inicio de cuarto o tiempo entre los sucesos (2026-09-23).
  const rows = useMemo(
    () => withPeriodDividers(visible, (e) => e.minute, state.clock.periodDurationMs, state.clock.periodCount),
    [visible, state.clock.periodDurationMs, state.clock.periodCount]
  );

  return (
    <div>
      <div className="chrono-filter">
        <input
          className="player-form-input player-form-input--number"
          type="number"
          min="1"
          inputMode="numeric"
          placeholder="Minuto"
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          aria-label="Filtrar por minuto"
        />
        {minute !== '' && (
          <button type="button" className="btn btn-timeout" onClick={() => setMinute('')}>Ver todo</button>
        )}
        <span className="modal-hint" style={{ margin: 0 }}>
          {chronology.length} suceso{chronology.length === 1 ? '' : 's'}
          {minute !== '' ? ` · ${visible.length} en el minuto ${minute}` : ''}
        </span>
      </div>

      <div className="chrono-team-banners">
        <div className="chrono-team-banner chrono-team-banner--own">{state.ownTeamName}</div>
        <div className="chrono-team-banner chrono-team-banner--rival">{state.rivalName}</div>
      </div>

      {visible.length === 0 ? (
        <p className="modal-hint">{chronology.length === 0 ? 'Todavía no ha pasado nada.' : `No hay nada anotado en el minuto ${minute}.`}</p>
      ) : (
        <div className="chrono-rows">
          {rows.map((row) => (row.divider ? (
            <div key={row.key} className="chrono-divider">
              <span>Fin {periodLongLabel(row.lo, state.clock.periodCount)} · Inicio {periodLongLabel(row.hi, state.clock.periodCount)}</span>
            </div>
          ) : (
            <ChronologyRow key={row.item.id} entry={row.item} playersById={playersById} authorizedById={{}} />
          )))}
        </div>
      )}
    </div>
  );
}
