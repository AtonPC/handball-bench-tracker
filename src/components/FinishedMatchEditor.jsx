import { useEffect, useMemo, useState } from 'react';
import { useMatchEditor } from '../hooks/useMatchEditor';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { useRivalMisses } from '../hooks/useRivalMisses';
import { useRivalExclusions } from '../hooks/useRivalExclusions';
import { useRivalSevenMeters } from '../hooks/useRivalSevenMeters';
import { useRivalYellowCards } from '../hooks/useRivalYellowCards';
import { useExclusionEvents } from '../hooks/useExclusionEvents';
import { useYellowCardEvents } from '../hooks/useYellowCardEvents';
import { useShotEvents } from '../hooks/useShotEvents';
import { useSaveEvents } from '../hooks/useSaveEvents';
import { useRecoveryEvents } from '../hooks/useRecoveryEvents';
import { checkMatchCoherence } from '../utils/coherence';
import MatchActionsEditor from './MatchActionsEditor';

// Huella de los contadores de un jugador que edita esta pantalla (los
// minutos no: ninguna corrección de acciones los toca).
function counterSignature(p) {
  return [p.goals, p.shots, p.saves || 0, p.recoveries, p.exclusionsCount || 0, !!p.yellowCard, !!p.disqualified].join('|');
}

export default function FinishedMatchEditor({ store, onBack }) {
  const { state, matchId } = store;
  const { updateMatchInfo, updatePlayerStats, applyPlan } = useMatchEditor(matchId);
  const rivalGoals = useRivalGoals(matchId);
  const rivalMisses = useRivalMisses(matchId);
  const shotEvents = useShotEvents(matchId);
  const saveEvents = useSaveEvents(matchId);
  const recoveryEvents = useRecoveryEvents(matchId);
  const exclusionEvents = useExclusionEvents(matchId);
  const yellowCardEvents = useYellowCardEvents(matchId);
  const rivalExclusions = useRivalExclusions(matchId);
  const rivalSevenMeters = useRivalSevenMeters(matchId);
  const rivalYellowCards = useRivalYellowCards(matchId);
  const [showCoherence, setShowCoherence] = useState(false);

  const [matchInfo, setMatchInfo] = useState({
    rivalName: state.rivalName,
    isHome: state.isHome,
    venue: state.venue,
    scheduledAt: state.scheduledAt ? new Date(state.scheduledAt).toISOString().slice(0, 16) : '',
  });
  const [matchInfoSaved, setMatchInfoSaved] = useState(false);

  const [score, setScore] = useState({ own: state.score.own, rival: state.score.rival });
  const [scoreSaved, setScoreSaved] = useState(false);

  const players = useMemo(
    () => Object.values(state.players).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [state.players]
  );
  const [playerDrafts, setPlayerDrafts] = useState({});

  // El marcador de arriba es un borrador: se vuelve a rellenar cuando el
  // marcador real cambia por otra vía (p. ej. al borrar un gol en "Acciones
  // del partido"), para que un "Guardar marcador" posterior no lo revierta.
  useEffect(() => {
    setScore({ own: state.score.own, rival: state.score.rival });
  }, [state.score.own, state.score.rival]);

  // La subcolección de jugadores del partido llega por su propio listener,
  // que puede resolver un instante después que el documento del partido —
  // por eso los borradores se rellenan aquí (reactivo), no en el useState
  // inicial, para no quedarse con la tabla vacía si llegan tarde. Se crea
  // el borrador de quien no lo tenga, y se rehace el de quien tenga los
  // contadores reales distintos de aquellos con los que se creó (`_sig`):
  // una corrección en "Acciones del partido" los cambia, y un "Guardar"
  // sobre un borrador viejo los revertiría. Sin cambios reales, no pisa
  // ediciones en curso.
  useEffect(() => {
    setPlayerDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of players) {
        const sig = counterSignature(p);
        if (next[p.id] && next[p.id]._sig === sig) continue;
        changed = true;
        next[p.id] = {
          _sig: sig,
          goals: p.goals,
          shots: p.shots,
          saves: p.saves || 0,
          recoveries: p.recoveries,
          exclusionsCount: p.exclusionsCount || 0,
          yellowCard: !!p.yellowCard,
          disqualified: !!p.disqualified,
          minutes: Math.round((p.accumulatedMs || 0) / 60000),
        };
      }
      return changed ? next : prev;
    });
  }, [players]);
  const [savedPlayerId, setSavedPlayerId] = useState(null);

  function updateDraft(id, field, value) {
    setPlayerDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveMatchInfo(e) {
    e.preventDefault();
    await updateMatchInfo({
      rivalName: matchInfo.rivalName.trim(),
      isHome: matchInfo.isHome,
      venue: matchInfo.venue.trim(),
      scheduledAt: matchInfo.scheduledAt ? new Date(matchInfo.scheduledAt).getTime() : state.scheduledAt,
    });
    setMatchInfoSaved(true);
    setTimeout(() => setMatchInfoSaved(false), 2000);
  }

  async function saveScore(e) {
    e.preventDefault();
    await updateMatchInfo({ score: { own: Number(score.own) || 0, rival: Number(score.rival) || 0 } });
    setScoreSaved(true);
    setTimeout(() => setScoreSaved(false), 2000);
  }

  async function savePlayer(id) {
    const d = playerDrafts[id];
    await updatePlayerStats(id, {
      goals: Number(d.goals) || 0,
      shots: Number(d.shots) || 0,
      saves: Number(d.saves) || 0,
      recoveries: Number(d.recoveries) || 0,
      exclusionsCount: Number(d.exclusionsCount) || 0,
      yellowCard: d.yellowCard,
      disqualified: d.disqualified,
      accumulatedMs: (Number(d.minutes) || 0) * 60000,
    });
    setSavedPlayerId(id);
    setTimeout(() => setSavedPlayerId(null), 2000);
  }

  return (
    <div className="app-shell">
      <nav className="admin-nav">
        <button className="btn btn-logout" onClick={onBack}>← PARTIDOS</button>
        <span className="admin-nav-role">Editar partido finalizado</span>
      </nav>

      <div className="admin-panel">
        <p className="warning-banner">
          Este partido ya está finalizado. Los cambios de aquí abajo modifican directamente las estadísticas
          guardadas del jugador y del equipo (incluido el acumulado de la pestaña Estadísticas) — úsalo solo
          para corregir errores de anotación o adaptar el resultado a lo que registró la federación.
        </p>

        <div className="matches-header">
          <p className="modal-hint" style={{ margin: 0 }}>
            Cada dato está a la vez en un contador y en su detalle (cronología, zonas). Comprueba si coinciden.
          </p>
          <button className="btn btn-timeout" onClick={() => setShowCoherence((v) => !v)}>
            {showCoherence ? 'Ocultar comprobación' : 'Comprobar coherencia'}
          </button>
        </div>
        {showCoherence && (() => {
          const issues = checkMatchCoherence({
            players, score: state.score, shotEvents, saveEvents, recoveryEvents, rivalGoals, rivalMisses,
          });
          if (issues.length === 0) return <p className="modal-hint">Todo cuadra: contadores y detalle coinciden.</p>;
          return (
            <>
              <div className="stats-table-wrap">
                <table className="stats-table">
                  <thead><tr><th>Quién</th><th>Qué</th><th>Contador</th><th>Detalle</th></tr></thead>
                  <tbody>
                    {issues.map((i) => (
                      <tr key={`${i.who}-${i.what}`}>
                        <td>{i.who}</td><td>{i.what}</td><td>{i.counter}</td><td>{i.records}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="modal-hint">
                Solo se listan las diferencias; no se corrige nada solo. Es normal que salgan en partidos anotados sin
                detalle de cada acción o con paradas anteriores al 16-09. Los contadores se corrigen aquí abajo.
              </p>
            </>
          );
        })()}

        <h3 className="stats-section-title">Datos del partido</h3>
        <form className="player-form" onSubmit={saveMatchInfo}>
          <input
            className="player-form-input"
            placeholder="Equipo rival"
            value={matchInfo.rivalName}
            onChange={(e) => setMatchInfo({ ...matchInfo, rivalName: e.target.value })}
          />
          <div className="home-away-toggle">
            <button
              type="button"
              className={`btn btn-timeout${matchInfo.isHome ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setMatchInfo({ ...matchInfo, isHome: true })}
            >
              Local
            </button>
            <button
              type="button"
              className={`btn btn-timeout${!matchInfo.isHome ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setMatchInfo({ ...matchInfo, isHome: false })}
            >
              Visitante
            </button>
          </div>
          <input
            className="player-form-input"
            placeholder="Lugar / pabellón"
            value={matchInfo.venue}
            onChange={(e) => setMatchInfo({ ...matchInfo, venue: e.target.value })}
          />
          <input
            className="player-form-input"
            type="datetime-local"
            value={matchInfo.scheduledAt}
            onChange={(e) => setMatchInfo({ ...matchInfo, scheduledAt: e.target.value })}
          />
          <div className="player-form-actions">
            <button className="btn btn-clock btn-start" type="submit">Guardar datos del partido</button>
            {matchInfoSaved && <span className="modal-hint">Guardado.</span>}
          </div>
        </form>

        <h3 className="stats-section-title">Marcador</h3>
        <form className="player-form" onSubmit={saveScore} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="modal-hint" style={{ margin: 0 }}>{state.ownTeamName}</span>
          <input
            className="player-form-input player-form-input--number"
            type="number"
            value={score.own}
            onChange={(e) => setScore({ ...score, own: e.target.value })}
          />
          <span className="modal-hint" style={{ margin: 0 }}>—</span>
          <input
            className="player-form-input player-form-input--number"
            type="number"
            value={score.rival}
            onChange={(e) => setScore({ ...score, rival: e.target.value })}
          />
          <span className="modal-hint" style={{ margin: 0 }}>{state.rivalName}</span>
          <button className="btn btn-clock btn-start" type="submit">Guardar marcador</button>
          {scoreSaved && <span className="modal-hint">Guardado.</span>}
        </form>
        <p className="modal-hint">
          Cambiar el marcador o los contadores a mano NO toca la cronología ni las zonas. Si lo que falla es una
          acción concreta (un gol mal asignado, una zona equivocada), corrígela mejor en "Acciones del partido",
          más abajo: ajusta a la vez el detalle, los contadores y el marcador.
        </p>

        <h3 className="stats-section-title">Estadísticas por jugador</h3>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jugador</th>
                <th>Min.</th>
                <th>Goles</th>
                <th>Fallos</th>
                <th>Paradas</th>
                <th>Recup.</th>
                <th>Excl.</th>
                <th>Amarilla</th>
                <th>Roja</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const d = playerDrafts[p.id];
                if (!d) return null;
                return (
                  <tr key={p.id}>
                    <td>{p.number}</td>
                    <td>{p.name}{p.isGK ? ' (P)' : ''}</td>
                    <td><input className="player-form-input player-form-input--number" type="number" value={d.minutes} onChange={(e) => updateDraft(p.id, 'minutes', e.target.value)} /></td>
                    <td><input className="player-form-input player-form-input--number" type="number" value={d.goals} onChange={(e) => updateDraft(p.id, 'goals', e.target.value)} /></td>
                    <td><input className="player-form-input player-form-input--number" type="number" value={d.shots} onChange={(e) => updateDraft(p.id, 'shots', e.target.value)} /></td>
                    <td><input className="player-form-input player-form-input--number" type="number" value={d.saves} onChange={(e) => updateDraft(p.id, 'saves', e.target.value)} /></td>
                    <td><input className="player-form-input player-form-input--number" type="number" value={d.recoveries} onChange={(e) => updateDraft(p.id, 'recoveries', e.target.value)} /></td>
                    <td><input className="player-form-input player-form-input--number" type="number" value={d.exclusionsCount} onChange={(e) => updateDraft(p.id, 'exclusionsCount', e.target.value)} /></td>
                    <td>
                      <input type="checkbox" checked={d.yellowCard} onChange={(e) => updateDraft(p.id, 'yellowCard', e.target.checked)} />
                    </td>
                    <td>
                      <input type="checkbox" checked={d.disqualified} onChange={(e) => updateDraft(p.id, 'disqualified', e.target.checked)} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-timeout" onClick={() => savePlayer(p.id)}>
                        {savedPlayerId === p.id ? 'Guardado' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <MatchActionsEditor
          state={state}
          players={players}
          applyPlan={applyPlan}
          lists={{ shotEvents, saveEvents, recoveryEvents, exclusionEvents, yellowCardEvents, rivalGoals, rivalMisses, rivalExclusions, rivalSevenMeters, rivalYellowCards }}
        />
      </div>
    </div>
  );
}
