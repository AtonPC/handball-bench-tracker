import { useMemo, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { usePlayers } from '../hooks/usePlayers';
import { useTrainings } from '../hooks/useTrainings';
import { useSortableTable } from '../hooks/useSortableTable';
import SortableTh from './SortableTh';
import { rosterDisplayName } from '../utils/followerHelpers';
import { computeAttendanceStats, formatTrainingDate, summarizeTraining, todayDateString } from '../utils/attendance';

function pct(ratio) {
  return ratio == null ? '—' : `${Math.round(ratio * 100)}%`;
}

const STATS_COLUMNS = [
  { key: 'number', label: '#', value: (r) => r.number ?? 0, render: (r) => r.number },
  { key: 'name', label: 'Jugador/a', value: (r) => r.name, render: (r) => r.name },
  { key: 'attended', label: 'Asistidos/Total', value: (r) => r.attended, render: (r) => `${r.attended}/${r.marked}` },
  { key: 'pct', label: '% Asistencia', value: (r) => r.pct ?? -1, render: (r) => pct(r.pct) },
  { key: 'absent', label: 'Faltas', value: (r) => r.absent, render: (r) => r.absent },
  { key: 'leftEarly', label: 'Se fue antes', value: (r) => r.leftEarly, render: (r) => r.leftEarly || '—' },
];

function AttendanceStats({ trainings, players }) {
  const stats = useMemo(() => computeAttendanceStats(trainings, players, rosterDisplayName), [trainings, players]);
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(stats.rows, STATS_COLUMNS, 'number');

  if (trainings.length === 0) {
    return <p className="modal-hint">Todavía no hay entrenamientos. Crea el primero en la pestaña "Entrenamientos".</p>;
  }

  return (
    <>
      <div className="card-grid">
        <div className="card">
          <h4>Entrenamientos</h4>
          <p className="att-big">{stats.trainingsCount}</p>
        </div>
        <div className="card">
          <h4>Asistencia del equipo</h4>
          <p className="att-big">{pct(stats.teamPct)}</p>
        </div>
      </div>
      <p className="modal-hint">
        Asistidos sobre los entrenamientos en los que ese jugador tiene marca (asiste o falta): los "sin marcar" no
        cuentan ni a favor ni en contra. Irse antes de tiempo cuenta como asistido.
      </p>
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              {STATS_COLUMNS.map((c) => (
                <SortableTh key={c.key} label={c.label} columnKey={c.key} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                {STATS_COLUMNS.map((c) => <td key={c.key}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Pasar lista de UN entrenamiento: cada jugador con Asiste / Falta (tocar
// otra vez el mismo botón lo deja "sin marcar") y, si asiste, un aviso
// opcional de que se fue antes, con la hora también opcional.
function RollCall({ training, players, onBack, onSetMark, onSetMarks, onUpdate }) {
  const summary = summarizeTraining(training, players);

  function togglePresent(p) {
    const mark = training.attendance?.[p.id];
    onSetMark(p.id, mark?.status === 'present' ? null : { status: 'present', leftEarly: false, leftEarlyAt: null });
  }

  function toggleAbsent(p) {
    const mark = training.attendance?.[p.id];
    onSetMark(p.id, mark?.status === 'absent' ? null : { status: 'absent' });
  }

  function toggleLeftEarly(p) {
    const mark = training.attendance[p.id];
    onSetMark(p.id, { ...mark, leftEarly: !mark.leftEarly, leftEarlyAt: mark.leftEarly ? null : mark.leftEarlyAt || null });
  }

  function setLeftEarlyTime(p, value) {
    const mark = training.attendance[p.id];
    onSetMark(p.id, { ...mark, leftEarly: true, leftEarlyAt: value || null });
  }

  function markAllUnmarkedPresent() {
    const marks = {};
    for (const p of players) {
      if (!training.attendance?.[p.id]) marks[p.id] = { status: 'present', leftEarly: false, leftEarlyAt: null };
    }
    if (Object.keys(marks).length > 0) onSetMarks(marks);
  }

  return (
    <>
      <div className="matches-header">
        <button className="btn btn-timeout" onClick={onBack}><ArrowLeft size={14} /> ENTRENAMIENTOS</button>
        <button className="btn btn-timeout" onClick={markAllUnmarkedPresent} disabled={summary.unmarked === 0}>
          Todos los sin marcar asisten
        </button>
      </div>

      <div className="att-head">
        <input
          className="player-form-input att-date-input"
          type="date"
          value={training.date}
          onChange={(e) => e.target.value && onUpdate({ date: e.target.value })}
        />
        <input
          className="player-form-input"
          placeholder="Nota (opcional): pabellón, ejercicio, lo que quieras"
          defaultValue={training.note || ''}
          onBlur={(e) => e.target.value !== (training.note || '') && onUpdate({ note: e.target.value })}
        />
      </div>

      <p className="att-summary">
        <span><strong>{summary.present}</strong> asisten</span>
        <span><strong>{summary.absent}</strong> faltan</span>
        <span><strong>{summary.leftEarly}</strong> se van antes</span>
        <span><strong>{summary.unmarked}</strong> sin marcar</span>
      </p>

      <div className="att-roll">
        {players.map((p) => {
          const mark = training.attendance?.[p.id];
          const present = mark?.status === 'present';
          const absent = mark?.status === 'absent';
          return (
            <div key={p.id} className={`att-row${absent ? ' att-row--absent' : ''}`}>
              <span className="att-num">{p.number}</span>
              <span className="att-name">{rosterDisplayName(p)}</span>
              <div className="att-actions">
                <button type="button" className={`att-btn att-btn--present${present ? ' att-btn--on' : ''}`} onClick={() => togglePresent(p)}>
                  ASISTE
                </button>
                <button type="button" className={`att-btn att-btn--absent${absent ? ' att-btn--on' : ''}`} onClick={() => toggleAbsent(p)}>
                  FALTA
                </button>
              </div>
              {present && (
                <div className="att-early-block">
                  <button type="button" className={`att-btn att-btn--early${mark.leftEarly ? ' att-btn--on' : ''}`} onClick={() => toggleLeftEarly(p)}>
                    SE VA ANTES
                  </button>
                  {mark.leftEarly && (
                    <input
                      className="player-form-input att-time"
                      type="time"
                      value={mark.leftEarlyAt || ''}
                      onChange={(e) => setLeftEarlyTime(p, e.target.value)}
                      aria-label={`Hora a la que se va ${rosterDisplayName(p)} (opcional)`}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        {players.length === 0 && <p className="modal-hint">Este equipo no tiene jugadores activos en la plantilla.</p>}
      </div>
    </>
  );
}

export default function TrainingAttendance({ clubId, teamId, teamName }) {
  const { players: roster } = usePlayers(clubId, teamId);
  const { trainings, createTraining, updateTraining, setMark, setMarks, removeTraining } = useTrainings(clubId, teamId);
  const [tab, setTab] = useState('list'); // 'list' | 'stats'
  const [openId, setOpenId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [newDate, setNewDate] = useState(todayDateString());
  const [newNote, setNewNote] = useState('');

  const players = useMemo(() => roster.filter((p) => p.active !== false), [roster]);
  const openTraining = openId ? trainings.find((t) => t.id === openId) : null;

  async function handleCreate(e) {
    e.preventDefault();
    if (!newDate) return;
    if (trainings.some((t) => t.date === newDate) && !confirm('Ya hay un entrenamiento con esa fecha. ¿Crear otro igualmente?')) return;
    const id = await createTraining({ date: newDate, note: newNote.trim() });
    setShowForm(false);
    setNewNote('');
    setNewDate(todayDateString());
    setOpenId(id);
  }

  async function handleDelete(t) {
    if (!confirm(`¿Borrar el entrenamiento del ${formatTrainingDate(t.date)}? Se pierde su lista de asistencia y no se puede deshacer.`)) return;
    await removeTraining(t.id);
    if (openId === t.id) setOpenId(null);
  }

  if (openId && openTraining) {
    return (
      <div className="admin-panel">
        <RollCall
          training={openTraining}
          players={players}
          onBack={() => setOpenId(null)}
          onSetMark={(playerId, mark) => setMark(openTraining.id, playerId, mark)}
          onSetMarks={(marks) => setMarks(openTraining.id, marks)}
          onUpdate={(data) => updateTraining(openTraining.id, data)}
        />
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <p className="modal-hint">Asistencia a entrenamientos — {teamName}</p>

      <div className="home-away-toggle att-toggle">
        <button type="button" className={`btn btn-timeout${tab === 'list' ? ' admin-nav-tab--active' : ''}`} onClick={() => setTab('list')}>
          Entrenamientos
        </button>
        <button type="button" className={`btn btn-timeout${tab === 'stats' ? ' admin-nav-tab--active' : ''}`} onClick={() => setTab('stats')}>
          Estadísticas
        </button>
      </div>

      {tab === 'stats' && <AttendanceStats trainings={trainings} players={players} />}

      {tab === 'list' && (
        <>
          <div className="matches-header">
            <p className="modal-hint" style={{ margin: 0 }}>{trainings.length} entrenamiento{trainings.length === 1 ? '' : 's'}</p>
            <button className="btn btn-clock btn-start" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'CANCELAR' : '+ NUEVO ENTRENAMIENTO'}
            </button>
          </div>

          {showForm && (
            <form className="player-form" onSubmit={handleCreate}>
              <input className="player-form-input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
              <input className="player-form-input" placeholder="Nota (opcional)" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
              <div className="player-form-actions">
                <button className="btn btn-clock btn-start" type="submit">CREAR Y PASAR LISTA</button>
              </div>
            </form>
          )}

          <div className="admin-list">
            {trainings.map((t) => {
              const s = summarizeTraining(t, players);
              return (
                <div key={t.id} className="admin-row att-list-row" onClick={() => setOpenId(t.id)} role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setOpenId(t.id)}>
                  <div className="admin-user-info">
                    <span className="admin-user-name">{formatTrainingDate(t.date)}</span>
                    <span className="admin-user-email">
                      {s.present} asisten · {s.absent} faltan · {s.unmarked} sin marcar{t.note ? ` · ${t.note}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-icon btn-icon--danger"
                    onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                    title="Borrar"
                    aria-label="Borrar entrenamiento"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
            {trainings.length === 0 && <p className="modal-hint">Todavía no hay entrenamientos. Pulsa "+ NUEVO ENTRENAMIENTO" para pasar lista.</p>}
          </div>
        </>
      )}
    </div>
  );
}
