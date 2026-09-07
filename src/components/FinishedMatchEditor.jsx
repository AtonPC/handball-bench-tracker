import { useMemo, useState } from 'react';
import { useMatchEditor } from '../hooks/useMatchEditor';
import { useRivalGoals } from '../hooks/useRivalGoals';
import { SHOT_ZONES, GOAL_ZONES } from '../shotZones';

const emptyRivalGoal = { number: '', minute: '', shotZone: '', goalZone: '' };

export default function FinishedMatchEditor({ store, onBack }) {
  const { state, matchId } = store;
  const { updateMatchInfo, updatePlayerStats, addRivalGoalRecord, removeRivalGoalRecord } = useMatchEditor(matchId);
  const rivalGoals = useRivalGoals(matchId);

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
  const [playerDrafts, setPlayerDrafts] = useState(() => {
    const map = {};
    for (const p of players) {
      map[p.id] = {
        goals: p.goals,
        shots: p.shots,
        recoveries: p.recoveries,
        losses: p.losses,
        exclusionsCount: p.exclusionsCount || 0,
        disqualified: !!p.disqualified,
        minutes: Math.round((p.accumulatedMs || 0) / 60000),
      };
    }
    return map;
  });
  const [savedPlayerId, setSavedPlayerId] = useState(null);
  const [newRivalGoal, setNewRivalGoal] = useState(emptyRivalGoal);

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
      recoveries: Number(d.recoveries) || 0,
      losses: Number(d.losses) || 0,
      exclusionsCount: Number(d.exclusionsCount) || 0,
      disqualified: d.disqualified,
      accumulatedMs: (Number(d.minutes) || 0) * 60000,
    });
    setSavedPlayerId(id);
    setTimeout(() => setSavedPlayerId(null), 2000);
  }

  async function handleAddRivalGoal(e) {
    e.preventDefault();
    if (!newRivalGoal.number || !newRivalGoal.minute) return;
    await addRivalGoalRecord({
      number: Number(newRivalGoal.number),
      minute: Number(newRivalGoal.minute),
      period: 1,
      shotZone: newRivalGoal.shotZone || null,
      goalZone: newRivalGoal.goalZone || null,
    });
    setNewRivalGoal(emptyRivalGoal);
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
          Si cambias el marcador rival, recuerda que la lista de "Goles rivales" de abajo no se ajusta sola —
          añade o borra ahí los goles que correspondan para que cuadren.
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
                <th>Recup.</th>
                <th>Pérdidas</th>
                <th>Excl.</th>
                <th>Expulsado</th>
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
                    <td><input className="player-form-input player-form-input--number" type="number" value={d.recoveries} onChange={(e) => updateDraft(p.id, 'recoveries', e.target.value)} /></td>
                    <td><input className="player-form-input player-form-input--number" type="number" value={d.losses} onChange={(e) => updateDraft(p.id, 'losses', e.target.value)} /></td>
                    <td><input className="player-form-input player-form-input--number" type="number" value={d.exclusionsCount} onChange={(e) => updateDraft(p.id, 'exclusionsCount', e.target.value)} /></td>
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

        <h3 className="stats-section-title">Goles rivales</h3>
        <div className="admin-list">
          {rivalGoals.map((g) => (
            <div key={g.id} className="admin-row">
              <div className="admin-user-info">
                <span className="admin-user-name">#{g.number} — minuto {g.minute}'</span>
                <span className="admin-user-email">{g.shotZone || '—'} · {g.goalZone || '—'}</span>
              </div>
              <button className="btn btn-timeout btn-danger-text" onClick={() => removeRivalGoalRecord(g.id)}>Borrar</button>
            </div>
          ))}
          {rivalGoals.length === 0 && <p className="modal-hint">No hay goles rivales con detalle registrados.</p>}
        </div>

        <form className="player-form" onSubmit={handleAddRivalGoal}>
          <p className="modal-hint" style={{ margin: 0 }}>Añadir gol rival</p>
          <input
            className="player-form-input player-form-input--number"
            type="number"
            placeholder="Dorsal"
            value={newRivalGoal.number}
            onChange={(e) => setNewRivalGoal({ ...newRivalGoal, number: e.target.value })}
          />
          <input
            className="player-form-input player-form-input--number"
            type="number"
            placeholder="Minuto"
            value={newRivalGoal.minute}
            onChange={(e) => setNewRivalGoal({ ...newRivalGoal, minute: e.target.value })}
          />
          <select className="player-form-input" value={newRivalGoal.shotZone} onChange={(e) => setNewRivalGoal({ ...newRivalGoal, shotZone: e.target.value })}>
            <option value="">Zona de lanzamiento (opcional)</option>
            {SHOT_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <select className="player-form-input" value={newRivalGoal.goalZone} onChange={(e) => setNewRivalGoal({ ...newRivalGoal, goalZone: e.target.value })}>
            <option value="">Zona de entrada (opcional)</option>
            {GOAL_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <button className="btn btn-clock btn-start" type="submit">Añadir</button>
        </form>
      </div>
    </div>
  );
}
