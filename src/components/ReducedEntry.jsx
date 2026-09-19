import { useState } from 'react';
import { Hand, Repeat, RectangleVertical, Target, Timer, X, Zap } from 'lucide-react';
import PlayerPickerModal from './PlayerPickerModal';
import MultiSubstitutionModal from './MultiSubstitutionModal';
import { summarizeRivalExclusions } from '../hooks/useRivalExclusions';
import { formatClock } from '../utils/time';

// Vista REDUCIDA de la consola (2026-09-19), pensada para el móvil: en vez de
// una fila por jugador (que obliga a hacer scroll todo el rato), un botón por
// tipo de acción. Al pulsarlo se elige al jugador de una lista (o, con el
// rival, se teclea el dorsal como siempre) y sigue el mismo flujo que la vista
// clásica — las dos escriben exactamente los mismos datos.
// El rival no tiene CAMBIO ni PARADA (la parada de nuestro portero se anota
// desde nuestro lado, o eligiendo una zona de portería en el FALLO rival), ni
// RECUPERACIÓN (no existe en el modelo): esas quedan solo en la vista clásica,
// igual que el 7 metros cometido.
const OWN_BUTTONS = [
  { key: 'goal', label: 'GOL', icon: Target },
  { key: 'save', label: 'PARADA', icon: Hand },
  { key: 'miss', label: 'FALLO', icon: X },
  { key: 'recovery', label: 'RECUP.', icon: Zap },
  { key: 'exclusion', label: "EXCL. 2'", icon: Timer },
  { key: 'yellow', label: 'AMARILLA', icon: RectangleVertical },
  { key: 'sub', label: 'CAMBIO', icon: Repeat },
];
const RIVAL_BUTTONS = [
  { key: 'goal', label: 'GOL', icon: Target },
  { key: 'miss', label: 'FALLO', icon: X },
  { key: 'exclusion', label: "EXCL. 2'", icon: Timer },
  { key: 'yellow', label: 'AMARILLA', icon: RectangleVertical },
];

// Quién puede recibir cada acción. Solo los que están JUGANDO ahora (en pista,
// ni excluidos ni expulsados); el banquillo no aparece: primero se hace el
// cambio. Igual que en la fila clásica: la parada es solo de portero y la
// recuperación solo de jugadores de campo.
const PICKER_CONFIG = {
  goal: { title: 'GOL — ¿quién ha marcado?', filter: () => true },
  miss: { title: 'FALLO — ¿quién ha fallado?', filter: () => true },
  save: { title: 'PARADA — ¿qué portero?', filter: (p) => p.isGK },
  recovery: { title: 'RECUPERACIÓN — ¿quién?', filter: (p) => !p.isGK },
  exclusion: { title: "EXCLUSIÓN 2' — ¿quién?", filter: () => true },
  yellow: {
    title: 'AMARILLA — ¿quién?',
    filter: () => true,
    disabledReason: (p) => (p.yellowCard ? 'Ya tiene amarilla' : null),
  },
};

export default function ReducedEntry({ state, isRunning, lastEvent, rivalExclusionsLive, actions }) {
  const [picker, setPicker] = useState(null); // clave de PICKER_CONFIG
  const [subOpen, setSubOpen] = useState(false);

  const courtPlayers = state.courtSlots.map((id) => state.players[id]).filter(Boolean);
  const benchPlayers = state.bench.map((id) => state.players[id]).filter(Boolean);
  const playingNow = courtPlayers.filter((p) => !p.excluded && !p.disqualified);

  function pressOwn(key) {
    if (key === 'sub') {
      setSubOpen(true);
      return;
    }
    // Con un solo portero en pista, la parada no necesita elegir a nadie.
    if (key === 'save') {
      const goalkeepers = playingNow.filter(PICKER_CONFIG.save.filter);
      if (goalkeepers.length === 1) {
        actions.save(goalkeepers[0].id);
        return;
      }
    }
    setPicker(key);
  }

  function pressRival(key) {
    if (key === 'goal') actions.rivalGoal();
    else if (key === 'miss') actions.rivalMiss();
    else if (key === 'exclusion') actions.rivalExclusion();
    else if (key === 'yellow') actions.rivalYellow();
  }

  // Sancionados ahora mismo, de un vistazo: propios (excluidos con cuenta atrás
  // o expulsados) y rivales. Tocar uno permite anular la exclusión si fue un
  // error — mismo criterio que los badges de la vista clásica.
  const ownPenalized = courtPlayers.filter((p) => p.excluded || p.disqualified);
  const rivalPenalized = summarizeRivalExclusions(rivalExclusionsLive).filter((e) => e.disqualified || e.activeRemainingMs > 0);

  function cancelOwn(p) {
    if (p.disqualified) return;
    if (confirm(`¿Anular la exclusión del #${p.number} ${p.name}? (marcada por error)`)) actions.cancelOwnExclusion(p.id);
  }
  function cancelRival(entry) {
    if (entry.disqualified) return;
    if (confirm(`¿Anular la última exclusión del dorsal #${entry.number}? (marcada por error)`)) actions.cancelRivalExclusion(entry.lastEventId);
  }

  const lastPlayer = lastEvent?.playerIds?.length === 1 ? state.players[lastEvent.playerIds[0]] : null;
  const cfg = picker ? PICKER_CONFIG[picker] : null;

  return (
    <div className="reduced-entry">
      {(ownPenalized.length > 0 || rivalPenalized.length > 0) && (
        <div className="reduced-status">
          {ownPenalized.map((p) => (
            <button key={p.id} type="button" className="reduced-chip reduced-chip--own" disabled={!isRunning || p.disqualified} onClick={() => cancelOwn(p)}>
              #{p.number} · {p.disqualified ? 'ROJA' : formatClock(p.exclusionRemainingMs)}
            </button>
          ))}
          {rivalPenalized.map((e) => (
            <button key={`r${e.number}`} type="button" className="reduced-chip reduced-chip--rival" disabled={!isRunning || e.disqualified} onClick={() => cancelRival(e)}>
              R#{e.number} · {e.disqualified ? 'ROJA' : formatClock(e.activeRemainingMs)}
            </button>
          ))}
        </div>
      )}

      <section className="reduced-group reduced-group--own">
        <h4>{state.ownTeamName}</h4>
        <div className="reduced-grid">
          {OWN_BUTTONS.map((b) => (
            <button
              key={b.key}
              type="button"
              className={`reduced-btn reduced-btn--${b.key}`}
              // El cambio también se puede hacer entre periodos (reloj parado
              // tras FIN de un cuarto); el resto exige el reloj en marcha.
              disabled={b.key === 'sub' ? !state.canSubstitute : !isRunning}
              onClick={() => pressOwn(b.key)}
            >
              <b.icon size={22} />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="reduced-group reduced-group--rival">
        <h4>{state.rivalName}</h4>
        <div className="reduced-grid">
          {RIVAL_BUTTONS.map((b) => (
            <button key={b.key} type="button" className={`reduced-btn reduced-btn--${b.key}`} disabled={!isRunning} onClick={() => pressRival(b.key)}>
              <b.icon size={22} />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="reduced-last">
        {lastEvent
          ? <>Última acción: <strong>{lastEvent.label}{lastPlayer ? ` — #${lastPlayer.number} ${lastPlayer.name}` : ''}</strong> (DESHACER arriba la quita)</>
          : 'Todavía no se ha anotado nada.'}
      </p>

      {picker && (
        <PlayerPickerModal
          title={cfg.title}
          players={[...playingNow].filter(cfg.filter).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))}
          disabledReason={cfg.disabledReason}
          onSelect={(id) => {
            setPicker(null);
            actions[picker](id);
          }}
          onCancel={() => setPicker(null)}
        />
      )}

      {subOpen && (
        <MultiSubstitutionModal
          courtPlayers={courtPlayers}
          benchPlayers={benchPlayers}
          onConfirm={(pairs) => {
            setSubOpen(false);
            actions.substituteMany(pairs);
          }}
          onCancel={() => setSubOpen(false)}
        />
      )}
    </div>
  );
}
