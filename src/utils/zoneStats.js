function pct(made, total) {
  if (!total) return '—';
  return `${Math.round((made / total) * 100)}%`;
}

// Cuenta por zona una sola vez, siempre en base al acierto real (gol o
// parada) — el mismo recuento sirve tanto para el modo "Goles"/"Paradas"
// (made/total) como para su espejo "Fallos" (total-made/total): no hace
// falta un segundo recorrido de los eventos solo porque cambie qué número
// se enseña arriba.
function zoneCounts(events, zoneField, isMade) {
  const map = {};
  for (const e of events) {
    const zone = e[zoneField];
    if (!zone) continue;
    const cur = map[zone] || { made: 0, total: 0 };
    cur.total += 1;
    if (isMade(e)) cur.made += 1;
    map[zone] = cur;
  }
  return map;
}

function statLines(counts, { mirror = false } = {}) {
  const lines = {};
  for (const [zone, c] of Object.entries(counts)) {
    const made = mirror ? c.total - c.made : c.made;
    lines[zone] = [`${made}/${c.total}`, pct(made, c.total)];
  }
  return lines;
}

// Ratio de acierto por zona (0..1, o null si no hay datos) — siempre en
// base al acierto real, nunca al espejo "Fallos", para que el color de
// una zona no cambie según qué modo esté mirando el usuario ahora mismo.
function ratios(counts) {
  const out = {};
  for (const [zone, c] of Object.entries(counts)) {
    out[zone] = c.total ? c.made / c.total : null;
  }
  return out;
}

// Jugador de campo (o equipo entero, pasando todos los shotEvents del
// partido): acierto por zona de lanzamiento y por zona de entrada, a
// partir de los propios goles y fallos. "7 metros" sale separado solo por
// ser un valor más de shotZone — sin lógica aparte. `mirror: true` enseña
// el mismo dato desde el fallo (Fallos/Tiros + % de fallo) en vez de desde
// el gol — mismos números, ratio de color igual en los dos modos.
export function fieldPlayerZoneStats(shotEvents, { mirror = false } = {}) {
  const isGoal = (e) => e.type === 'goal';
  const originCounts = zoneCounts(shotEvents, 'shotZone', isGoal);
  const entryCounts = zoneCounts(shotEvents, 'goalZone', isGoal);
  return {
    origin: statLines(originCounts, { mirror }),
    entry: statLines(entryCounts, { mirror }),
    originRatios: ratios(originCounts),
    entryRatios: ratios(entryCounts),
  };
}

// Portero (o equipo entero): % de paradas por zona, comparando las
// paradas con los goles rivales encajados en esa misma zona. Si hubo más
// de un portero en el partido esto es una aproximación de equipo (no se
// sabe qué portero concreto encajó cada gol) — misma limitación ya
// aceptada en el resto de la app para "tiros a puerta" de un portero.
export function goalkeeperZoneStats(saveEvents, rivalGoals) {
  function combinedByZone(zoneField) {
    const map = {};
    for (const s of saveEvents) {
      const zone = s[zoneField];
      if (!zone) continue;
      const cur = map[zone] || { made: 0, total: 0 };
      cur.made += 1;
      cur.total += 1;
      map[zone] = cur;
    }
    for (const g of rivalGoals) {
      const zone = g[zoneField];
      if (!zone) continue;
      const cur = map[zone] || { made: 0, total: 0 };
      cur.total += 1;
      map[zone] = cur;
    }
    return map;
  }
  const originCounts = combinedByZone('shotZone');
  const entryCounts = combinedByZone('goalZone');
  return {
    origin: statLines(originCounts),
    entry: statLines(entryCounts),
    originRatios: ratios(originCounts),
    entryRatios: ratios(entryCounts),
  };
}

// Goles del rival por zona: solo recuento, sin ratio ni color — no
// registramos los fallos del rival con zona (solo un contador total del
// partido, sin detalle), así que no hay forma de saber cuántos intentos
// tuvo en cada zona, solo cuántos goles marcó ahí.
export function rivalGoalZoneStats(rivalGoals) {
  function countsByZone(zoneField) {
    const map = {};
    for (const g of rivalGoals) {
      const zone = g[zoneField];
      if (!zone) continue;
      map[zone] = (map[zone] || 0) + 1;
    }
    const lines = {};
    for (const [zone, count] of Object.entries(map)) {
      lines[zone] = [`${count}`, count === 1 ? 'gol' : 'goles'];
    }
    return lines;
  }
  return { origin: countsByZone('shotZone'), entry: countsByZone('goalZone') };
}

// Verde (100% de acierto) a rojo (0%), pasando por ámbar en el medio —
// interpolando el matiz (hue) en vez de mezclar los dos colores en RGB,
// para que el 50% no salga un marrón sucio. Sin datos → null (la zona se
// queda en su color original, sin pintar).
export function zoneHeatColor(ratio) {
  if (ratio == null) return null;
  const clamped = Math.max(0, Math.min(1, ratio));
  return `hsl(${Math.round(clamped * 120)}, 70%, 42%)`;
}

export function zoneHeatColors(zoneRatios) {
  const colors = {};
  for (const [zone, ratio] of Object.entries(zoneRatios)) {
    const color = zoneHeatColor(ratio);
    if (color) colors[zone] = color;
  }
  return colors;
}
