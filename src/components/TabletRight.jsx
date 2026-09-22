import { useState } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw, Square, Undo2 } from 'lucide-react';
import { periodClockDisplay } from '../utils/time';
import { teamInitials } from '../utils/teamColors';
import { timeoutDots, useClockControls } from '../hooks/useClockControls';
import BallIcon from './BallIcon';

// Columna derecha de la consola de tablet / PC (mockup aprobado, 2026-09-21).
// Pasivo a nosotros / al rival: evento de equipo (cuenta como pérdida del que lo sufre).
// Todo cabe sin scroll: conmutador Lanzamiento | Estadísticas, atajos
// (Partidos · Deshacer · Finalizar), cuadro del reloj, marcador con la pelota de
// posesión sobre el escudo, bolitas de tiempos muertos y, debajo, el Resumen, que es
// lo único que scrollea (dentro de su hueco).
//  - Reloj: con el partido PARADO, tocar la hora abre −1 min / +1 min / −10 s /
//    +10 s para corregirlo (a veces no se nota que estaba parado).
//  - Bolitas de tiempo muerto: pulsar la siguiente la marca y PARA el reloj; pulsar
//    la última quita el tiempo muerto (solo el del periodo en curso).
//  - Pelota: se toca el escudo del equipo que la tiene.
// 2026-09-22: la Cronología vivía aquí, en una pestaña junto a Resumen — en una tablet
// real, sin su propia barra de scroll, se desbordaba y se hacía una columna infinita en
// vez de quedarse dentro de su hueco (a diferencia del PC, donde no se notaba tanto). Se
// muda dentro de Estadísticas (LiveStats), que ya tiene su propio scroll acotado
// (.tc-center, con overflow-y:auto y min-height:0) — por ahora aquí solo queda Resumen.
export default function TabletRight({
  store, team, onBack, onFinish, onNeedLineup, center, onCenter, summaryNode, isRunning, onPassive, onFlash,
}) {
  const { clock, score, possession, ownTeamName, rivalName, rivalCrestUrl, isHome, alevinRules, lineups } = store.state;
  const ctl = useClockControls(store, { onNeedLineup, onFinish });
  const [editing, setEditing] = useState(false);
  const display = periodClockDisplay(clock.periodRemainingMs, clock.periodDurationMs);
  const paused = clock.status === 'paused';
  const canEdit = paused && !ctl.ended; // entre periodos no hay reloj que corregir
  const nextLineupChosen = !!lineups[clock.period + 1];

  // Escudos en el orden del marcador (el local a la izquierda).
  const sides = isHome ? ['own', 'rival'] : ['rival', 'own'];
  const info = {
    own: { name: ownTeamName, crest: team?.crestUrl, score: score.own, cls: 'own' },
    rival: { name: rivalName, crest: rivalCrestUrl, score: score.rival, cls: 'rival' },
  };

  // Los botones cambian LO QUE SE VE en el reloj: en cuenta atrás, «−10 s» resta al
  // número (pasa más tiempo de partido); en el tiempo extra, que sube, «+10 s» lo
  // suma. El almacén trabaja en tiempo jugado, de ahí el signo.
  function shiftDisplay(deltaShown) {
    store.adjustClock(clock.periodRemainingMs > 0 ? -deltaShown : deltaShown);
  }

  const dots = (teamKey) => timeoutDots(store, teamKey, ctl.longLabel, onFlash);

  const teamBlock = (k) => (
    <div key={k} className="tc-team">
      <button type="button" className={`tc-crest tc-crest--${info[k].cls}${possession === k ? ' tc-crest--ball' : ''}`} onClick={() => store.setPossession(k)} aria-pressed={possession === k} aria-label={`Posesión: ${info[k].name}`}>
        {info[k].crest ? <img src={info[k].crest} alt="" /> : teamInitials(info[k].name)}
        {possession === k && <span className="tc-ball"><BallIcon /></span>}
      </button>
      <span className="tc-tname">{info[k].name}</span>
    </div>
  );

  const StopOrResume = ctl.ended ? (
    <button type="button" className="tc-ibtn" onClick={store.togglePause} aria-label={`Reanudar ${ctl.shortLabel(clock.period)}`} title="Reanudar (si se terminó por error)">
      <RotateCcw size={17} />
    </button>
  ) : (
    <button type="button" className="tc-ibtn tc-ibtn--stop" onClick={ctl.isLastPeriod ? ctl.handleFinish : ctl.handleEndPeriod} disabled={ctl.idle} aria-label={ctl.stopLabel} title={ctl.stopLabel}>
      <Square size={16} fill="currentColor" />
    </button>
  );

  return (
    <aside className="tc-right">
      <div className="tc-seg" role="group" aria-label="Panel central">
        <button type="button" className={center === 'launch' ? 'on' : ''} onClick={() => onCenter('launch')}>Lanzamiento</button>
        <button type="button" className={center === 'stats' ? 'on' : ''} onClick={() => onCenter('stats')}>Estadísticas</button>
      </div>

      <div className="tc-toprow">
        <button type="button" className="tc-mini" onClick={onBack}><ArrowLeft size={14} /> Partidos</button>
        <button type="button" className="tc-mini" onClick={ctl.handleUndo} disabled={!store.canUndo}><Undo2 size={14} /> Deshacer</button>
        <button type="button" className="tc-mini tc-mini--finish" onClick={ctl.handleFinish}>Finalizar</button>
      </div>

      <div className="tc-clockbox">
        <div className="tc-crow">
          <span className="tc-pchip">{ctl.longLabel(ctl.ended ? clock.period + 1 : clock.period)}</span>
          <div className="tc-ctl">
            <button type="button" className={`tc-ibtn tc-ibtn--${ctl.playTone}`} onClick={ctl.onPlay} aria-label={ctl.playLabel} title={ctl.playLabel}>
              {ctl.running ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            {StopOrResume}
          </div>
        </div>
        <div className="tc-crow">
          <button
            type="button"
            className={`tc-clock${canEdit ? ' tc-clock--edit' : ''}`}
            disabled={!canEdit}
            onClick={() => setEditing((v) => !v)}
            aria-label="Corregir el reloj"
          >
            {display.main}
            {display.extra && (
              <span className="tc-extra" title="Tiempo añadido">
                <span className="tc-extra-l">Extra<br />time</span>
                <span className="tc-extra-v">{display.extra}</span>
              </span>
            )}
          </button>
          {ctl.idle && <span className="tc-hint">Pulsa ▶ para iniciar</span>}
          {paused && !ctl.ended && <span className="tc-hint tc-hint--warn">Parado: toca la hora para corregirla</span>}
        </div>
        {canEdit && editing && (
          <div className="tc-edit">
            {[[-60000, '−1 min'], [60000, '+1 min'], [-10000, '−10 s'], [10000, '+10 s']].map(([d, l]) => (
              <button key={l} type="button" onClick={() => shiftDisplay(d)}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {ctl.ended && (
        <div className="tc-endp">
          <p>Fin del {ctl.longLabel(clock.period)}</p>
          {alevinRules && (
            <button type="button" className={`tc-endbtn${nextLineupChosen ? ' tc-endbtn--ok' : ''}`} onClick={onNeedLineup}>
              {nextLineupChosen ? `Equipo titular del ${ctl.shortLabel(clock.period + 1)} elegido · revisar` : `Introduce el equipo titular del ${ctl.longLabel(clock.period + 1)}`}
            </button>
          )}
          <small>Ya puedes hacer cambios (botón CAMBIO). El ▶ inicia el {ctl.longLabel(clock.period + 1)}.</small>
        </div>
      )}

      <div className="tc-score">
        {teamBlock(sides[0])}
        <div className="tc-nums">
          <span className={`tc-num tc-num--${info[sides[0]].cls}`}>{info[sides[0]].score}</span>
          <span className="tc-sep">–</span>
          <span className={`tc-num tc-num--${info[sides[1]].cls}`}>{info[sides[1]].score}</span>
        </div>
        {teamBlock(sides[1])}
      </div>

      <div className="tc-tm">
        {sides.map((k, i) => (
          <div key={k} className={`tc-tmgroup${i === 1 ? ' tc-tmgroup--right' : ''}`}>
            {i === 0 && <span>T.M.</span>}
            {dots(k).map((d, j) => (
              <button key={j} type="button" className={`tc-dot${d.on ? ' tc-dot--on' : ''}`} onClick={d.onClick} aria-label={d.label}><i /></button>
            ))}
            {i === 1 && <span>T.M.</span>}
          </div>
        ))}
      </div>

      <div className="tc-pas">
        {/* El pasivo se pita al equipo que tiene la pelota: si se sabe quién la tiene, solo a ese. */}
        <button type="button" disabled={!isRunning || (!!possession && possession !== 'own')} title="Solo cuando tenemos la pelota" onClick={() => onPassive('own')}>Pasivo a nosotros</button>
        <button type="button" disabled={!isRunning || (!!possession && possession !== 'rival')} title="Solo cuando el rival tiene la pelota" onClick={() => onPassive('rival')}>Pasivo al rival</button>
      </div>

      <h3 className="tc-h">Resumen</h3>
      <div className="tc-tabbody">{summaryNode}</div>
    </aside>
  );
}
