import { periodLongLabel, periodShortLabel } from '../utils/periods';

// Lógica de los controles del reloj (▶/⏸, ■, ↺, DESHACER, FINALIZAR), compartida
// por la cabecera de móvil (MatchHeader) y la columna derecha de tablet
// (TabletRight): las dos hacen exactamente lo mismo con los mismos avisos.
//  - ▶ / ⏸: iniciar el primer periodo, pausar, reanudar — y, tras terminar un
//    periodo, iniciar el siguiente. Con las reglas de Alevín hay que PASAR por el
//    equipo titular antes: si aún no se ha elegido, ▶ abre el diálogo en vez de
//    iniciar (y el store tampoco deja iniciar sin él). Repetir jugadores solo
//    avisa; los cambios no tienen restricción.
//  - «Pausar» es solo para paradas del árbitro durante el juego; nunca termina el
//    periodo por sí sola. Terminar el periodo (■ / FIN) es una acción aparte, con
//    aviso. En el último periodo no hay «FIN»: se termina con FINALIZAR.
//  - ↺ (solo tras terminar un periodo): volver a poner en marcha el que se acaba
//    de terminar, por si fue un error.
// Bolitas de tiempos muertos de un equipo (tablet y móvil): siempre hay una más que
// las marcadas (mínimo 3). Pulsar la siguiente la marca y PARA el reloj si corría;
// pulsar la última quita el tiempo muerto (solo el del periodo en curso).
export function timeoutDots(store, teamKey, longLabel, onFlash) {
  const { clock, timeouts } = store.state;
  const sum = (map) => Object.values(map || {}).reduce((s, n) => s + (n || 0), 0);
  const total = sum(timeouts[teamKey]);
  const current = timeouts[teamKey]?.[clock.period] || 0;
  return Array.from({ length: Math.max(3, total + 1) }, (_, i) => ({
    on: i < total,
    onClick: () => {
      if (i === total) {
        store.timeout(teamKey, 1);
        onFlash?.(`Tiempo muerto · ${teamKey === 'own' ? 'Nos' : 'Rival'}`, `cuenta en ${longLabel(clock.period)}`);
        if (clock.status === 'running') store.togglePause(); // el tiempo muerto para el reloj
      } else if (i === total - 1 && current > 0) {
        store.timeout(teamKey, -1);
      }
    },
    label: `Tiempo muerto ${teamKey === 'own' ? 'nuestro' : 'del rival'} ${i + 1}${i < total ? ' (marcado; pulsa el último para quitarlo)' : ''}`,
  }));
}

export function useClockControls(store, { onNeedLineup, onFinish }) {
  const { clock } = store.state;
  const { periodCount, periodEnded } = clock;
  const isLastPeriod = clock.period >= periodCount;
  const shortLabel = (p) => periodShortLabel(p, periodCount);
  const longLabel = (p) => periodLongLabel(p, periodCount);

  async function handleUndo() {
    const result = await store.undo();
    if (result && !result.ok && result.reason === 'clock') {
      alert('No se puede deshacer esta acción porque el reloj ha cambiado desde entonces (pausa, reanudación u otro periodo): los minutos de los jugadores saldrían mal. Corrígela a mano — por ejemplo, con el cambio inverso.');
    }
  }

  function handleStartNext() {
    const { alevinRules, lineups } = store.state;
    if (alevinRules && !lineups[clock.period + 1]) {
      onNeedLineup();
      return;
    }
    store.startNextPeriod();
  }

  function handleEndPeriod() {
    const ok = confirm(`¿Terminar el periodo «${longLabel(clock.period)}»? El cronómetro se detiene; podréis iniciar «${longLabel(clock.period + 1)}» cuando estéis listos.`);
    if (ok) store.endPeriod();
  }

  function handleFinish() {
    const message = isLastPeriod
      ? `¿Terminar «${longLabel(clock.period)}» y dar el partido por finalizado? Si te equivocas, podrás reabrirlo desde las estadísticas del partido (botón REABRIR PARTIDO).`
      : '¿Finalizar el partido ahora, sin jugar el resto de periodos? Si te equivocas, podrás reabrirlo desde las estadísticas del partido (botón REABRIR PARTIDO).';
    if (confirm(message)) onFinish();
  }

  const idle = clock.status === 'idle';
  const running = clock.status === 'running';
  const ended = clock.status === 'paused' && periodEnded && !isLastPeriod;

  let playLabel = 'Reanudar';
  let playTone = 'start';
  let onPlay = store.togglePause;
  if (idle) {
    playLabel = `Iniciar ${shortLabel(1)}`;
    onPlay = store.startPeriod1;
  } else if (running) {
    playLabel = 'Pausar';
    playTone = 'pause';
  } else if (ended) {
    const lineupPending = store.state.alevinRules && !store.state.lineups[clock.period + 1];
    playLabel = lineupPending
      ? `Primero elige el equipo titular del ${shortLabel(clock.period + 1)}`
      : `Iniciar ${shortLabel(clock.period + 1)}`;
    onPlay = handleStartNext;
  }
  const stopLabel = isLastPeriod ? `Terminar ${shortLabel(clock.period)} y finalizar el partido` : `Terminar ${shortLabel(clock.period)} (FIN)`;

  return {
    clock, periodCount, isLastPeriod, shortLabel, longLabel,
    idle, running, ended, playLabel, playTone, onPlay, stopLabel,
    handleUndo, handleEndPeriod, handleFinish,
  };
}
