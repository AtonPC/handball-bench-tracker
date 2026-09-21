import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, CircleSlash, Timer, Zap } from 'lucide-react';
import TabletRight from './TabletRight';
import { useTabletZoom } from '../hooks/useIsPhone';
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
const opp = (t) => (t === 'own' ? 'rival' : 'own');
const teamWord = (t) => (t === 'own' ? 'Nos' : 'Rival');

// Marca de sanción de un jugador nuestro, junto a su nombre.
function tagOf(p) {
  if (p.disqualified) return { text: 'R', kind: 'red' };
  if (p.excluded) return { text: `${formatClock(p.exclusionRemainingMs || 0)}${p.yellowCard ? ' A' : ''}`, kind: 'excl' };
  if (p.yellowCard) return { text: 'A', kind: 'yellow' };
  return null;
}

export default function TabletConsole({
  store, team, onBack, onFinish, onNeedLineup,
  courtPlayers, benchPlayers, shortcuts, sanctioned = [], statusOf, scale, isRunning,
  actions, assistFor, onAssist, summaryNode, chronologyNode, statsNode,
}) {
  const { state } = store;
  const [side, setSide] = useState('own');
  const [shooter, setShooter] = useState(null); // id (nuestro) o dorsal (rival)
  const [draftKey, setDraftKey] = useState(0); // cambia al registrar: el panel vuelve a empezar
  const [center, setCenter] = useState('launch'); // 'launch' | 'stats'
  const [rightTab, setRightTab] = useState('resumen');
  const [done, setDone] = useState(null); // último registro: { text, detail, poss, assistable }
  const [swap, setSwap] = useState(null); // modo cambio: { outs: [ids], ins: [ids] }
  const zoom = useTabletZoom();

  const ownSelected = side === 'own' && shooter ? state.players[shooter] : null;
  const rivalSelected = side === 'rival' && shooter ? shooter : null;
  const rivalStatus = rivalSelected ? statusOf(rivalSelected) : null;

  // El mensaje se va solo (más despacio si hay que elegir asistente). La consola
  // se repinta cada segundo (reloj): el temporizador solo depende del mensaje.
  const dismissRef = useRef(null);
  dismissRef.current = () => {
    setDone(null);
    if (assistFor) onAssist(null);
  };
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => dismissRef.current(), done.assistable ? 9000 : 3500);
    return () => clearTimeout(t);
  }, [done]);

  function flash(text, detail, poss, assistable = false) {
    if (assistFor) onAssist(null); // un asistente pendiente de antes ya no tiene aviso
    setDone({ text, detail, poss, assistable });
  }
  const possLabel = (to) => (state.possession === to ? 'Posesión igual' : `Posesión → ${teamWord(to)}`);
  const ownWho = (p) => (p ? `#${p.number} ${p.name}` : 'Nos (sin jugador)');
  const whoText = (s, id, dorsal) => (s === 'own' ? ownWho(id ? state.players[id] : null) : dorsal ? `Rival #${dorsal}` : 'Rival (sin dorsal)');

  async function undoLast() {
    const r = await store.undo();
    if (r && !r.ok && r.reason === 'clock') {
      alert('No se puede deshacer esta acción porque el reloj ha cambiado desde entonces. Corrígela a mano.');
      return;
    }
    if (assistFor) onAssist(null);
    setDone(null);
  }

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
    const own = r.side === 'own';
    const who = whoText(r.side, own ? r.shooter : null, own ? null : r.shooter);
    const text = r.kind === 'goal' ? `Gol · ${who}` : r.kind === 'save' ? (own ? `Fallo parado · ${who}` : `Parada · tiro de ${who}`) : `Fallo · ${who}`;
    const bits = [`${r.shotZone || 'sin zona'} → ${r.goalZone || 'sin destino'}`];
    if (r.foul) bits.push(own ? `falta del rival #${r.foul}` : `falta de #${state.players[r.foul]?.number ?? '?'}`);
    if (r.counter) bits.push('contraataque');
    actions.submitShot(r);
    flash(text, bits.join(' · '), `Posesión → ${own ? 'Rival' : 'Nos'}`, own && r.kind === 'goal' && r.shotZone !== '7 metros');
    setShooter(null);
    setSide(opp(r.side)); // ataca el otro equipo
    setDraftKey((k) => k + 1);
  }
  // Robo o pérdida: valen con o sin jugador (o dorsal); la persona es opcional.
  const who = side === 'own' ? ownSelected?.id : rivalSelected;
  function teamAction(kind) {
    const to = kind === 'steal' ? side : opp(side);
    actions[kind](side, who);
    flash(`${kind === 'steal' ? 'Robo' : 'Pérdida'} · ${whoText(side, who, rivalSelected)}`, '', possLabel(to));
    setSide(to);
    setShooter(null);
  }
  function sanction(kind) {
    if (!ownSelected && !rivalSelected) return;
    const detail = 'consta en la lista de sancionados';
    const label = kind === 'exclusion' ? 'Exclusión' : 'Amarilla';
    const text = `${label} · ${whoText(side, ownSelected?.id, rivalSelected)}`;
    if (ownSelected) {
      actions[kind](ownSelected.id);
    } else {
      const ok = actions[kind === 'exclusion' ? 'rivalExclusion' : 'rivalYellow'](rivalSelected);
      if (ok === false) return; // ya tenía amarilla: no se ha registrado nada
    }
    flash(text, detail, 'Posesión igual');
    setShooter(null);
  }
  function passive(t) {
    actions.passive(t);
    flash(`Pasivo · ${teamWord(t)}`, 'pérdida del equipo entero', possLabel(opp(t)));
    setSide(opp(t));
    setShooter(null);
  }
  function toggleSwap() {
    setSwap((s) => (s ? null : { outs: [], ins: [] }));
    setShooter(null);
    setDone(null);
  }
  function confirmSwap() {
    if (!swap || swap.outs.length === 0 || swap.outs.length !== swap.ins.length) return;
    const pairs = swap.outs.map((outId, i) => ({ outId, inId: swap.ins[i] }));
    const num = (id) => `#${state.players[id]?.number ?? '?'}`;
    actions.substituteMany(pairs);
    flash(`Cambio${pairs.length > 1 ? ` (${pairs.length})` : ''}`, `salen ${swap.outs.map(num).join(' ')} · entran ${swap.ins.map(num).join(' ')}`, 'Posesión igual');
    setSwap(null);
  }

  const selectedLabel = ownSelected
    ? `Nos · #${ownSelected.number} ${ownSelected.name}`
    : rivalSelected ? `Rival · #${rivalSelected}` : side === 'own' ? 'Nos · sin jugador' : 'Rival · sin dorsal';
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

  return (
    <div className="tc-grid" style={zoom < 1 ? { zoom } : undefined}>
      <aside className="tc-left">
        <h3 className="tc-h">Nuestro equipo · en pista</h3>
        <PlayerButtons players={courtPlayers} selected={!swap && side === 'own' ? shooter : null} onPick={pickOwn} wide marks={marks} tagOf={tagOf} canPick={canPick} />
        {benchPlayers.length > 0 && (
          <>
            <h3 className="tc-h">Banquillo</h3>
            <PlayerButtons players={benchPlayers} selected={!swap && side === 'own' ? shooter : null} onPick={pickOwn} bench marks={marks} tagOf={tagOf} canPick={canPick} />
          </>
        )}
        <div className="tc-rival">
          <h3 className="tc-h">Rival · dorsal</h3>
          {sanctioned.length > 0 && (
            <>
              <h4 className="tc-h2">Sancionados</h4>
              <div className="tc-sanc">
                <DorsalChips shortcuts={sanctioned} statusOf={statusOf} selected={side === 'rival' ? shooter : null} onPick={pickRival} />
              </div>
            </>
          )}
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

      <main className="tc-center">
        {center === 'launch' ? (
          <>
            <div className="tc-top">
              {swap ? (
                <div className="tc-swapb">
                  <span>{swapText}</span>
                  <button type="button" disabled={!swapReady} onClick={confirmSwap}>Confirmar</button>
                  <button type="button" className="g" onClick={() => setSwap(null)}>Cancelar</button>
                </div>
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
            <div className="tc-launch">
              {!isRunning && <div className="tc-locked"><span>{state.clock.status === 'idle' ? 'Partido no iniciado: pulsa ▶ para poder anotar' : 'Reloj parado: pulsa ▶ para seguir anotando'}</span></div>}
              <ShotPanel
                key={draftKey}
                docked
                side={side}
                scale={scale}
                ownName={state.ownTeamName}
                rivalName={state.rivalName}
                courtPlayers={courtPlayers}
                benchPlayers={benchPlayers}
                shortcuts={shortcuts}
                statusOf={statusOf}
                shooter={shooter}
                onShooterChange={setShooter}
                onSubmit={submitShot}
              />
            </div>
            <div className="tc-selected">
              <span className="tc-selected-l">{selectedLabel}</span>
              <span className="tc-side" role="group" aria-label="Equipo">
                <button type="button" className={side === 'own' ? 'on' : ''} onClick={() => changeSide('own')}>Nos</button>
                <button type="button" className={side === 'rival' ? 'on' : ''} onClick={() => changeSide('rival')}>Rival</button>
              </span>
            </div>
            <div className="tc-actions">
              <button type="button" className="tc-act" disabled={!isRunning || !!swap} onClick={() => teamAction('steal')}><Zap size={16} /> ROBO</button>
              <button type="button" className="tc-act" disabled={!isRunning || !!swap} onClick={() => teamAction('turnover')}><CircleSlash size={16} /> PÉRDIDA</button>
              <button type="button" className="tc-act tc-act--excl" disabled={!isRunning || !!swap || (!ownSelected && !rivalSelected)} onClick={() => sanction('exclusion')}><Timer size={16} /> EXCLUSIÓN 2&apos;</button>
              <button type="button" className="tc-act tc-act--yellow" disabled={!isRunning || !!swap || (!ownSelected && !rivalSelected) || (ownSelected && ownSelected.yellowCard)} onClick={() => sanction('yellow')}>AMARILLA</button>
              <button type="button" className={`tc-act ${swap ? 'tc-act--camon' : 'tc-act--dark'}`} disabled={!state.canSubstitute} onClick={toggleSwap} aria-pressed={!!swap}><ArrowLeftRight size={16} /> CAMBIO</button>
            </div>
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
