function pct(made, total) {
  if (!total) return '—';
  return `${Math.round((made / total) * 100)}%`;
}

function buildStatLines(events, zoneField, isMade) {
  const map = {};
  for (const e of events) {
    const zone = e[zoneField];
    if (!zone) continue;
    const cur = map[zone] || { made: 0, total: 0 };
    cur.total += 1;
    if (isMade(e)) cur.made += 1;
    map[zone] = cur;
  }
  const lines = {};
  for (const [zone, c] of Object.entries(map)) {
    lines[zone] = [`${c.made}/${c.total}`, pct(c.made, c.total)];
  }
  return lines;
}

// Jugador de campo (o equipo entero, pasando todos los shotEvents del
// partido): acierto por zona de lanzamiento y por zona de entrada, a
// partir de los propios goles y fallos. "7 metros" sale separado solo por
// ser un valor más de shotZone — sin lógica aparte.
export function fieldPlayerZoneStats(shotEvents) {
  const isGoal = (e) => e.type === 'goal';
  return {
    origin: buildStatLines(shotEvents, 'shotZone', isGoal),
    entry: buildStatLines(shotEvents, 'goalZone', isGoal),
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
    const lines = {};
    for (const [zone, c] of Object.entries(map)) lines[zone] = [`${c.made}/${c.total}`, pct(c.made, c.total)];
    return lines;
  }
  return { origin: combinedByZone('shotZone'), entry: combinedByZone('goalZone') };
}
