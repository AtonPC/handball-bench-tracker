import { useState } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw, Square, Undo2, X } from 'lucide-react';
import BallIcon from './BallIcon';
import ShotPanel, { DorsalChips, DorsalKeys, applyKey } from './ShotPanel';
import { timeoutDots, useClockControls } from '../hooks/useClockControls';
import { useActionFlash } from '../hooks/useActionFlash';
import { useRecentEvents } from '../hooks/useRecentEvents';
import { sanctionTag } from '../utils/playerTags';
import { periodClockDisplay } from '../utils/time';
import { teamInitials } from '../utils/teamColors';

// Consola de MÓVIL (2026-09-21, mockup «Consola móvil con lanzamiento» aprobado): una
// sola pantalla con lo esencial y HOJAS que suben desde abajo para lo demás, en vez
// de las pestañas de siempre (que siguen disponibles, abajo, para corregir).
//  - Arriba: marcador con el reloj, la pelota de posesión sobre el escudo (se toca
//    para pasarla) y las bolitas de tiempos muertos (marcar una PARA el reloj).
//  - Controles: ▶/⏸, ■ fin de periodo (↺ para reanudar), CAMBIO y ESTADÍSTICAS.
//  - LANZAMIENTO y LANZAMIENTO RIVAL abren el panel de lanzamiento de siempre.
//  - Robo · Pérdida · Sanción · Pasivo de cada equipo. Robo y pérdida piden a quién
//    (jugador o dorsal), pero es opcional; Sanción pide a quién y qué sanción
//    (exclusión, amarilla o roja); Pasivo se anota directamente.
//  - Debajo, quién está sancionado de cada equipo y las últimas acciones.
//  - Cada acción anotada deja el aviso «Registrado» con Deshacer (y el asistente
//    tras un gol nuestro).
// No sabe nada de Firestore: BenchConsole le pasa datos ya preparados y `actions`.

const ACTION_TITLE = { steal: 'Robo', turnover: 'Pérdida', sanction: 'Sanción' };

function PlayerGrid({ players, marks, onPick, canPick }) {
  return (
    <div className="ph-pgrid">
      {players.map((p) => {
        const tag = sanctionTag(p);
        const mark = marks?.[p.id];
        return (
          <button
            key={p.id}
            type="button"
            className={`ph-pk${p.isGK ? ' ph-pk--gk' : ''}${mark ? ` ph-pk--${mark}` : ''}${tag ? ` ph-pk--${tag.kind}` : ''}`}
            disabled={!canPick(p)}
            onClick={() => onPick(p.id)}
            aria-label={`Dorsal ${p.number} ${p.name}${tag ? (tag.kind === 'yellow' ? ' con amarilla' : tag.kind === 'red' ? ' expulsado' : ' excluido') : ''}`}
          >
            <b>{p.number}</b>
            <span>{(p.name || '').split(' ')[0]}</span>
            <i>{tag?.text || ''}</i>
          </button>
        );
      })}
    </div>
  );
}

function Sheet({ title, onClose, full, children }) {
  return (
    <>
      <div className="ph-back" onClick={onClose} />
      <section className={`ph-sheet${full ? ' ph-sheet--full' : ''}`} role="dialog" aria-label={title}>
        <div className="ph-grab" />
        <div className="ph-trow">
          <h2>{title}</h2>
          <button type="button" className="ph-x" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="ph-body">{children}</div>
      </section>
    </>
  );
}

export default function PhoneConsole({
  store, team, onBack, onFinish, onNeedLineup,
  courtPlayers, benchPlayers, shortcuts, sanctioned = [], statusOf, isRunning,
  scale, actions, assistFor, onAssist, statsNode, onMore,
}) {
  const { state } = store;
  const { clock, score, possession, ownTeamName, rivalName, rivalCrestUrl, isHome, alevinRules, lineups } = state;
  const ctl = useClockControls(store, { onNeedLineup, onFinish });
  const fl = useActionFlash({ store, actions, courtPlayers, assistFor, onAssist });
  const recent = useRecentEvents(store.matchId, 3);
  const [sheet, setSheet] = useState(null); // { kind: 'pick', action, team, step, who } | { kind: 'swap', outs, ins } | { kind: 'stats' }
  const [benchOpen, setBenchOpen] = useState(false);
  const [typed, setTyped] = useState(''); // dorsal rival escrito en la hoja
  const [shotSide, setShotSide] = useState(null); // 'own' | 'rival' con el panel de lanzamiento abierto

  const display = periodClockDisplay(clock.periodRemainingMs, clock.periodDurationMs);
  const nextLineupChosen = !!lineups[clock.period + 1];
  const sides = isHome ? ['own', 'rival'] : ['rival', 'own'];
  const info = {
    own: { name: ownTeamName, crest: team?.crestUrl, score: score.own, cls: 'own', init: teamInitials(ownTeamName) },
    rival: { name: rivalName, crest: rivalCrestUrl, score: score.rival, cls: 'rival', init: teamInitials(rivalName) },
  };
  const ownSanctioned = [...courtPlayers, ...benchPlayers].filter((p) => sanctionTag(p));

  function open(next) {
    setBenchOpen(false);
    setTyped('');
    setSheet(next);
  }
  const close = () => setSheet(null);

  function submitShot(r) {
    const m = fl.shotMessage(r);
    actions.submitShot(r);
    setShotSide(null);
    fl.flash(m.text, m.detail, m.poss, m.assistable);
  }

  // ROBO / PÉRDIDA: persona opcional → se anota al momento.
  function registerTeamAction(action, team, who) {
    fl.teamAction(action, team, who || null);
    close();
  }
  // Exclusión / amarilla / roja. Si queda expulsado alguien en pista, se abre el cambio con él marcado.
  function registerSanction(kind) {
    const res = fl.sanction(kind, sheet.team, sheet.who);
    if (res === false) return;
    if (typeof res === 'string') open({ kind: 'swap', outs: [res], ins: [] });
    else close();
  }

  // --- hoja Robo / Pérdida / Sanción ---
  function renderPick() {
    const { action, team: t, step, who } = sheet;
    const optional = action !== 'sanction';
    if (step === 2) {
      const own = t === 'own';
      const p = own ? state.players[who] : null;
      const st = own ? null : statusOf(who);
      return (
        <>
          <h3 className="ph-h">¿Qué sanción? · {own ? `#${p?.number} ${p?.name}` : `Rival #${who}`}</h3>
          <div className="ph-sanc3">
            <button type="button" className="ph-sbtn ph-sbtn--ex" onClick={() => registerSanction('exclusion')}>EXCLUSIÓN 2&apos;</button>
            <button type="button" className="ph-sbtn ph-sbtn--yl" disabled={own ? !!p?.yellowCard : !!st?.yellow} onClick={() => registerSanction('yellow')}>AMARILLA</button>
            <button type="button" className="ph-sbtn ph-sbtn--rd" disabled={own ? !!p?.disqualified : !!st?.red} onClick={() => registerSanction('red')}>ROJA</button>
          </div>
        </>
      );
    }
    if (t === 'own') {
      const pickOwn = (id) => (action === 'sanction' ? setSheet({ ...sheet, step: 2, who: id }) : registerTeamAction(action, 'own', id));
      const can = (p) => !p.disqualified && (action === 'sanction' || !p.excluded);
      return (
        <>
          <h3 className="ph-h">{action === 'sanction' ? '¿A quién?' : '¿Quién? (opcional)'}</h3>
          <PlayerGrid players={courtPlayers} onPick={pickOwn} canPick={can} />
          {benchPlayers.length > 0 && (
            <button type="button" className="ph-wide" onClick={() => setBenchOpen((v) => !v)}>{benchOpen ? 'Ocultar banquillo' : 'Ver banquillo'}</button>
          )}
          {benchOpen && <PlayerGrid players={benchPlayers} onPick={pickOwn} canPick={can} />}
          {optional && <button type="button" className="ph-wide" onClick={() => registerTeamAction(action, 'own', null)}>Sin jugador (opcional)</button>}
        </>
      );
    }
    // rival: dorsal (accesos directos + teclado)
    const st = typed ? statusOf(typed) : null;
    const boxCls = st?.red ? ' ph-rsel--rd' : st?.excludedMs ? ' ph-rsel--ex' : st?.yellow ? ' ph-rsel--yl' : '';
    return (
      <>
        <div className={`ph-rsel${boxCls}`}>
          <b>{typed || '—'}</b>
          <span>{st?.red ? 'roja' : st?.excludedMs ? 'excluido' : st?.yellow ? 'amarilla' : typed ? 'elegido' : optional ? 'dorsal (opcional)' : 'dorsal'}</span>
        </div>
        {sanctioned.length > 0 && (
          <>
            <h3 className="ph-h">Sancionados</h3>
            <div className="ph-chips"><DorsalChips shortcuts={sanctioned} statusOf={statusOf} selected={typed} onPick={setTyped} /></div>
          </>
        )}
        <h3 className="ph-h">Más usados</h3>
        {shortcuts.length === 0 && <p className="ph-note">Se irán añadiendo según los uses.</p>}
        <div className="ph-chips"><DorsalChips shortcuts={shortcuts.slice(0, 6)} statusOf={statusOf} selected={typed} onPick={setTyped} /></div>
        <DorsalKeys onKey={(k) => setTyped((v) => applyKey(v, k))} />
        {action === 'sanction' ? (
          <button type="button" className="ph-next" disabled={!typed} onClick={() => setSheet({ ...sheet, step: 2, who: typed })}>Siguiente · elegir sanción</button>
        ) : (
          <button type="button" className="ph-next" onClick={() => registerTeamAction(action, 'rival', typed)}>{typed ? `Registrar · #${typed}` : 'Registrar sin dorsal'}</button>
        )}
      </>
    );
  }

  // --- hoja Cambio (varios a la vez) ---
  function renderSwap() {
    const { outs, ins } = sheet;
    const toggle = (id, list) => setSheet((s) => ({ ...s, [list]: s[list].includes(id) ? s[list].filter((x) => x !== id) : [...s[list], id] }));
    const marks = { ...Object.fromEntries(outs.map((id) => [id, 'out'])), ...Object.fromEntries(ins.map((id) => [id, 'in'])) };
    const ready = outs.length > 0 && outs.length === ins.length;
    const num = (id) => `#${state.players[id]?.number ?? '?'}`;
    return (
      <>
        <h3 className="ph-h">Salen {outs.length}{outs.length ? ` (${outs.map(num).join(' ')})` : ''} · entran {ins.length}{ins.length ? ` (${ins.map(num).join(' ')})` : ''}</h3>
        <PlayerGrid players={courtPlayers} marks={marks} onPick={(id) => toggle(id, 'outs')} canPick={(p) => !(p.excluded && !p.disqualified)} />
        <h3 className="ph-h">Banquillo</h3>
        <PlayerGrid players={benchPlayers} marks={marks} onPick={(id) => toggle(id, 'ins')} canPick={(p) => !p.disqualified} />
        {!ready && outs.length + ins.length > 0 && <p className="ph-note">Tienen que salir tantos como entran.</p>}
        <button
          type="button"
          className="ph-next ph-next--g"
          disabled={!ready}
          onClick={() => {
            fl.substitution(outs.map((outId, i) => ({ outId, inId: ins[i] })));
            close();
          }}
        >
          {ready ? `HACER ${outs.length} CAMBIO${outs.length === 1 ? '' : 'S'}` : 'HACER CAMBIO'}
        </button>
      </>
    );
  }

  const dotsRow = (t) => (
    <div className="ph-tmd">
      {timeoutDots(store, t, ctl.longLabel, (text, detail) => fl.flash(text, detail, 'Posesión igual')).map((d, i) => (
        <button key={i} type="button" className={`ph-dot${d.on ? ' ph-dot--on' : ''}`} onClick={d.onClick} aria-label={d.label}><i /></button>
      ))}
    </div>
  );

  const teamBlock = (k) => (
    <div key={k} className="ph-tm">
      <button type="button" className={`ph-crest ph-crest--${info[k].cls}${possession === k ? ' ph-crest--ball' : ''}`} onClick={() => store.setPossession(k)} aria-pressed={possession === k} aria-label={`Posesión: ${info[k].name}`}>
        {info[k].crest ? <img src={info[k].crest} alt="" /> : info[k].init}
        {possession === k && <span className="ph-ball"><BallIcon size={26} /></span>}
      </button>
      <span className="ph-tn">{info[k].name}</span>
      {dotsRow(k)}
    </div>
  );

  const PlayIcon = ctl.running ? Pause : Play;
  const assistCandidates = assistFor
    ? courtPlayers.filter((p) => !p.excluded && !p.disqualified && p.id !== assistFor.scorerId).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    : [];
  const eventWho = (e) => (e.playerIds.length === 1 && state.players[e.playerIds[0]] ? ` · #${state.players[e.playerIds[0]].number} ${state.players[e.playerIds[0]].name}` : '');

  const quickRow = (t) => (
    <div className="ph-qk" key={t}>
      <span>{t === 'own' ? 'Nos' : 'Rival'}</span>
      <button type="button" disabled={!isRunning} onClick={() => open({ kind: 'pick', action: 'steal', team: t, step: 1 })}>Robo</button>
      <button type="button" disabled={!isRunning} onClick={() => open({ kind: 'pick', action: 'turnover', team: t, step: 1 })}>Pérdida</button>
      <button type="button" disabled={!isRunning} onClick={() => open({ kind: 'pick', action: 'sanction', team: t, step: 1 })}>Sanción</button>
      <button type="button" disabled={!isRunning} onClick={() => fl.passive(t)}>Pasivo</button>
    </div>
  );

  return (
    <div className="ph-home">
      <div className="ph-hb">
        <button type="button" className="ph-ib" onClick={onBack}><ArrowLeft size={14} /> PARTIDOS</button>
        <span className="ph-pp">{ctl.longLabel(ctl.ended ? clock.period + 1 : clock.period)}</span>
        <button type="button" className="ph-ib ph-ib--r" onClick={ctl.handleUndo} disabled={!store.canUndo}><Undo2 size={14} /> DESHACER</button>
      </div>

      <div className="ph-sb">
        {teamBlock(sides[0])}
        <div className="ph-mid">
          <span className="ph-clk">
            {display.main}
            {display.extra && <span className="ph-extra">{display.extra}</span>}
          </span>
          <div className="ph-sc">
            <span className={`ph-sc-${info[sides[0]].cls}`}>{info[sides[0]].score}</span>
            <span className="ph-sc-s">–</span>
            <span className={`ph-sc-${info[sides[1]].cls}`}>{info[sides[1]].score}</span>
          </div>
        </div>
        {teamBlock(sides[1])}
      </div>

      <div className="ph-ctl">
        <button type="button" className={`ph-ic ph-ic--${ctl.playTone === 'pause' ? 'p' : 'g'}`} onClick={ctl.onPlay} aria-label={ctl.playLabel} title={ctl.playLabel}>
          <PlayIcon size={18} fill="currentColor" />
        </button>
        {ctl.ended ? (
          <button type="button" className="ph-ic" onClick={store.togglePause} aria-label={`Reanudar ${ctl.shortLabel(clock.period)}`} title="Reanudar (si se terminó por error)"><RotateCcw size={16} /></button>
        ) : (
          <button type="button" className="ph-ic ph-ic--s" onClick={ctl.isLastPeriod ? ctl.handleFinish : ctl.handleEndPeriod} disabled={ctl.idle} aria-label={ctl.stopLabel} title={ctl.stopLabel}><Square size={16} fill="currentColor" /></button>
        )}
        <button type="button" className="ph-camb" disabled={!state.canSubstitute} onClick={() => open({ kind: 'swap', outs: [], ins: [] })}>CAMBIO</button>
        <button type="button" className="ph-camb ph-camb--s" onClick={() => open({ kind: 'stats' })}>ESTADÍSTICAS</button>
      </div>

      {ctl.idle && <p className="ph-idle">Pulsa ▶ para iniciar el partido y poder anotar.</p>}
      {ctl.ended && (
        <div className="ph-endp">
          <p>Fin del {ctl.longLabel(clock.period)}</p>
          {alevinRules && (
            <button type="button" className={`ph-endbtn${nextLineupChosen ? ' ph-endbtn--ok' : ''}`} onClick={onNeedLineup}>
              {nextLineupChosen ? `Equipo titular del ${ctl.shortLabel(clock.period + 1)} elegido · revisar` : `Introduce el equipo titular del ${ctl.longLabel(clock.period + 1)}`}
            </button>
          )}
          <small>Puedes hacer cambios (botón CAMBIO). El ▶ inicia el {ctl.longLabel(clock.period + 1)}.</small>
        </div>
      )}

      <div className="ph-big">
        <button type="button" className="ph-bigb ph-bigb--o" disabled={!isRunning} onClick={() => setShotSide('own')}>LANZAMIENTO</button>
        <button type="button" className="ph-bigb ph-bigb--r" disabled={!isRunning} onClick={() => setShotSide('rival')}>LANZAMIENTO RIVAL</button>
      </div>

      {quickRow('own')}
      {quickRow('rival')}

      <div className="ph-sr">
        <span>Sanción</span><em className="ph-tt ph-tt--riv">Rival</em>
        {sanctioned.length > 0 ? <DorsalChips shortcuts={sanctioned} statusOf={statusOf} selected={null} onPick={() => {}} /> : <small>nadie</small>}
      </div>
      <div className="ph-sr">
        <span>Sanción</span><em className="ph-tt">Nos</em>
        {ownSanctioned.length > 0 ? ownSanctioned.map((p) => {
          const tag = sanctionTag(p);
          return <span key={p.id} className={`ph-schip ph-schip--${tag.kind}`}>{p.number}<small>{tag.text}</small></span>;
        }) : <small>nadie</small>}
      </div>

      <div className="ph-last">
        <h3 className="ph-h">Últimas acciones</h3>
        {recent.length === 0 && <div className="ph-note">Todavía no hay acciones.</div>}
        {recent.map((e) => (
          <div key={e.id}><b>{ctl.shortLabel(e.period || 1)}</b>{e.label}{eventWho(e)}</div>
        ))}
      </div>

      <div className="ph-more">
        <span>Más:</span>
        {[['datos', 'Datos (clásica)'], ['jugadores', 'Jugadores'], ['partido', 'Partido'], ['acciones', 'Acciones'], ['cronologia', 'Cronología']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => onMore(key)}>{label}</button>
        ))}
      </div>

      {sheet?.kind === 'pick' && <Sheet title={`${ACTION_TITLE[sheet.action]} · ${sheet.team === 'own' ? 'Nos' : 'Rival'}`} onClose={close}>{renderPick()}</Sheet>}
      {sheet?.kind === 'swap' && <Sheet title="Cambio" onClose={close}>{renderSwap()}</Sheet>}
      {sheet?.kind === 'stats' && <Sheet title="Estadísticas" onClose={close} full>{statsNode}</Sheet>}

      {shotSide && (
        <ShotPanel
          side={shotSide}
          scale={scale}
          ownName={ownTeamName}
          rivalName={rivalName}
          courtPlayers={courtPlayers}
          benchPlayers={benchPlayers}
          shortcuts={shortcuts}
          statusOf={statusOf}
          onSubmit={submitShot}
          onCancel={() => setShotSide(null)}
        />
      )}

      {fl.done && !sheet && !shotSide && (
        <div className="ph-toast" role="status">
          <div className="ph-toast-l1">
            <span className="ph-toast-ok">Registrado</span>
            <b>{fl.done.text}</b>
            {fl.done.detail && <span className="ph-toast-dim">{fl.done.detail}</span>}
            <span className="ph-toast-poss">{fl.done.poss}</span>
          </div>
          <div className="ph-toast-l2">
            {fl.done.assistable && assistFor && (
              <>
                <span>¿Asistente?</span>
                {assistCandidates.map((p) => (
                  <button key={p.id} type="button" className="ph-achip" onClick={() => { onAssist(p.id); fl.setDone(null); }} aria-label={`Asistencia de ${p.number} ${p.name}`}>#{p.number}</button>
                ))}
                <button type="button" className="ph-link" onClick={() => { onAssist(null); fl.setDone(null); }}>Sin asistente</button>
              </>
            )}
            <button type="button" className="ph-link ph-link--undo" onClick={fl.undoLast}>Deshacer</button>
          </div>
        </div>
      )}
    </div>
  );
}
