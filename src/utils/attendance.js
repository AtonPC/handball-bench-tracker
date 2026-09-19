// Asistencia a entrenamientos. Cada entrenamiento guarda un mapa
// `attendance: { [playerId]: { status: 'present'|'absent', leftEarly, leftEarlyAt } }`.
// Un jugador SIN entrada en ese mapa es "sin marcar": no cuenta ni como
// asistencia ni como falta — así no se penaliza a quien se incorporó a mitad
// de temporada, ni se da por buena una lista que se quedó a medias.
// Irse antes de tiempo cuenta como asistencia (estuvo), y se contabiliza
// aparte para poder verlo.

export function todayDateString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// 'YYYY-MM-DD' → "mié, 18 sep 2026". Se construye con componentes locales
// (no con new Date('YYYY-MM-DD'), que se interpreta en UTC y en algunos
// husos horarios enseñaría el día anterior).
export function formatTrainingDate(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return 'Sin fecha';
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// Resumen de una sesión: cuántos asisten, faltan, se van antes y quedan sin
// marcar, sobre los jugadores que se están mostrando en la lista.
export function summarizeTraining(training, players) {
  let present = 0, absent = 0, leftEarly = 0;
  for (const p of players) {
    const mark = training.attendance?.[p.id];
    if (!mark) continue;
    if (mark.status === 'present') {
      present += 1;
      if (mark.leftEarly) leftEarly += 1;
    } else if (mark.status === 'absent') {
      absent += 1;
    }
  }
  return { present, absent, leftEarly, unmarked: players.length - present - absent };
}

// Estadística por jugador y del equipo, sobre todos los entrenamientos.
// `pct` es null (no 0) cuando no hay ninguna marca, para poder enseñar "—".
export function computeAttendanceStats(trainings, players, nameOf) {
  const rows = players.map((p) => {
    let attended = 0, absent = 0, leftEarly = 0;
    for (const t of trainings) {
      const mark = t.attendance?.[p.id];
      if (!mark) continue;
      if (mark.status === 'present') {
        attended += 1;
        if (mark.leftEarly) leftEarly += 1;
      } else if (mark.status === 'absent') {
        absent += 1;
      }
    }
    const marked = attended + absent;
    return {
      id: p.id,
      number: p.number ?? null,
      name: nameOf(p),
      attended,
      absent,
      marked,
      leftEarly,
      pct: marked ? attended / marked : null,
    };
  });
  const totalAttended = rows.reduce((s, r) => s + r.attended, 0);
  const totalMarked = rows.reduce((s, r) => s + r.marked, 0);
  return {
    rows,
    trainingsCount: trainings.length,
    teamPct: totalMarked ? totalAttended / totalMarked : null,
  };
}
