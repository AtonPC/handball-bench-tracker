import { OUT_ZONES } from '../shotZones';
import { fieldPlayerZoneStats, rivalShotZoneStats } from '../utils/zoneStats';

function pct(made, total) {
  if (!total) return '—';
  return `${Math.round((made / total) * 100)}%`;
}

// Un fallo propio con zona de entrada de las 9 de portería (no una de
// "Fuera") es, casi siempre, un tiro que detuvo el portero rival — no
// tenemos un evento "parada rival" propio (nadie del banquillo contrario
// anota nuestras estadísticas), así que esto es una aproximación a partir
// de datos que ya tenemos, no un recuento exacto — se marca como tal en
// el propio texto de la fila.
const OUT_ZONE_SET = new Set(OUT_ZONES);
function estimateRivalSaves(shotEvents) {
  return shotEvents.filter((e) => e.type === 'miss' && e.goalZone && !OUT_ZONE_SET.has(e.goalZone)).length;
}

// "Goles/Tiros" de fieldPlayerZoneStats/rivalShotZoneStats para una zona
// concreta viene como ["made/total", "pct%"] — aquí solo hace falta el
// made/total de vuelta a números para reusar el mismo CompareBar de abajo.
function madeTotal(statLine) {
  if (!statLine) return { made: 0, total: 0 };
  const [made, total] = statLine[0].split('/').map(Number);
  return { made, total };
}

function CompareBar({ label, ownMade, ownTotal, rivalMade, rivalTotal, approxRival }) {
  const sum = ownMade + rivalMade;
  const ownShare = sum ? (ownMade / sum) * 100 : 50;
  const ownText = ownTotal != null ? `${ownMade}/${ownTotal} · ${pct(ownMade, ownTotal)}` : `${ownMade}`;
  const rivalText = rivalTotal != null ? `${rivalMade}/${rivalTotal} · ${pct(rivalMade, rivalTotal)}` : `${rivalMade}`;
  return (
    <div className="match-compare-row">
      <div className="match-compare-values">
        <span className="match-compare-value match-compare-value--own">{ownText}</span>
        <span className="match-compare-label">{label}{approxRival ? ' *' : ''}</span>
        <span className="match-compare-value match-compare-value--rival">{rivalText}</span>
      </div>
      <div className="match-compare-bar">
        <div className="match-compare-bar-own" style={{ width: `${ownShare}%` }} />
        <div className="match-compare-bar-rival" style={{ width: `${100 - ownShare}%` }} />
      </div>
    </div>
  );
}

// "Resumen partido": comparación directa equipo propio vs rival, primera
// pantalla de las cuatro (Resumen → Acciones → Partido → Cronología).
// Todo se recalcula aquí mismo a partir de los datos en bruto que ya se
// piden en los tres sitios que la usan (partido en directo, finalizado,
// staff) — así no hay tres copias del mismo cálculo.
export default function MatchSummaryView({
  statePlayers = {}, shotEvents = [], saveEvents = [], rivalGoals = [], rivalMisses = [], rivalExclusions = [],
  ownTeamName = 'Nuestro equipo', rivalName = 'Rival',
}) {
  const players = Object.values(statePlayers);
  const ownGoals = players.reduce((s, p) => s + (p.goals || 0), 0);
  const ownMisses = players.reduce((s, p) => s + (p.shots || 0), 0);
  const ownAttempts = ownGoals + ownMisses;
  const ownSaves = players.reduce((s, p) => s + (p.saves || 0), 0);
  const ownShotsFaced = ownSaves + rivalGoals.length;
  const ownExclusions = players.reduce((s, p) => s + (p.exclusionsCount || 0), 0);
  const ownRojas = players.filter((p) => p.disqualified).length;

  const rivalShotsTotal = rivalGoals.length + saveEvents.length + rivalMisses.length;
  const rivalSavesEstimate = estimateRivalSaves(shotEvents);

  const rivalExclusionCounts = {};
  for (const e of rivalExclusions) rivalExclusionCounts[e.number] = (rivalExclusionCounts[e.number] || 0) + 1;
  const rivalRojas = Object.values(rivalExclusionCounts).filter((c) => c >= 3).length;

  const own7m = madeTotal(fieldPlayerZoneStats(shotEvents).origin['7 metros']);
  const rival7m = madeTotal(rivalShotZoneStats(rivalGoals, saveEvents, rivalMisses).origin['7 metros']);

  return (
    <div className="card">
      <div className="match-compare-teams">
        <span className="match-compare-team match-compare-team--own"><span className="match-compare-dot match-compare-dot--own" />{ownTeamName}</span>
        <span className="match-compare-team match-compare-team--rival">{rivalName}<span className="match-compare-dot match-compare-dot--rival" /></span>
      </div>

      <CompareBar label="Goles/Tiros" ownMade={ownGoals} ownTotal={ownAttempts} rivalMade={rivalGoals.length} rivalTotal={rivalShotsTotal} />
      <CompareBar label="Paradas/Tiros" ownMade={ownSaves} ownTotal={ownShotsFaced} rivalMade={rivalSavesEstimate} rivalTotal={ownAttempts} approxRival />
      <CompareBar label="7 metros" ownMade={own7m.made} ownTotal={own7m.total} rivalMade={rival7m.made} rivalTotal={rival7m.total} />
      <CompareBar label="Exclusiones" ownMade={ownExclusions} rivalMade={rivalExclusions.length} />
      <CompareBar label="Rojas" ownMade={ownRojas} rivalMade={rivalRojas} />

      <p className="modal-hint" style={{ marginTop: 'var(--space-2)' }}>
        * Paradas del rival estimadas a partir de nuestros fallos que no se fueron fuera — no registramos sus paradas una a una.
      </p>
    </div>
  );
}
