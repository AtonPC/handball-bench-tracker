import { useState } from 'react';
import { ArrowLeftRight, CircleSlash, Timer, Zap } from 'lucide-react';
import TabletRight from './TabletRight';
import { useTabletZoom } from '../hooks/useIsPhone';
import ShotPanel, { DorsalChips, DorsalKeys, PlayerButtons, applyKey } from './ShotPanel';

// Consola de TABLET / PC (2026-09-21, según el mockup aprobado): tres columnas
// y todo a la vista, sin ventanas intermedias para lo más frecuente.
//  - Izquierda: nuestros jugadores (en pista y banquillo) y el dorsal rival
//    (accesos directos + teclado). Tocar a alguien lo deja SELECCIONADO: es el
//    que lanza en el panel del centro y el destinatario de ROBO / EXCLUSIÓN /
//    AMARILLA.
//  - Centro: el panel LANZAMIENTO anclado (el mismo ShotPanel del móvil, sin
//    ventana) o, con el conmutador de la derecha, las estadísticas completas.
//    Debajo, las acciones sobre el seleccionado.
//  - Derecha: la cabecera de siempre (reloj, marcador, controles), el aviso de
//    partido no iniciado y las pestañas Resumen / Cronología.
// No sabe nada de Firestore: BenchConsole le pasa los datos ya preparados y las
// funciones (`actions`) que anotan.
export default function TabletConsole({
  store, team, onBack, onFinish, onNeedLineup,
  courtPlayers, benchPlayers, shortcuts, sanctioned = [], statusOf, scale, isRunning,
  actions, summaryNode, chronologyNode, statsNode,
}) {
  const { state } = store;
  const [side, setSide] = useState('own');
  const [shooter, setShooter] = useState(null); // id (nuestro) o dorsal (rival)
  const [draftKey, setDraftKey] = useState(0); // cambia al registrar: el panel vuelve a empezar
  const [center, setCenter] = useState('launch'); // 'launch' | 'stats'
  const [rightTab, setRightTab] = useState('resumen');
  const [benchOpen, setBenchOpen] = useState(false);
  const zoom = useTabletZoom();

  const ownSelected = side === 'own' && shooter ? state.players[shooter] : null;
  const rivalSelected = side === 'rival' && shooter ? shooter : null;
  const rivalStatus = rivalSelected ? statusOf(rivalSelected) : null;

  function pickOwn(id) {
    setSide('own');
    setShooter(id);
  }
  function pickRival(number) {
    setSide('rival');
    setShooter(number);
  }
  function submitShot(result) {
    actions.submitShot(result);
    setShooter(null);
    setDraftKey((k) => k + 1);
  }
  const selectedLabel = ownSelected
    ? `Nos · #${ownSelected.number} ${ownSelected.name}`
    : rivalSelected ? `Rival · #${rivalSelected}` : side === 'own' ? 'Nos · sin jugador' : 'Rival · sin dorsal';
  // Robo y pérdida valen con o sin jugador (o dorsal): la persona es opcional.
  const who = side === 'own' ? ownSelected?.id : rivalSelected;
  function changeSide(next) {
    if (next === side) return;
    setSide(next);
    setShooter(null);
  }

  return (
    <div className="tc-grid" style={zoom < 1 ? { zoom } : undefined}>
      <aside className="tc-left">
        <h3 className="tc-h">Nuestro equipo · en pista</h3>
        <PlayerButtons players={courtPlayers} selected={side === 'own' ? shooter : null} onPick={pickOwn} wide />
        <div className="tc-hrow">
          <h3 className="tc-h">Banquillo</h3>
          <button type="button" className="shp-link" onClick={() => setBenchOpen((v) => !v)}>{benchOpen ? 'Ocultar' : 'Ver'}</button>
        </div>
        {benchOpen && <PlayerButtons players={benchPlayers} selected={side === 'own' ? shooter : null} onPick={pickOwn} wide />}
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
              <button type="button" className="tc-act" disabled={!isRunning} onClick={() => actions.steal(side, who)}><Zap size={16} /> ROBO</button>
              <button type="button" className="tc-act" disabled={!isRunning} onClick={() => actions.turnover(side, who)}><CircleSlash size={16} /> PÉRDIDA</button>
              <button type="button" className="tc-act tc-act--excl" disabled={!isRunning || (!ownSelected && !rivalSelected)} onClick={() => (ownSelected ? actions.exclusion(ownSelected.id) : actions.rivalExclusion(rivalSelected))}><Timer size={16} /> EXCLUSIÓN 2&apos;</button>
              <button type="button" className="tc-act tc-act--yellow" disabled={!isRunning || (!ownSelected && !rivalSelected) || (ownSelected && ownSelected.yellowCard)} onClick={() => (ownSelected ? actions.yellow(ownSelected.id) : actions.rivalYellow(rivalSelected))}>AMARILLA</button>
              <button type="button" className="tc-act tc-act--dark" disabled={!state.canSubstitute} onClick={actions.openSubstitution}><ArrowLeftRight size={16} /> CAMBIO</button>
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
        onPassive={actions.passive}
        rightTab={rightTab}
        onRightTab={setRightTab}
        summaryNode={summaryNode}
        chronologyNode={chronologyNode}
      />
    </div>
  );
}
