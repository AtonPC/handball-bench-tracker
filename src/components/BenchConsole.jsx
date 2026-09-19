import { useState } from 'react';
import { ClipboardList, GitCompare, Target, Users } from 'lucide-react';
import MatchHeader from './MatchHeader';
import PlayerRow from './PlayerRow';
import RivalPanel from './RivalPanel';
import SubstitutionModal from './SubstitutionModal';
import RivalShotModal from './RivalShotModal';
import DorsalNumberModal from './DorsalNumberModal';
import ShotDetailModal from './ShotDetailModal';
import SaverChooserModal from './SaverChooserModal';
import ReducedEntry from './ReducedEntry';
import MatchQuickStats from './MatchQuickStats';
import MatchSummaryView from './MatchSummaryView';
import ActionStatsView from './ActionStatsView';
import { useRivalExclusionsLive } from '../hooks/useRivalExclusions';
import { useRivalMisses } from '../hooks/useRivalMisses';
import { useRivalYellowCards } from '../hooks/useRivalYellowCards';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useShotEvents } from '../hooks/useShotEvents';
import { useSaveEvents } from '../hooks/useSaveEvents';
import { teamColorStyle } from '../utils/teamColors';
import { periodLongLabel, periodShortLabel } from '../utils/periods';
import { OUT_ZONES } from '../shotZones';

// Menú horizontal de la consola (2026-09-16, mockup "Consola Luminosa"):
// "Datos" es la pantalla de anotar de siempre; las otras tres reutilizan
// tal cual pantallas que ya existían en otro sitio (antes "Estadísticas
// rápidas" era un modal aparte con su propio botón, y "Resumen"/"Acciones"
// solo se veían en la pestaña Estadísticas del staff o en la vista de
// Seguidor) — ahora también se pueden consultar sin salir de la consola
// en directo, sin duplicar ninguna lógica.
const TABS = [
  { key: 'datos', label: 'Datos', icon: ClipboardList },
  { key: 'jugadores', label: 'Jugadores', icon: Users },
  { key: 'partido', label: 'Partido', icon: GitCompare },
  { key: 'acciones', label: 'Acciones', icon: Target },
];

// Forma de anotar en "Datos": la clásica (una fila por jugador) o la reducida
// (un botón por acción, pensada para el móvil). Se recuerda en este
// dispositivo — la tablet y el móvil pueden usar cada uno la suya.
const MODE_KEY = 'benchEntryMode';
function readEntryMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'reduced' ? 'reduced' : 'classic';
  } catch {
    return 'classic';
  }
}
function saveEntryMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Sin almacenamiento disponible (modo privado...): se olvida al recargar.
  }
}

export default function BenchConsole({ store, onBack, onFinish, team }) {
  const { state, matchId } = store;
  const isRunning = state.clock.status === 'running';
  const [view, setView] = useState('datos');
  const [entryMode, setEntryMode] = useState(readEntryMode);
  function changeEntryMode(mode) {
    setEntryMode(mode);
    saveEntryMode(mode);
  }
  const [substitution, setSubstitution] = useState(null); // { outPlayerId, forced }
  const [showRivalGoalModal, setShowRivalGoalModal] = useState(false);
  const [showRivalMissModal, setShowRivalMissModal] = useState(false);
  const [showRivalExclusionModal, setShowRivalExclusionModal] = useState(false);
  const [showRivalYellowCardModal, setShowRivalYellowCardModal] = useState(false);
  const [shotDetailFor, setShotDetailFor] = useState(null); // { playerId, kind: 'goal'|'miss' }
  const [saveDetailForId, setSaveDetailForId] = useState(null);
  // Fallo rival por parada que espera a que se elija qué portero la paró
  // (solo cuando no hay exactamente un portero en pista).
  const [pendingRivalSave, setPendingRivalSave] = useState(null);
  // Solo se pide el dorsal rival que ha cometido la falta cuando metemos
  // NOSOTROS un gol de 7 metros — no hay entrada suelta para el rival, ya
  // que la falta de 7m siempre la sufre el equipo que lanza.
  const [showSevenMeterFoulModal, setShowSevenMeterFoulModal] = useState(false);
  // Id del gol de 7m que originó ese aviso — se guarda en el 7m rival para
  // que, si luego se resta ese gol, el 7m rival se borre con él.
  const [sevenMeterShotId, setSevenMeterShotId] = useState(null);
  const rivalExclusionsLive = useRivalExclusionsLive(matchId);
  const rivalMisses = useRivalMisses(matchId);
  const rivalYellowCards = useRivalYellowCards(matchId);
  // Solo hacían falta para "Datos" antes de tener las pestañas de
  // Partido/Acciones — esas dos reutilizan MatchSummaryView/ActionStatsView
  // tal cual se usan en Estadísticas/Seguidor, que sí necesitan el
  // detalle de cada gol/fallo/parada, no solo el contador agregado.
  const rivalGoals = useRivalGoals(matchId);
  const shotEvents = useShotEvents(matchId);
  const saveEvents = useSaveEvents(matchId);

  const courtPlayers = state.courtSlots.map((id) => state.players[id]).filter(Boolean);
  const benchPlayers = state.bench.map((id) => state.players[id]).filter(Boolean);
  const disqualifiedPlayers = Object.values(state.players).filter((p) => p.disqualified);
  // Igual que en FollowerHome/FollowerMatchDetail: jugadores del PARTIDO,
  // no de la plantilla, es lo que espera ActionStatsView.
  const actionPlayers = Object.values(state.players).sort((a, b) => a.number - b.number);

  // Portero(s) en pista ahora: es a quien se acredita la parada de un Fallo
  // rival cuya zona cae dentro de la portería. Un excluido o expulsado no
  // cuenta: no está jugando.
  const playingNow = courtPlayers.filter((p) => !p.excluded && !p.disqualified);
  const goalkeepersOnCourt = playingNow.filter((p) => p.isGK);
  const soleGoalkeeper = goalkeepersOnCourt.length === 1 ? goalkeepersOnCourt[0] : null;

  // Fallo rival: la zona de portería decide qué se anota. Dentro = lo paró
  // nuestro portero (parada + fallo rival); "Fuera" o sin zona = solo fallo
  // rival. Si hay que acreditar una parada y no hay un único portero claro,
  // se pregunta cuál.
  function handleRivalMissConfirm(detail) {
    setShowRivalMissModal(false);
    const saved = detail.goalZone && !OUT_ZONES.includes(detail.goalZone);
    if (!saved) {
      store.registerRivalShot({ ...detail, saverId: null });
    } else if (soleGoalkeeper) {
      store.registerRivalShot({ ...detail, saverId: soleGoalkeeper.id });
    } else {
      setPendingRivalSave(detail);
    }
  }

  // Al llegar a la 3ª exclusión, se abre el cambio en el acto — nadie sale
  // de pista sin que se pregunte quién entra.
  function handleExclusionStart(playerId) {
    const willDisqualify = store.playerExclusion(playerId);
    if (willDisqualify) {
      setSubstitution({ outPlayerId: playerId, forced: true });
    }
  }

  function handleSelectIncoming(inPlayerId) {
    if (substitution.forced) {
      store.substituteDisqualified(substitution.outPlayerId, inPlayerId);
    } else {
      store.substitute(substitution.outPlayerId, inPlayerId);
    }
    setSubstitution(null);
  }

  return (
    <div className="bench-console" style={teamColorStyle(team)}>
      <MatchHeader store={store} team={team} onBack={onBack} onFinish={onFinish} />

      {!isRunning && (
        <div className="match-not-running-banner">
          {state.clock.status === 'idle'
            ? `⏸ PARTIDO NO INICIADO — pulsa INICIAR ${periodShortLabel(1, state.clock.periodCount)} arriba para poder anotar`
            : state.clock.periodEnded
              ? `⏸ FIN DEL ${periodLongLabel(state.clock.period, state.clock.periodCount).toUpperCase()} — puedes hacer cambios; pulsa INICIAR ${periodShortLabel(state.clock.period + 1, state.clock.periodCount)} arriba para seguir`
              : '⏸ PARTIDO EN PAUSA — pulsa REANUDAR arriba para poder seguir anotando'}
        </div>
      )}

      <div className="console-tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`console-tab-btn${view === t.key ? ' console-tab-btn--active' : ''}`}
            onClick={() => setView(t.key)}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </div>

      {view === 'datos' && (
        <div className="console-mode-bar" role="group" aria-label="Forma de anotar">
          <span>Anotar:</span>
          {[['classic', 'Clásica'], ['reduced', 'Reducida']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`console-mode-btn${entryMode === key ? ' console-mode-btn--active' : ''}`}
              onClick={() => changeEntryMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === 'datos' && entryMode === 'reduced' && (
        <ReducedEntry
          state={state}
          isRunning={isRunning}
          lastEvent={store.lastEvent}
          rivalExclusionsLive={rivalExclusionsLive}
          actions={{
            goal: (id) => setShotDetailFor({ playerId: id, kind: 'goal' }),
            miss: (id) => setShotDetailFor({ playerId: id, kind: 'miss' }),
            save: (id) => setSaveDetailForId(id),
            recovery: (id) => store.playerRecovery(id, 1),
            exclusion: (id) => handleExclusionStart(id),
            yellow: (id) => store.playerYellowCard(id),
            substituteMany: store.substituteMany,
            rivalGoal: () => setShowRivalGoalModal(true),
            rivalMiss: () => setShowRivalMissModal(true),
            rivalExclusion: () => setShowRivalExclusionModal(true),
            rivalYellow: () => setShowRivalYellowCardModal(true),
            cancelOwnExclusion: (id) => store.cancelExclusion(id),
            cancelRivalExclusion: (eventId) => store.cancelRivalExclusion(eventId),
          }}
        />
      )}

      {view === 'datos' && entryMode === 'classic' && (
        <div className="player-panel">
          {courtPlayers.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              matchRunning={isRunning}
              canSubstitute={state.canSubstitute}
              onOpenSubstitution={() => setSubstitution({ outPlayerId: player.id, forced: false })}
              actions={{
                goalInc: () => setShotDetailFor({ playerId: player.id, kind: 'goal' }),
                goalDec: () => store.playerGoal(player.id, -1),
                shotInc: () => setShotDetailFor({ playerId: player.id, kind: 'miss' }),
                shotDec: () => store.playerShot(player.id, -1),
                recoveryInc: () => store.playerRecovery(player.id, 1),
                recoveryDec: () => store.playerRecovery(player.id, -1),
                saveInc: () => setSaveDetailForId(player.id),
                saveDec: () => store.playerSave(player.id, -1),
                exclusionStart: () => handleExclusionStart(player.id),
                exclusionCancel: () => store.cancelExclusion(player.id),
                yellowCardGive: () => store.playerYellowCard(player.id),
                yellowCardCancel: () => store.cancelYellowCard(player.id),
                sevenMeterInc: () => store.playerSevenMeterCommitted(player.id, 1),
                sevenMeterDec: () => store.playerSevenMeterCommitted(player.id, -1),
              }}
            />
          ))}

          <RivalPanel
            rivalName={state.rivalName}
            rivalGoals={state.score.rival}
            rivalMissesCount={rivalMisses.length}
            rivalSavedCount={Math.min(saveEvents.length, rivalMisses.length)}
            rivalExclusionsLive={rivalExclusionsLive}
            rivalYellowCards={rivalYellowCards}
            onGoal={store.rivalGoal}
            onOpenGoalDetail={() => setShowRivalGoalModal(true)}
            onOpenMissDetail={() => setShowRivalMissModal(true)}
            onMissDec={store.rivalMissDec}
            onOpenExclusion={() => setShowRivalExclusionModal(true)}
            onCancelExclusion={store.cancelRivalExclusion}
            onOpenYellowCard={() => setShowRivalYellowCardModal(true)}
            onCancelYellowCard={store.cancelRivalYellowCard}
            matchRunning={isRunning}
          />
        </div>
      )}

      {view === 'jugadores' && (
        <div className="console-tab-content">
          <MatchQuickStats state={state} />
        </div>
      )}

      {view === 'partido' && (
        <div className="console-tab-content">
          <MatchSummaryView
            statePlayers={state.players}
            shotEvents={shotEvents}
            rivalGoals={rivalGoals}
            rivalMisses={rivalMisses}
            rivalExclusions={rivalExclusionsLive}
            ownTeamName={state.ownTeamName}
            rivalName={state.rivalName}
          />
        </div>
      )}

      {view === 'acciones' && (
        <div className="console-tab-content">
          <ActionStatsView
            shotEvents={shotEvents}
            saveEvents={saveEvents}
            rivalGoals={rivalGoals}
            rivalMisses={rivalMisses}
            players={actionPlayers}
            ownTeamName={state.ownTeamName}
            rivalName={state.rivalName}
            ownPrimaryColor={team?.primaryColor}
            ownSecondaryColor={team?.secondaryColor}
          />
        </div>
      )}

      {substitution && (
        <SubstitutionModal
          outPlayer={state.players[substitution.outPlayerId]}
          benchPlayers={benchPlayers}
          disqualifiedPlayers={disqualifiedPlayers.filter((p) => p.id !== substitution.outPlayerId)}
          forced={substitution.forced}
          onSelect={handleSelectIncoming}
          onCancel={() => setSubstitution(null)}
        />
      )}

      {showRivalGoalModal && (
        <RivalShotModal
          kind="goal"
          onConfirm={(detail) => {
            store.rivalGoalWithDetail(detail);
            setShowRivalGoalModal(false);
          }}
          onCancel={() => setShowRivalGoalModal(false)}
        />
      )}

      {showRivalMissModal && (
        <RivalShotModal
          kind="miss"
          saverName={soleGoalkeeper ? `#${soleGoalkeeper.number} ${soleGoalkeeper.name}` : null}
          onConfirm={handleRivalMissConfirm}
          onCancel={() => setShowRivalMissModal(false)}
        />
      )}

      {pendingRivalSave && (
        <SaverChooserModal
          candidates={goalkeepersOnCourt.length > 1
            ? goalkeepersOnCourt
            : [...playingNow].sort((a, b) => Number(!!b.isGK) - Number(!!a.isGK) || a.number - b.number)}
          onSelect={(saverId) => {
            store.registerRivalShot({ ...pendingRivalSave, saverId });
            setPendingRivalSave(null);
          }}
          onWithoutSave={() => {
            store.registerRivalShot({ ...pendingRivalSave, saverId: null });
            setPendingRivalSave(null);
          }}
          onCancel={() => setPendingRivalSave(null)}
        />
      )}

      {showRivalExclusionModal && (
        <DorsalNumberModal
          title="Exclusión rival — ¿qué dorsal?"
          confirmLabel="REGISTRAR EXCLUSIÓN"
          onConfirm={(detail) => {
            store.rivalExclusion(detail.number);
            setShowRivalExclusionModal(false);
          }}
          onCancel={() => setShowRivalExclusionModal(false)}
        />
      )}

      {showRivalYellowCardModal && (
        <DorsalNumberModal
          title="Tarjeta amarilla rival — ¿qué dorsal?"
          confirmLabel="REGISTRAR AMARILLA"
          onConfirm={(detail) => {
            if (rivalYellowCards.some((e) => e.number === detail.number)) {
              alert(`El dorsal #${detail.number} ya tiene tarjeta amarilla en este partido.`);
              return;
            }
            store.rivalYellowCard(detail.number);
            setShowRivalYellowCardModal(false);
          }}
          onCancel={() => setShowRivalYellowCardModal(false)}
        />
      )}

      {shotDetailFor && (
        <ShotDetailModal
          playerName={state.players[shotDetailFor.playerId]?.name}
          kind={shotDetailFor.kind}
          onConfirm={(detail) => {
            if (shotDetailFor.kind === 'goal') {
              const goalId = store.playerGoalWithDetail(shotDetailFor.playerId, detail);
              // El 7m rival solo se registra cuando NOSOTROS marcamos de 7
              // metros: ese gol confirma que hubo falta, y aquí se pregunta
              // qué dorsal rival la cometió (queda como estadística del
              // rival, igual que antes).
              if (detail.shotZone === '7 metros') {
                setSevenMeterShotId(goalId);
                setShowSevenMeterFoulModal(true);
              }
            } else {
              store.playerShotWithDetail(shotDetailFor.playerId, detail);
            }
            setShotDetailFor(null);
          }}
          onCancel={() => setShotDetailFor(null)}
        />
      )}

      {showSevenMeterFoulModal && (
        <DorsalNumberModal
          title="Gol de 7 metros — ¿qué dorsal rival ha cometido la falta?"
          confirmLabel="REGISTRAR 7 METROS"
          onConfirm={(detail) => {
            store.rivalSevenMeter(detail.number, sevenMeterShotId);
            setShowSevenMeterFoulModal(false);
            setSevenMeterShotId(null);
          }}
          onCancel={() => {
            setShowSevenMeterFoulModal(false);
            setSevenMeterShotId(null);
          }}
        />
      )}

      {saveDetailForId && (
        <RivalShotModal
          kind="save"
          playerName={state.players[saveDetailForId]?.name}
          onConfirm={(detail) => {
            store.registerRivalShot({ ...detail, saverId: saveDetailForId });
            setSaveDetailForId(null);
          }}
          onCancel={() => setSaveDetailForId(null)}
        />
      )}
    </div>
  );
}
