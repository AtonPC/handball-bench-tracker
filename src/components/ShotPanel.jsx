import { useEffect, useRef, useState } from 'react';
import { Hand, ThumbsUp, X } from 'lucide-react';
import ShotBoard from './ShotBoard';
import { formatClock } from '../utils/time';

// LANZAMIENTO (2026-09-21, mockup aprobado por el usuario): UNA sola pantalla
// para anotar cualquier tiro, nuestro o del rival, en lugar de decidir antes
// si es gol, fallo o parada. Todo está a la vista a la vez y se elige en el
// orden que se quiera:
//  1. Quién lanza — OBLIGATORIO en los dos equipos (nuestro jugador, o el dorsal
//     rival con sus accesos directos y el teclado). Sin lanzador no se puede
//     registrar nada.
//  2. Portería y zona de tiro (ShotBoard): un cuadrante solo selecciona; un
//     «fuera» o un palo cierran el lanzamiento al instante como fallo.
//  3. PARADA o GOL (con un cuadrante elegido). Parada = la paró el portero del
//     otro equipo (fallo del que tira).
//  El interruptor «Contraataque» y los atajos «Gol/Fallo sin detalle» están
//  siempre a mano. Si la zona de origen es «7 metros», se pregunta quién
//  cometió la falta (opcional) ANTES de decidir si es gol o fallo.
// El panel no escribe nada: llama a `onSubmit` con el resultado y quien lo usa
// (BenchConsole) lo anota en el store.

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'C', '⌫'];
export function applyKey(value, key) {
  if (key === 'C') return '';
  if (key === '⌫') return value.slice(0, -1);
  return value.length < 2 ? value + key : value;
}

export function DorsalKeys({ onKey }) {
  return (
    <div className="shp-keys">
      {KEYS.map((k) => (
        <button key={k} type="button" onClick={() => onKey(k)} aria-label={k === '⌫' ? 'Borrar' : k === 'C' ? 'Limpiar' : `Dígito ${k}`}>{k}</button>
      ))}
    </div>
  );
}

// Accesos directos de dorsales rivales con la marca de sus sanciones.
export function DorsalChips({ shortcuts, statusOf, selected, onPick }) {
  return shortcuts.map((d) => {
    const st = statusOf(d.number);
    const cls = st.red ? ' shp-chip--red' : st.excludedMs ? ' shp-chip--excl' : st.yellow ? ' shp-chip--yellow' : '';
    const sub = st.red ? 'R' : st.excludedMs ? formatClock(st.excludedMs) : st.yellow ? 'A' : d.count > 0 ? `×${d.count}` : '';
    return (
      <button key={d.number} type="button" className={`shp-chip${cls}${selected === d.number ? ' shp-chip--sel' : ''}`} onClick={() => onPick(d.number)}>
        <span className="shp-chip-n">{d.number}</span>
        <span className="shp-chip-s">{sub}</span>
      </button>
    );
  });
}

// Extras de la consola de tablet: `bench` (rejilla de suplentes), `tagOf(p)` (marca de
// sanción {text, kind: 'excl'|'yellow'|'red'} junto al nombre), `marks` ({id: 'out'|'in'}
// en el modo cambio) y `canPick(p)` (por defecto, no los sancionados).
export function PlayerButtons({ players, selected, onPick, extra, wide, bench, tagOf, marks, canPick }) {
  return (
    <div className={`shp-players${wide ? ' shp-players--wide' : ''}${bench ? ' shp-players--bench' : ''}`}>
      {players.map((p) => {
        const off = p.excluded || p.disqualified;
        const tag = tagOf ? tagOf(p) : null;
        const mark = marks?.[p.id];
        return (
          <button
            key={p.id}
            type="button"
            className={`shp-player${p.isGK ? ' shp-player--gk' : ''}${selected === p.id ? ' shp-player--sel' : ''}${off ? ' shp-player--off' : ''}${tag ? ` shp-player--${tag.kind}` : ''}${mark ? ` shp-player--${mark}` : ''}`}
            disabled={canPick ? !canPick(p) : off}
            onClick={() => onPick(p.id)}
            aria-label={`Dorsal ${p.number} ${p.name}${tag ? (tag.kind === 'yellow' ? ' con amarilla' : tag.kind === 'red' ? ' expulsado' : tag.kind === 'exclcount' ? ' con exclusiones previas' : ' excluido') : ''}`}
          >
            <span className="shp-player-n">{p.number}</span>
            <span className="shp-player-name">{(p.name || '').split(' ')[0]}</span>
            {tag && <span className={`shp-player-tag shp-player-tag--${tag.kind}`}>{tag.text}</span>}
            {extra && <span className="shp-player-x">{extra(p)}</span>}
          </button>
        );
      })}
    </div>
  );
}

// `docked` (tablet/PC): sin ventana ni cabecera, anclado en el centro de la
// consola; el lanzador se elige fuera (columna izquierda) y llega por
// `shooter` / `onShooterChange` (modo controlado).
// `onProgress({ shooter, origin, goal, seven })` (opcional, tablet): avisa de qué pasos del
// lanzamiento están ya elegidos, para el indicador «1 Jugador · 2 Origen · 3 Portería · 4 Gol / Parada».
export default function ShotPanel({ side, scale, ownName, rivalName, courtPlayers, benchPlayers, shortcuts, statusOf, onSubmit, onCancel, docked = false, shooter: shooterProp, onShooterChange, onProgress }) {
  const own = side === 'own';
  const [innerShooter, setInnerShooter] = useState(null); // playerId (nuestro) o dorsal (rival)
  const controlled = onShooterChange !== undefined;
  const shooter = controlled ? shooterProp : innerShooter;
  const setShooter = (v) => {
    if (!controlled) setInnerShooter(v);
    else onShooterChange(typeof v === 'function' ? v(shooterProp) : v);
  };
  const [shotZone, setShotZone] = useState(null);
  const [goalZone, setGoalZone] = useState(null);
  const [counter, setCounter] = useState(false);
  const [foul, setFoul] = useState(undefined); // undefined = aún sin preguntar, null = «no sé»
  const [foulTyped, setFoulTyped] = useState('');
  const [benchOpen, setBenchOpen] = useState(false);
  const [foulBench, setFoulBench] = useState(false);

  const hasShooter = !!shooter;
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  useEffect(() => {
    progressRef.current?.({ shooter: hasShooter, origin: !!shotZone, goal: !!goalZone, seven: shotZone === '7 metros' });
  }, [hasShooter, shotZone, goalZone]);
  const foulOpen = shotZone === '7 metros' && hasShooter && foul === undefined;
  const shooterPlayer = own && shooter ? [...courtPlayers, ...benchPlayers].find((p) => p.id === shooter) : null;
  const rivalStatus = !own && shooter ? statusOf(shooter) : null;

  function chooseZone(z) {
    setShotZone(z);
    setFoul(undefined);
    setFoulTyped('');
  }

  function submit(kind, outZone) {
    if (!hasShooter) return;
    onSubmit({
      side,
      kind, // 'goal' | 'save' | 'miss'
      shooter,
      shotZone: shotZone || null,
      goalZone: kind === 'miss' && !outZone ? null : (outZone || goalZone),
      counter,
      foul: foul ?? null,
    });
  }

  const cellChosen = !!goalZone;
  const hint = !hasShooter
    ? (own ? 'Elige quién lanza' : 'Elige o escribe el dorsal rival que lanza')
    : !cellChosen ? 'Toca un cuadrante de la portería (o un palo o «fuera»)' : 'Ya puedes marcar PARADA o GOL';
  const title = own ? 'Lanzamiento · Nos' : 'Lanzamiento rival';
  const label = own ? `Lanzamiento de ${ownName || 'nuestro equipo'}` : `Lanzamiento de ${rivalName || 'el rival'}`;

  const panel = (
      <section className={`shp${docked ? ' shp--docked' : ''}`} onClick={(e) => e.stopPropagation()} aria-label={label}>
        {!docked && (<header className="shp-head">
          <h2>{title}</h2>
          <button type="button" className="shp-close" onClick={onCancel} aria-label="Cerrar"><X size={20} /></button>
        </header>)}

        <div className="shp-body">
          {!docked && (own ? (
            <>
              <PlayerButtons players={courtPlayers} selected={shooter} onPick={setShooter} />
              {benchPlayers.length > 0 && (
                <button type="button" className="shp-link" onClick={() => setBenchOpen((v) => !v)}>{benchOpen ? 'Ocultar banquillo' : 'Ver banquillo'}</button>
              )}
              {benchOpen && <PlayerButtons players={benchPlayers} selected={shooter} onPick={setShooter} />}
            </>
          ) : (
            <>
              <div className="shp-dorsal-row">
                <DorsalChips shortcuts={shortcuts.slice(0, 6)} statusOf={statusOf} selected={shooter} onPick={setShooter} />
                <div className={`shp-dorsal-box${rivalStatus?.red ? ' shp-dorsal-box--red' : rivalStatus?.excludedMs ? ' shp-dorsal-box--excl' : rivalStatus?.yellow ? ' shp-dorsal-box--yellow' : ''}`} aria-live="polite">
                  <span className="shp-dorsal-box-n">{shooter || '—'}</span>
                  <span className="shp-dorsal-box-s">{rivalStatus?.red ? 'roja' : rivalStatus?.excludedMs ? formatClock(rivalStatus.excludedMs) : rivalStatus?.yellow ? 'amarilla' : shooter ? 'elegido' : 'dorsal'}</span>
                </div>
              </div>
              <DorsalKeys onKey={(k) => setShooter((v) => applyKey(v || '', k) || null)} />
            </>
          ))}

          <ShotBoard
            scale={scale}
            shotZone={shotZone}
            onShotZone={chooseZone}
            goalZone={goalZone}
            onGoalZone={setGoalZone}
            onOut={(zone) => submit('miss', zone)}
            outDisabled={!hasShooter}
          />

          <p className="shp-hint">{hint}</p>
          <div className="shp-final">
            <button type="button" className="shp-final-btn shp-final-btn--save" disabled={!hasShooter || !cellChosen} onClick={() => submit('save')}>
              <Hand size={20} /> PARADA
            </button>
            <button type="button" className="shp-final-btn shp-final-btn--goal" disabled={!hasShooter || !cellChosen} onClick={() => submit('goal')}>
              <ThumbsUp size={20} /> GOL
            </button>
          </div>

          {foulOpen && (
            <div className="shp-foul" role="dialog" aria-label="Falta del 7 metros">
              {own ? (
                <>
                  <p className="shp-foul-title">7 metros · ¿qué dorsal rival cometió la falta? <span>(opcional)</span></p>
                  <div className="shp-chiprow">
                    <DorsalChips shortcuts={shortcuts.slice(0, 6)} statusOf={statusOf} selected={null} onPick={(n) => setFoul(n)} />
                  </div>
                  <DorsalKeys onKey={(k) => setFoulTyped((v) => applyKey(v, k))} />
                  <div className="shp-foul-actions">
                    <div className="shp-foul-typed">{foulTyped ? `Dorsal ${foulTyped}` : 'Escribe un dorsal nuevo o elige uno'}</div>
                    <button type="button" className="shp-btn shp-btn--ok" disabled={!foulTyped} onClick={() => setFoul(foulTyped)}>Aceptar</button>
                    <button type="button" className="shp-btn" onClick={() => setFoul(null)}>No sé</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="shp-foul-title">7 metros · ¿quién de los nuestros cometió la falta? <span>(opcional)</span></p>
                  <PlayerButtons players={foulBench ? [...courtPlayers, ...benchPlayers] : courtPlayers} selected={null} onPick={(id) => setFoul(id)} />
                  <div className="shp-foul-actions">
                    {benchPlayers.length > 0 && (
                      <button type="button" className="shp-btn" onClick={() => setFoulBench((v) => !v)}>{foulBench ? 'Ocultar banquillo' : 'Ver banquillo'}</button>
                    )}
                    <button type="button" className="shp-btn" onClick={() => setFoul(null)}>No sé</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <footer className="shp-foot">
          <button type="button" className={`shp-switch${counter ? ' shp-switch--on' : ''}`} aria-pressed={counter} onClick={() => setCounter((v) => !v)}>
            <span className="shp-switch-track" /> Contraataque
          </button>
          <button type="button" className="shp-btn shp-btn--line" disabled={!hasShooter} onClick={() => submit('goal')}>Gol sin<br />detalle</button>
          <button type="button" className="shp-btn shp-btn--line" disabled={!hasShooter} onClick={() => submit('miss')}>Fallo sin<br />detalle</button>
        </footer>
        {shooterPlayer && <span className="shp-sr" aria-live="polite">Lanza #{shooterPlayer.number} {shooterPlayer.name}</span>}
      </section>
  );
  return docked ? panel : <div className="modal-backdrop" onClick={onCancel}>{panel}</div>;
}
