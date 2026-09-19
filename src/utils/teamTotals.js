// Cifras globales del EQUIPO (sin desglose por jugador), sumando las filas de
// jugadores de un partido o de una temporada. Es lo único que ve un Seguidor
// Estándar de las estadísticas de jugadores. Acepta las dos formas de fila
// que hay en la app: la de un partido (yellowCard/disqualified booleanos) y
// la de temporada (yellowCards/disqualifications como número de veces).
export function computeTeamTotals(rows, rivalGoalsConceded = 0) {
  let goals = 0, shots = 0, saves = 0, recoveries = 0, exclusions = 0, yellow = 0, red = 0;
  for (const r of rows) {
    goals += r.goals || 0;
    shots += r.shots || 0;
    saves += r.saves || 0;
    recoveries += r.recoveries || 0;
    exclusions += r.exclusionsCount || 0;
    yellow += typeof r.yellowCards === 'number' ? r.yellowCards : r.yellowCard ? 1 : 0;
    red += typeof r.disqualifications === 'number' ? r.disqualifications : Number(r.disqualified) || 0;
  }
  const attempts = goals + shots;
  const shotsFaced = saves + rivalGoalsConceded;
  return {
    goals,
    attempts,
    accuracy: attempts ? goals / attempts : null,
    conceded: rivalGoalsConceded,
    saves,
    shotsFaced,
    savePct: shotsFaced ? saves / shotsFaced : null,
    recoveries,
    exclusions,
    yellow,
    red,
  };
}
