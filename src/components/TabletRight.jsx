import { useState } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw, Square, Undo2 } from 'lucide-react';
import { periodClockDisplay } from '../utils/time';
import { teamInitials } from '../utils/teamColors';
import { useClockControls } from '../hooks/useClockControls';

// Columna derecha de la consola de tablet / PC (mockup aprobado, 2026-09-21).
// Todo cabe sin scroll: conmutador Lanzamiento | Estadísticas, atajos
// (Partidos · Deshacer · Finalizar), cuadro del reloj, marcador con la pelota de
// posesión sobre el escudo, bolitas de tiempos muertos y, debajo, las pestañas
// Resumen / Cronología, que son lo único que scrollea (dentro de su hueco).
//  - Reloj: con el partido PARADO, tocar la hora abre −1 min / +1 min / −10 s /
//    +10 s para corregirlo (a veces no se nota que estaba parado).
//  - Bolitas de tiempo muerto: pulsar la siguiente la marca y PARA el reloj; pulsar
//    la última quita el tiempo muerto (solo el del periodo en curso).
//  - Pelota: se toca el escudo del equipo que la tiene.
function BallIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#16213e" strokeWidth="1.3" />
      <path d="M12 7.4 16.4 10.6 14.7 15.8 9.3 15.8 7.6 10.6Z" fill="#16213e" />
      <path d="M12 7.4V1M16.4 10.6 22.5 8.6M14.7 15.8 18.5 20.9M9.3 15.8 5.5 20.9M7.6 10.6 1.5 8.6" fill="none" stroke="#16213e" strokeWidth="1.1" strokeLinecap="round" />
      <path fill="#16213e" d="M16.12 1.8 16.47 5.85 20.43 4.93A11 11 0 0 0 16.12 1.8ZM22.97 12.77 19.23 14.35 21.33 17.83A11 11 0 0 0 22.97 12.77ZM14.66 22.67 12 19.6 9.34 22.67A11 11 0 0 0 14.66 22.67ZM2.67 17.83 4.77 14.35 1.03 12.77A11 11 0 0 0 2.67 17.83ZM3.57 4.93 7.53 5.85 7.88 1.8A11 11 0 0 0 3.57 4.93Z" />
    </svg>
  );
}

const sum = (map) => Object.values(map || {}).reduce((s, n) => s + (n || 0), 0);

export default function TabletRight({
  store, team, onBack, onFinish, onNeedLineup, center, onCenter, rightTab, onRightTab, summaryNode, chronologyNode,
}) {
  const { clock, score, timeouts, possession, ownTeamName, rivalName, rivalCrestUrl, isHome, alevinRules, lineups } = store.state;
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

  function dots(teamKey) {
    const total = sum(timeouts[teamKey]);
    const current = timeouts[teamKey]?.[clock.period] || 0;
    return Array.from({ length: Math.max(3, total + 1) }, (_, i) => ({
      on: i < total,
      onClick: () => {
        if (i === total) {
          store.timeout(teamKey, 1);
          if (clock.status === 'running') store.togglePause(); // el tiempo muerto para el reloj
        } else if (i === total - 1 && current > 0) {
          store.timeout(teamKey, -1);
        }
      },
      label: `Tiempo muerto ${teamKey === 'own' ? 'nuestro' : 'del rival'} ${i + 1}${i < total ? ' (marcado; pulsa el último para quitarlo)' : ''}`,
    }));
  }

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

      <div className="tc-tabs" role="tablist">
        <button type="button" className={rightTab === 'resumen' ? 'on' : ''} onClick={() => onRightTab('resumen')}>Resumen</button>
        <button type="button" className={rightTab === 'crono' ? 'on' : ''} onClick={() => onRightTab('crono')}>Cronología</button>
      </div>
      <div className="tc-tabbody">{rightTab === 'resumen' ? summaryNode : chronologyNode}</div>
    </aside>
  );
}
