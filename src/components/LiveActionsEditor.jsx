import { useMemo } from 'react';
import { useRecoveryEvents } from '../hooks/useRecoveryEvents';
import { useExclusionEvents } from '../hooks/useExclusionEvents';
import { useYellowCardEvents } from '../hooks/useYellowCardEvents';
import { useRivalSevenMeters } from '../hooks/useRivalSevenMeters';
import { useMatchEditor } from '../hooks/useMatchEditor';
import MatchActionsEditor from './MatchActionsEditor';

// Corregir CUALQUIER acción ya anotada, no solo deshacer la última — el mismo editor
// de "Acciones del partido" que ya existía para un partido FINALIZADO (ver
// FinishedMatchEditor.jsx), ahora también accesible en directo desde el botón
// «Deshacer» de la consola de tablet y de móvil (2026-09-22): antes «Deshacer» solo
// rehacía la última acción a ciegas; ahora enseña la lista entera y se puede
// seleccionar y editar cualquiera (goles, robos, pérdidas, paradas, 7 metros,
// asistencias, exclusiones, amarillas...), con el mismo ajuste automático de
// cronología, zonas, estadísticas del jugador y marcador que ya tenía el editor de
// partido finalizado (ver utils/actionEditing.js) — no hace falta duplicar esa lógica.
// `recoveryEvents`/`exclusionEvents`/`yellowCardEvents`/`rivalSevenMeters` se piden
// aquí (no en BenchConsole, que ya tiene el resto) para no suscribirse a esas cuatro
// colecciones de Firestore durante todo el partido si nunca se abre este editor —
// mismo motivo por el que ConsoleChronology (ahora en LiveStats) hace lo mismo.
export default function LiveActionsEditor({
  matchId, state, shotEvents = [], saveEvents = [], rivalGoals = [], rivalMisses = [], rivalExclusions = [], rivalYellowCards = [],
}) {
  const recoveryEvents = useRecoveryEvents(matchId);
  const exclusionEvents = useExclusionEvents(matchId);
  const yellowCardEvents = useYellowCardEvents(matchId);
  const rivalSevenMeters = useRivalSevenMeters(matchId);
  const { applyPlan } = useMatchEditor(matchId);

  const players = useMemo(
    () => Object.values(state.players).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [state.players]
  );
  const lists = {
    shotEvents, saveEvents, recoveryEvents, exclusionEvents, yellowCardEvents,
    rivalGoals, rivalMisses, rivalExclusions, rivalSevenMeters, rivalYellowCards,
  };

  return <MatchActionsEditor state={state} players={players} lists={lists} applyPlan={applyPlan} />;
}
