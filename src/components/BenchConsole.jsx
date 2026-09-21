import { useState } from 'react';
import { ClipboardList, GitCompare, History, Target, Users } from 'lucide-react';
import MatchHeader from './MatchHeader';
import PlayerRow from './PlayerRow';
import RivalPanel from './RivalPanel';
import SubstitutionModal from './SubstitutionModal';
import RivalShotModal from './RivalShotModal';
import DorsalNumberModal from './DorsalNumberModal';
import ShotDetailModal from './ShotDetailModal';
import SaverChooserModal from './SaverChooserModal';
import PlayerPickerModal from './PlayerPickerModal';
import ReducedEntry from './ReducedEntry';
import MatchQuickStats from './MatchQuickStats';
import MatchSummaryView from './MatchSummaryView';
import TabletSummary from './TabletSummary';
import ActionStatsView from './ActionStatsView';
import ConsoleChronology from './ConsoleChronology';
import LineupModal from './LineupModal';
import ShotPanel from './ShotPanel';
import AssistToast from './AssistToast';
import { useRivalExclusionsLive, summarizeRivalExclusions } from '../hooks/useRivalExclusions';
import { useBoardScale, useIsTablet } from '../hooks/useIsPhone';
import TabletConsole from './TabletConsole';
import MultiSubstitutionModal from './MultiSubstitutionModal';
import { useRivalMisses } from '../hooks/useRivalMisses';
import { useRivalYellowCards } from '../hooks/useRivalYellowCards';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useShotEvents } from '../hooks/useShotEvents';
import { useSaveEvents } from '../hooks/useSaveEvents';
import { useTeamActionEvents } from '../hooks/useTeamActionEvents';
import { teamColorStyle } from '../utils/teamColors';
import { periodLongLabel, periodShortLabel } from '../utils/periods';
import { missKindOf } from '../shotZones';
import { lineupAdvice, orderLineup, validateLineup } from '../utils/lineups';
import { countRivalDorsals, rivalDorsalShortcuts, rivalDorsalStatus } from '../utils/rivalDorsals';

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
  { key: 'cronologia', label: 'Cronología', icon: History },
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
  // LANZAMIENTO (pantalla única para anotar cualquier tiro) y el aviso opcional
  // de asistente que sale tras un gol nuestro.
  const [shotPanel, setShotPanel] = useState(null); // { side: 'own' | 'rival' }
  const [assistFor, setAssistFor] = useState(null); // { goalId, scorerId }
  const boardScale = useBoardScale();
  const isTablet = useIsTablet();
  const [showMultiSub, setShowMultiSub] = useState(false);
  // Con la disposición de tablet no hay pestañas superiores ni vistas de móvil.
  const phoneView = isTablet ? null : view;
  const [showRivalGoalModal, setShowRivalGoalModal] = useState(false);
  const [showRivalMissModal, setShowRivalMissModal] = useState(false);
  const [showRivalExclusionModal, setShowRivalExclusionModal] = useState(false);
  const [showRivalYellowCardModal, setShowRivalYellowCardModal] = useState(false);
  const [shotDetailFor, setShotDetailFor] = useState(null); // { playerId, kind: 'goal'|'miss' }
  const [saveDetailForId, setSaveDetailForId] = useState(null);
  // Fallo rival por parada que espera a que se elija qué portero la paró
  // (solo cuando no hay exactamente un portero en pista).
  const [pendingRivalSave, setPendingRivalSave] = useState(null);
  // Gol rival de 7 metros que espera a saber qué jugador nuestro cometió la
  // falta (se registra al elegir, o al omitir).
  const [pendingRivalSevenGoal, setPendingRivalSevenGoal] = useState(null);
  // Diálogo del equipo titular del siguiente periodo (opcional).
  const [showLineupModal, setShowLineupModal] = useState(false);
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
  const teamActions = useTeamActionEvents(matchId);

  const courtPlayers = state.courtSlots.map((id) => state.players[id]).filter(Boolean);
  const benchPlayers = state.bench.map((id) => state.players[id]).filter(Boolean);
  const disqualifiedPlayers = Object.values(state.players).filter((p) => p.disqualified);
  // Igual que en FollowerHome/FollowerMatchDetail: jugadores del PARTIDO,
  // no de la plantilla, es lo que espera ActionStatsView.
  const actionPlayers = Object.values(state.players).sort((a, b) => a.number - b.number);

  // Accesos directos de dorsales rivales: los que ya se han usado en este
  // partido (más usados primero) y, si quedan huecos, la lista de partida.
  const rivalExclusionSummary = summarizeRivalExclusions(rivalExclusionsLive);
  const rivalShortcuts = rivalDorsalShortcuts({
    counts: countRivalDorsals(rivalGoals, rivalMisses, rivalExclusionsLive, rivalYellowCards),
    initial: state.rivalDorsals,
    limit: 6,
  });
  const rivalStatusOf = (number) => rivalDorsalStatus(number, rivalExclusionSummary, rivalYellowCards);
  // Dorsales rivales con sanción (roja, excluido ahora o amarilla), para la zona «Sancionados».
  const rivalSanctioned = [...new Set([...rivalExclusionSummary.map((e) => String(e.number)), ...rivalYellowCards.map((y) => String(y.number))])]
    .map((number) => ({ number, count: 0, st: rivalStatusOf(number) }))
    .filter((d) => d.st.red || d.st.excludedMs || d.st.yellow)
    .sort((a, b) => Number(b.st.red) - Number(a.st.red) || Number(!!b.st.excludedMs) - Number(!!a.st.excludedMs) || Number(a.number) - Number(b.number))
    .map(({ number, count }) => ({ number, count }));

  // Resultado del panel LANZAMIENTO → se anota con las funciones de siempre del
  // store (mismos datos que los diálogos clásicos, más contraataque y falta).
  function handleShotSubmit(r) {
    setShotPanel(null);
    // La pelota pasa al otro equipo (se corrige tocando el escudo).
    store.setPossession(r.side === 'own' ? 'rival' : 'own');
    if (r.side === 'own') {
      const detail = { shotZone: r.shotZone, goalZone: r.goalZone, counter: r.counter };
      let shotId = null;
      if (r.kind === 'goal') {
        shotId = store.playerGoalWithDetail(r.shooter, detail);
        // Un gol de 7 metros no lleva asistente.
        if (shotId && r.shotZone !== '7 metros') setAssistFor({ goalId: shotId, scorerId: r.shooter });
      } else {
        // Parada del portero rival o fallo (fuera, palo...): en los dos casos es un fallo nuestro.
        shotId = store.playerShotWithDetail(r.shooter, detail);
      }
      if (shotId && r.shotZone === '7 metros' && r.foul) store.rivalSevenMeter(Number(r.foul), shotId);
      return;
    }
    const detail = { number: Number(r.shooter), shotZone: r.shotZone, goalZone: r.goalZone, counter: r.counter };
    const foulPlayerId = r.shotZone === '7 metros' ? r.foul : null;
    if (r.kind === 'goal') {
      store.rivalGoalWithDetail({ ...detail, foulPlayerId });
    } else if (r.kind === 'save') {
      // La paró nuestro portero: con uno solo en pista se le acredita directamente.
      if (soleGoalkeeper) store.registerRivalShot({ ...detail, saverId: soleGoalkeeper.id, foulPlayerId });
      else setPendingRivalSave({ ...detail, foulPlayerId });
    } else {
      store.registerRivalShot({ ...detail, saverId: null, foulPlayerId });
    }
  }

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
    const saved = missKindOf(detail.goalZone) === 'saved';
    if (!saved) {
      store.registerRivalShot({ ...detail, saverId: null });
    } else if (soleGoalkeeper) {
      store.registerRivalShot({ ...detail, saverId: soleGoalkeeper.id });
    } else {
      setPendingRivalSave(detail);
    }
  }

  // Entre periodos (tras terminar uno), la barra ofrece elegir el equipo
  // titular del siguiente. Con los avisos de Alevín puestos, además avisa si
  // los que hay ahora en pista repiten a los que empezaron el periodo que
  // acaba de terminar — sin bloquear nunca iniciar el siguiente.
  const betweenPeriods = state.clock.status === 'paused' && state.clock.periodEnded && state.clock.period < state.clock.periodCount;
  const nextShort = periodShortLabel(state.clock.period + 1, state.clock.periodCount);
  let startersAdvice = null;
  if (betweenPeriods && state.alevinRules) {
    const goalkeeper = state.courtSlots.find((id) => state.players[id]?.isGK);
    const nextIds = orderLineup(state.courtSlots, goalkeeper);
    const check = validateLineup({ ids: nextIds, prevIds: state.lineups[state.clock.period] || [] });
    startersAdvice = lineupAdvice({ repeated: check.repeated, convocados: state.convocados });
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

  const tabletActions = {
    submitShot: handleShotSubmit,
    recovery: (id) => store.playerRecovery(id, 1),
    // Robo / pérdida de un equipo; el jugador (o el dorsal rival) es opcional.
    steal: (team, who) => (team === 'own' && who
      ? store.playerRecovery(who, 1)
      : store.teamAction({ kind: 'steal', team, ...(team === 'own' ? { playerId: null } : { number: who }) })),
    turnover: (team, who) => store.teamAction({ kind: 'turnover', team, ...(team === 'own' ? { playerId: who } : { number: who }) }),
    passive: (team) => store.teamAction({ kind: 'passive', team }),
    exclusion: (id) => handleExclusionStart(id),
    yellow: (id) => store.playerYellowCard(id),
    rivalExclusion: (number) => store.rivalExclusion(Number(number)),
    rivalYellow: (number) => {
      if (rivalYellowCards.some((e) => e.number === Number(number))) {
        alert(`El dorsal #${number} ya tiene tarjeta amarilla en este partido.`);
        return;
      }
      store.rivalYellowCard(Number(number));
    },
    openSubstitution: () => setShowMultiSub(true),
  };

  return (
    <div className="bench-console" style={teamColorStyle(team)}>
      {!isTablet && (
        <>
      <MatchHeader store={store} team={team} onBack={onBack} onFinish={onFinish} onNeedLineup={() => setShowLineupModal(true)} />

      {!isRunning && (
        <div className="match-not-running-banner">
          <span>
            {state.clock.status === 'idle'
              ? `⏸ PARTIDO NO INICIADO — pulsa ▶ (INICIAR ${periodShortLabel(1, state.clock.periodCount)}) arriba para poder anotar`
              : betweenPeriods
                ? `⏸ FIN DEL ${periodLongLabel(state.clock.period, state.clock.periodCount).toUpperCase()} — ${state.alevinRules && !state.lineups[state.clock.period + 1] ? `elige el equipo titular del ${nextShort} para poder iniciarlo` : `pulsa ▶ (INICIAR ${nextShort}) arriba para seguir`}`
                : '⏸ PARTIDO EN PAUSA — pulsa ▶ arriba para poder seguir anotando'}
          </span>
          {betweenPeriods && (
            <button type="button" className="banner-btn" onClick={() => setShowLineupModal(true)}>
              {state.lineups[state.clock.period + 1] ? `EQUIPO TITULAR DEL ${nextShort} ✓ · VER / CAMBIAR` : `ELEGIR EQUIPO TITULAR DEL ${nextShort}`}
            </button>
          )}
          {betweenPeriods && startersAdvice && (
            <span className="banner-advice">
              ⚠ {startersAdvice.level === 'warn'
                ? `${startersAdvice.repeated.map((id) => '#' + (state.players[id]?.number ?? '?')).join(', ')} ya empezó el ${periodShortLabel(state.clock.period, state.clock.periodCount)}: con ${state.convocados} convocados no se debería repetir (es solo un aviso, puedes iniciar igualmente)`
                : `Repites ${startersAdvice.repeated.length} del ${periodShortLabel(state.clock.period, state.clock.periodCount)}; con ${state.convocados} convocados hay que repetir como mínimo ${startersAdvice.needed}`}
            </span>
          )}
        </div>
      )}

        </>
      )}

      {!isTablet && (
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
      )}

      {phoneView === 'datos' && (
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

      {phoneView === 'datos' && entryMode === 'reduced' && (
        <ReducedEntry
          state={state}
          isRunning={isRunning}
          lastEvent={store.lastEvent}
          rivalExclusionsLive={rivalExclusionsLive}
          actions={{
            shot: (side) => setShotPanel({ side }),
            recovery: (id) => store.playerRecovery(id, 1),
            exclusion: (id) => handleExclusionStart(id),
            yellow: (id) => store.playerYellowCard(id),
            substituteMany: store.substituteMany,
            rivalExclusion: () => setShowRivalExclusionModal(true),
            rivalYellow: () => setShowRivalYellowCardModal(true),
            cancelOwnExclusion: (id) => store.cancelExclusion(id),
            cancelRivalExclusion: (eventId) => store.cancelRivalExclusion(eventId),
          }}
        />
      )}

      {phoneView === 'datos' && entryMode === 'classic' && (
        <div className="player-panel">
          <div className="shot-launch-row">
            <button type="button" className="shot-launch-btn shot-launch-btn--own" disabled={!isRunning} onClick={() => setShotPanel({ side: 'own' })}>LANZAMIENTO</button>
            <button type="button" className="shot-launch-btn shot-launch-btn--rival" disabled={!isRunning} onClick={() => setShotPanel({ side: 'rival' })}>LANZAMIENTO RIVAL</button>
          </div>
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

      {phoneView === 'jugadores' && (
        <div className="console-tab-content">
          <MatchQuickStats state={state} />
        </div>
      )}

      {phoneView === 'partido' && (
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

      {phoneView === 'acciones' && (
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

      {showLineupModal && (
        <LineupModal
          period={state.clock.period + 1}
          periodCount={state.clock.periodCount}
          players={state.players}
          lineups={state.lineups}
          alevinRules={state.alevinRules}
          convocados={state.convocados}
          onConfirm={(ids) => {
            const result = store.setPeriodLineup(state.clock.period + 1, ids);
            if (result.ok) setShowLineupModal(false);
            else alert('No se pudo aplicar el equipo titular: el reloj ya no está entre periodos.');
          }}
          onCancel={() => setShowLineupModal(false)}
        />
      )}

      {phoneView === 'cronologia' && (
        <div className="console-tab-content">
          <ConsoleChronology
            matchId={matchId}
            state={state}
            shotEvents={shotEvents}
            saveEvents={saveEvents}
            rivalGoals={rivalGoals}
            rivalMisses={rivalMisses}
            rivalExclusions={rivalExclusionsLive}
            rivalYellowCards={rivalYellowCards}
          />
        </div>
      )}

      {isTablet && (
        <TabletConsole
          store={store}
          team={team}
          onBack={onBack}
          onFinish={onFinish}
          onNeedLineup={() => setShowLineupModal(true)}
          courtPlayers={courtPlayers}
          benchPlayers={benchPlayers.filter((p) => !p.disqualified)}
          shortcuts={rivalShortcuts}
          sanctioned={rivalSanctioned}
          statusOf={rivalStatusOf}
          scale={boardScale}
          isRunning={isRunning}
          actions={tabletActions}
          summaryNode={(
            <TabletSummary
              statePlayers={state.players}
              shotEvents={shotEvents}
              rivalGoals={rivalGoals}
              rivalMisses={rivalMisses}
              rivalExclusions={rivalExclusionsLive}
              rivalYellowCards={rivalYellowCards}
              teamActions={teamActions}
              possessions={state.possessions}
            />
          )}
          chronologyNode={(
            <ConsoleChronology
              matchId={matchId}
              state={state}
              shotEvents={shotEvents}
              saveEvents={saveEvents}
              rivalGoals={rivalGoals}
              rivalMisses={rivalMisses}
              rivalExclusions={rivalExclusionsLive}
              rivalYellowCards={rivalYellowCards}
            />
          )}
          statsNode={(
            <>
              <MatchQuickStats state={state} />
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
            </>
          )}
        />
      )}

      {showMultiSub && (
        <MultiSubstitutionModal
          courtPlayers={courtPlayers}
          benchPlayers={benchPlayers}
          onConfirm={(pairs) => {
            setShowMultiSub(false);
            store.substituteMany(pairs);
          }}
          onCancel={() => setShowMultiSub(false)}
        />
      )}

      {shotPanel && !isTablet && (
        <ShotPanel
          side={shotPanel.side}
          scale={boardScale}
          ownName={state.ownTeamName}
          rivalName={state.rivalName}
          courtPlayers={courtPlayers}
          benchPlayers={benchPlayers.filter((p) => !p.disqualified)}
          shortcuts={rivalShortcuts}
          statusOf={rivalStatusOf}
          onSubmit={handleShotSubmit}
          onCancel={() => setShotPanel(null)}
        />
      )}

      {assistFor && (
        <AssistToast
          scorer={state.players[assistFor.scorerId]}
          candidates={playingNow.filter((p) => p.id !== assistFor.scorerId).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))}
          onPick={(playerId) => {
            store.setGoalAssist(assistFor.goalId, playerId);
            setAssistFor(null);
          }}
          onDismiss={() => setAssistFor(null)}
        />
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
            setShowRivalGoalModal(false);
            // Un gol rival de 7m implica una falta nuestra: se pregunta quién.
            if (detail.shotZone === '7 metros') setPendingRivalSevenGoal(detail);
            else store.rivalGoalWithDetail(detail);
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

      {pendingRivalSevenGoal && (
        <PlayerPickerModal
          title="Gol rival de 7 metros — ¿quién cometió la falta?"
          hint="Los que están en pista ahora. Si ya hubo un cambio, pulsa «Ver suplentes»."
          players={[...courtPlayers].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))}
          extraPlayers={[...benchPlayers].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))}
          extraLabel="Suplentes"
          onSelect={(foulPlayerId) => {
            store.rivalGoalWithDetail({ ...pendingRivalSevenGoal, foulPlayerId });
            setPendingRivalSevenGoal(null);
          }}
          onSkip={() => {
            store.rivalGoalWithDetail(pendingRivalSevenGoal);
            setPendingRivalSevenGoal(null);
          }}
          skipLabel="Registrar el gol sin indicar quién"
          // El gol ya está confirmado: cerrar el diálogo equivale a omitir.
          cancelLabel={null}
          onCancel={() => {
            store.rivalGoalWithDetail(pendingRivalSevenGoal);
            setPendingRivalSevenGoal(null);
          }}
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
