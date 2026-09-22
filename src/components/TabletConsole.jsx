import { useState } from 'react';
import { ArrowLeftRight, CircleSlash, Timer, Zap } from 'lucide-react';
import { opp, useActionFlash } from '../hooks/useActionFlash';
import TabletRight from './TabletRight';
import { useLaunchLayout, useTabletZoom } from '../hooks/useIsPhone';
import { sanctionTag as tagOf } from '../utils/playerTags';
import { shortTeamName } from '../utils/teamColors';
import { formatClock } from '../utils/time';
import ShotPanel, { DorsalChips, DorsalKeys, PlayerButtons, applyKey } from './ShotPanel';

// Consola de TABLET / PC (2026-09-21, según el mockup aprobado): tres columnas
// y todo a la vista, sin ventanas intermedias para lo más frecuente.
//  - Izquierda: nuestros jugadores (en pista y banquillo, con su sanción a la
//    vista: tiempo de exclusión, amarilla, roja) y el dorsal rival (sancionados,
//    más usados y teclado). Tocar a alguien lo deja SELECCIONADO: es el que lanza
//    en el panel del centro y el destinatario de ROBO / PÉRDIDA / EXCLUSIÓN /
//    AMARILLA.
//  - Centro: arriba, el mensaje de lo que se acaba de anotar (con «Deshacer» y,
//    tras un gol, el asistente) o el aviso del cambio en curso; después el panel
//    LANZAMIENTO anclado (el mismo ShotPanel del móvil, sin ventana) o, con el
//    conmutador de la derecha, las estadísticas completas. Debajo, las acciones
//    sobre el seleccionado. Cada acción anotada deja el mensaje y DESMARCA a
//    quien estaba seleccionado.
//  - CAMBIO no abre ninguna ventana: entra en «modo cambio» sobre la propia
//    columna izquierda (se tocan los que salen y los que entran, tantos como se
//    quiera) y se confirma en el aviso de arriba.
//  - Derecha: TabletRight (reloj, marcador, pasivos, Resumen / Cronología).
// No sabe nada de Firestore: BenchConsole le pasa los datos ya preparados y las
// funciones (`actions`) que anotan.
export default function TabletConsole({
  store, team, onBack, onFinish, onNeedLineup,
  courtPlayers, benchPlayers, shortcuts, statusOf, isRunning,
  rivalExclusionSummary = [], rivalYellowCards = [],
  actions, assistFor, onAssist, summaryNode, chronologyNode, statsNode,
}) {
  const { state } = store;
  const [side, setSide] = useState('own');
  const [shooter, setShooter] = useState(null); // id (nuestro) o dorsal (rival)
  const [draftKey, setDraftKey] = useState(0); // cambia al registrar: el panel vuelve a empezar
  const [center, setCenter] = useState('launch'); // 'launch' | 'stats'
  const [rightTab, setRightTab] = useState('resumen');
  const [swap, setSwap] = useState(null); // modo cambio: { outs: [ids], ins: [ids] }
  const [progress, setProgress] = useState({ shooter: false, origin: false, goal: false, seven: false });
  const zoom = useTabletZoom();
  // Con sitio de sobra, los botones se agrupan a la izquierda y la portería/cancha
  // crecen para ocupar lo que deja libre esa columna (2026-09-22, según el dibujo del
  // usuario); si no, la fila compacta de siempre, a tamaño fijo (ver useIsPhone.js).
  const launch = useLaunchLayout();

  const ownSelected = side === 'own' && shooter ? state.players[shooter] : null;
  const rivalSelected = side === 'rival' && shooter ? shooter : null;
  const rivalStatus = rivalSelected ? statusOf(rivalSelected) : null;

  const { done, setDone, flash, shotMessage, teamAction: registerTeamAction, sanction: registerSanction, passive: registerPassive, substitution, undoLast } = useActionFlash({ store, actions, courtPlayers, assistFor, onAssist });

  function pickOwn(id) {
    if (swap) {
      const inCourt = courtPlayers.some((p) => p.id === id);
      const list = inCourt ? 'outs' : 'ins';
      setSwap((s) => ({ ...s, [list]: s[list].includes(id) ? s[list].filter((x) => x !== id) : [...s[list], id] }));
      return;
    }
    setSide('own');
    setShooter(id);
  }
  function pickRival(number) {
    setSide('rival');
    setShooter(number);
  }
  function submitShot(r) {
    const m = shotMessage(r);
    actions.submitShot(r);
    flash(m.text, m.detail, m.poss, m.assistable);
    setShooter(null);
    setSide(opp(r.side)); // ataca el otro equipo
    setDraftKey((k) => k + 1);
  }
  // Robo o pérdida: valen con o sin jugador (o dorsal); la persona es opcional.
  const who = side === 'own' ? ownSelected?.id : rivalSelected;
  function teamAction(kind) {
    setSide(registerTeamAction(kind, side, who));
    setShooter(null);
  }
  // Exclusión, amarilla o roja al seleccionado. Si con eso queda expulsado alguien que
  // está en pista (3ª exclusión o roja), se entra en modo cambio con él ya marcado.
  function sanction(kind) {
    if (!ownSelected && !rivalSelected) return;
    const res = registerSanction(kind, side, ownSelected ? ownSelected.id : rivalSelected);
    if (res === false) return; // ya tenía amarilla: no se ha registrado nada
    if (typeof res === 'string') setSwap({ outs: [res], ins: [] });
    setShooter(null);
  }
  function passive(t) {
    setSide(registerPassive(t));
    setShooter(null);
  }
  function toggleSwap() {
    setSwap((s) => (s ? null : { outs: [], ins: [] }));
    setShooter(null);
    setDone(null);
  }
  function confirmSwap() {
    if (!swap || swap.outs.length === 0 || swap.outs.length !== swap.ins.length) return;
    substitution(swap.outs.map((outId, i) => ({ outId, inId: swap.ins[i] })));
    setSwap(null);
  }

  // Nombre del equipo en cada sitio: en la cabecera de la columna sobra ancho de
  // sobra, así que casi nunca hace falta recortarlo a iniciales; en el
  // selector Nos|Rival, en cambio, es un botón pequeño y sí hace falta.
  const ownHeader = shortTeamName(state.ownTeamName, 30);
  const rivalHeader = shortTeamName(state.rivalName, 30);
  const ownShort = shortTeamName(state.ownTeamName, 10);
  const rivalShort = shortTeamName(state.rivalName, 10);
  const selectedLabel = ownSelected
    ? `${ownShort} · #${ownSelected.number} ${ownSelected.name}`
    : rivalSelected ? `${rivalShort} · #${rivalSelected}` : side === 'own' ? `${ownShort} · sin jugador` : `${rivalShort} · sin dorsal`;
  function changeSide(next) {
    if (next === side) return;
    setSide(next);
    setShooter(null);
  }

  // Modo cambio: quién sale (naranja) y quién entra (verde). Un excluido cumpliendo
  // sus 2 minutos no se puede cambiar; un expulsado sí (y no vuelve).
  const marks = swap ? { ...Object.fromEntries(swap.outs.map((id) => [id, 'out'])), ...Object.fromEntries(swap.ins.map((id) => [id, 'in'])) } : null;
  const canPick = (p) => (swap ? !(p.excluded && !p.disqualified) : !(p.excluded || p.disqualified));
  const swapReady = !!swap && swap.outs.length > 0 && swap.outs.length === swap.ins.length;
  const numList = (ids) => (ids.length ? ` (${ids.map((id) => `#${state.players[id]?.number ?? '?'}`).join(' ')})` : '');
  const swapText = swap
    ? `Cambio · salen ${swap.outs.length}${numList(swap.outs)} · entran ${swap.ins.length}${numList(swap.ins)}${swapReady ? ' · listo' : ' · tienen que ser los mismos'}`
    : '';
  const assistCandidates = assistFor
    ? courtPlayers.filter((p) => !p.excluded && !p.disqualified && p.id !== assistFor.scorerId).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    : [];

  // Dorsales rivales con cada sanción, para mostrarlos debajo de AMARILLA / EXCLUSIÓN
  // 2' / ROJA (2026-09-22): la exclusión cuenta tanto la que está cumpliendo ahora
  // (con la cuenta atrás) como las ya cumplidas antes (acumuladas, X/3).
  const rivalYellowList = [...new Set(rivalYellowCards.map((y) => String(y.number)))];
  const rivalExclList = rivalExclusionSummary.filter((e) => !e.disqualified && e.count > 0);
  const rivalRedList = rivalExclusionSummary.filter((e) => e.disqualified);
  const hasSanc = rivalYellowList.length > 0 || rivalExclList.length > 0 || rivalRedList.length > 0;

  return (
    <div className="tc-grid" style={zoom < 1 ? { zoom } : undefined}>
      <aside className="tc-left">
        <h3 className="tc-h">{ownHeader} · en pista</h3>
        <PlayerButtons players={courtPlayers} selected={!swap && side === 'own' ? shooter : null} onPick={pickOwn} wide marks={marks} tagOf={tagOf} canPick={canPick} />
        {benchPlayers.length > 0 && (
          <>
            <h3 className="tc-h">Banquillo</h3>
            <PlayerButtons players={benchPlayers} selected={!swap && side === 'own' ? shooter : null} onPick={pickOwn} bench marks={marks} tagOf={tagOf} canPick={canPick} />
          </>
        )}
        <div className="tc-rival">
          <h3 className="tc-h">{rivalHeader} · dorsal</h3>
          <h4 className="tc-h2">Dorsal · más usados</h4>
          {shortcuts.length === 0 && <p className="tc-note">Se irán añadiendo según los uses. Puedes dar la lista al crear el partido.</p>}
          <div className="shp-dorsal-row shp-dorsal-row--4">
            <DorsalChips shortcuts={shortcuts.slice(0, 6)} statusOf={statusOf} selected={side === 'rival' ? shooter : null} onPick={pickRival} />
            <div className={`shp-dorsal-box shp-dorsal-box--span${rivalStatus?.red ? ' shp-dorsal-box--red' : rivalStatus?.excludedMs ? ' shp-dorsal-box--excl' : rivalStatus?.yellow ? ' shp-dorsal-box--yellow' : ''}`}>
              <span className="shp-dorsal-box-n">{rivalSelected || '—'}</span>
              <span className="shp-dorsal-box-s">{rivalStatus?.red ? 'roja' : rivalStatus?.excludedMs ? 'excluido' : rivalStatus?.yellow ? 'amarilla' : rivalSelected ? 'elegido' : 'dorsal'}</span>
            </div>
          </div>
          <DorsalKeys onKey={(k) => { setSide('rival'); setShooter((v) => applyKey(side === 'rival' ? (v || '') : '', k) || null); }} />
        </div>
      </aside>

      <div className="tc-divider" aria-hidden="true" />

      <main className="tc-center" ref={launch.ref}>
        {center === 'launch' ? (
          <>
            <div className={`tc-top${launch.wide ? ' tc-top--wide' : ''}`}>
              {swap ? (
                <div className="tc-swapb">
                  <span>{swapText}</span>
                  <button type="button" disabled={!swapReady} onClick={confirmSwap}>Confirmar</button>
                  <button type="button" className="g" onClick={() => setSwap(null)}>Cancelar</button>
                </div>
              ) : !done ? (
                progress.seven && !progress.shooter ? (
                  <div className="tc-warn">7 metros: elige primero quién lo lanza</div>
                ) : (
                  <div className="tc-steps">
                    {[['Jugador', progress.shooter], ['Origen', progress.origin], ['Portería', progress.goal], ['Gol / Parada', false]].map(([label, ok], i, all) => {
                      const now = all.findIndex(([, o]) => !o) === i;
                      return <div key={label} className={`tc-step${ok ? ' tc-step--done' : now ? ' tc-step--now' : ''}`}><i>{ok ? '✓' : i + 1}</i>{label}</div>;
                    })}
                  </div>
                )
              ) : done ? (
                <div className="tc-done" role="status">
                  <div className="tc-done-l1">
                    <span className="tc-done-ok">Registrado</span>
                    <b>{done.text}</b>
                    {done.detail && <span className="tc-done-dim">{done.detail}</span>}
                    <span className="tc-done-poss">{done.poss}</span>
                  </div>
                  <div className="tc-done-l2">
                    {done.assistable && assistFor && (
                      <>
                        <span>¿Asistente? <em>(opcional)</em></span>
                        {assistCandidates.map((p) => (
                          <button key={p.id} type="button" className="tc-achip" onClick={() => { onAssist(p.id); setDone(null); }} aria-label={`Asistencia de ${p.number} ${p.name}`}>#{p.number}</button>
                        ))}
                        <button type="button" className="tc-link" onClick={() => { onAssist(null); setDone(null); }}>Sin asistente</button>
                      </>
                    )}
                    <button type="button" className="tc-link tc-link--undo" onClick={undoLast}>Deshacer</button>
                  </div>
                </div>
              ) : null}
            </div>
            {launch.wide ? (
              <div className="tc-launchrow tc-launchrow--wide">
                <div className="tc-launchcol">
                  <div className="tc-lcol-buttons">
                    <button type="button" className={`tc-act ${swap ? 'tc-act--camon' : 'tc-act--dark'}`} disabled={!state.canSubstitute} onClick={toggleSwap} aria-pressed={!!swap}><ArrowLeftRight size={16} /> CAMBIO</button>
                    <button type="button" className="tc-act" disabled={!isRunning || !!swap} onClick={() => teamAction('steal')}><Zap size={16} /> ROBO</button>
                    <button type="button" className="tc-act" disabled={!isRunning || !!swap} onClick={() => teamAction('turnover')}><CircleSlash size={16} /> PÉRDIDA</button>
                    <button type="button" className="tc-act tc-act--yellow" disabled={!isRunning || !!swap || (!ownSelected && !rivalSelected) || (ownSelected && ownSelected.yellowCard)} onClick={() => sanction('yellow')}>AMARILLA</button>
                    <button type="button" className="tc-act tc-act--excl" disabled={!isRunning || !!swap || (!ownSelected && !rivalSelected)} onClick={() => sanction('exclusion')}><Timer size={16} /> EXCLUSIÓN 2&apos;</button>
                    <button type="button" className="tc-act tc-act--red" disabled={!isRunning || !!swap || (!ownSelected && !rivalSelected) || (ownSelected && ownSelected.disqualified) || !!rivalStatus?.red} onClick={() => sanction('red')}>ROJA</button>
                  </div>
                  {/* Dorsales rivales sancionados, en dos columnas (amarilla y roja) debajo
                      de los botones — antes vivían en "Sancionados", en la columna de
                      jugadores (ver tc-left más arriba). */}
                  {hasSanc && (
                    <div className="tc-lcol-sancwrap">
                      <h4 className="tc-h2">Amonestados {rivalHeader}</h4>
                      <div className="tc-lcol-sanc">
                        <div className="tc-lcol-sancol tc-lcol-sancol--yellow">
                          {rivalYellowList.map((n) => <button key={n} type="button" className="tc-sanpill tc-sanpill--yellow" onClick={() => pickRival(n)}>#{n}</button>)}
                        </div>
                        <div className="tc-lcol-sancol tc-lcol-sancol--red">
                          {rivalExclList.map((e) => (
                            <button key={`e${e.number}`} type="button" className="tc-sanpill tc-sanpill--excl" onClick={() => pickRival(e.number)}>
                              #{e.number} {e.activeRemainingMs > 0 ? `${formatClock(e.activeRemainingMs)} · ` : ''}{e.count}/3
                            </button>
                          ))}
                          {rivalRedList.map((e) => <button key={`r${e.number}`} type="button" className="tc-sanpill tc-sanpill--red" onClick={() => pickRival(e.number)}>#{e.number}</button>)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="tc-launchmain">
                  <div className="tc-launch">
                    {!isRunning && <div className="tc-locked"><span>{state.clock.status === 'idle' ? 'Partido no iniciado: pulsa ▶ para poder anotar' : 'Reloj parado: pulsa ▶ para seguir anotando'}</span></div>}
                    <ShotPanel
                      key={draftKey}
                      docked
                      side={side}
                      scale={launch}
                      ownName={state.ownTeamName}
                      rivalName={state.rivalName}
                      courtPlayers={courtPlayers}
                      benchPlayers={benchPlayers}
                      shortcuts={shortcuts}
                      statusOf={statusOf}
                      shooter={shooter}
                      onShooterChange={setShooter}
                      onSubmit={submitShot}
                      onProgress={setProgress}
                    />
                  </div>
                  <div className="tc-selected">
                    <span className="tc-selected-l">{selectedLabel}</span>
                    <span className="tc-side" role="group" aria-label="Equipo">
                      <button type="button" className={side === 'own' ? 'on' : ''} onClick={() => changeSide('own')}>{ownShort}</button>
                      <button type="button" className={side === 'rival' ? 'on' : ''} onClick={() => changeSide('rival')}>{rivalShort}</button>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="tc-launchrow">
                <div className="tc-launchmain">
                  <div className="tc-launch">
                    {!isRunning && <div className="tc-locked"><span>{state.clock.status === 'idle' ? 'Partido no iniciado: pulsa ▶ para poder anotar' : 'Reloj parado: pulsa ▶ para seguir anotando'}</span></div>}
                    <ShotPanel
                      key={draftKey}
                      docked
                      side={side}
                      scale={launch}
                      ownName={state.ownTeamName}
                      rivalName={state.rivalName}
                      courtPlayers={courtPlayers}
                      benchPlayers={benchPlayers}
                      shortcuts={shortcuts}
                      statusOf={statusOf}
                      shooter={shooter}
                      onShooterChange={setShooter}
                      onSubmit={submitShot}
                      onProgress={setProgress}
                    />
                  </div>
                  <div className="tc-selected">
                    <span className="tc-selected-l">{selectedLabel}</span>
                    <span className="tc-side" role="group" aria-label="Equipo">
                      <button type="button" className={side === 'own' ? 'on' : ''} onClick={() => changeSide('own')}>{ownShort}</button>
                      <button type="button" className={side === 'rival' ? 'on' : ''} onClick={() => changeSide('rival')}>{rivalShort}</button>
                    </span>
                  </div>
                </div>
                {/* Fila compacta de 6, igual que la demo aprobada. Debajo, una fila (no
                    dos columnas: aquí no sobra ancho) con los dorsales rivales
                    sancionados — sin ella se perdían de vista en esta disposición. */}
                <div className="tc-actions">
                  <button type="button" className="tc-act" disabled={!isRunning || !!swap} onClick={() => teamAction('steal')}><Zap size={16} /> ROBO</button>
                  <button type="button" className="tc-act" disabled={!isRunning || !!swap} onClick={() => teamAction('turnover')}><CircleSlash size={16} /> PÉRDIDA</button>
                  <button type="button" className="tc-act tc-act--excl" disabled={!isRunning || !!swap || (!ownSelected && !rivalSelected)} onClick={() => sanction('exclusion')}><Timer size={16} /> EXCLUSIÓN 2&apos;</button>
                  <button type="button" className="tc-act tc-act--yellow" disabled={!isRunning || !!swap || (!ownSelected && !rivalSelected) || (ownSelected && ownSelected.yellowCard)} onClick={() => sanction('yellow')}>AMARILLA</button>
                  <button type="button" className="tc-act tc-act--red" disabled={!isRunning || !!swap || (!ownSelected && !rivalSelected) || (ownSelected && ownSelected.disqualified) || !!rivalStatus?.red} onClick={() => sanction('red')}>ROJA</button>
                  <button type="button" className={`tc-act ${swap ? 'tc-act--camon' : 'tc-act--dark'}`} disabled={!state.canSubstitute} onClick={toggleSwap} aria-pressed={!!swap}><ArrowLeftRight size={16} /> CAMBIO</button>
                </div>
                {hasSanc && (
                  <div className="tc-sancrow">
                    <span className="tc-sancrow-l">Amonestados {rivalHeader}</span>
                    {rivalYellowList.map((n) => <button key={`y${n}`} type="button" className="tc-sanpill tc-sanpill--yellow" onClick={() => pickRival(n)}>#{n}</button>)}
                    {rivalExclList.map((e) => (
                      <button key={`e${e.number}`} type="button" className="tc-sanpill tc-sanpill--excl" onClick={() => pickRival(e.number)}>
                        #{e.number} {e.activeRemainingMs > 0 ? `${formatClock(e.activeRemainingMs)} · ` : ''}{e.count}/3
                      </button>
                    ))}
                    {rivalRedList.map((e) => <button key={`r${e.number}`} type="button" className="tc-sanpill tc-sanpill--red" onClick={() => pickRival(e.number)}>#{e.number}</button>)}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="tc-stats">{statsNode}</div>
        )}
      </main>

      <TabletRight
        store={store}
        team={team}
        onBack={onBack}
        onFinish={onFinish}
        onNeedLineup={onNeedLineup}
        center={center}
        onCenter={setCenter}
        isRunning={isRunning}
        onPassive={passive}
        onFlash={(text, detail) => flash(text, detail, 'Posesión igual')}
        rightTab={rightTab}
        onRightTab={setRightTab}
        summaryNode={summaryNode}
        chronologyNode={chronologyNode}
      />
    </div>
  );
}
