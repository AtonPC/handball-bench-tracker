import { useMemo, useState } from 'react';
import ShotZoneDiagram from './ShotZoneDiagram';
import { fieldPlayerZoneStats, goalkeeperZoneStats, rivalGoalZoneStats, zoneHeatColors } from '../utils/zoneStats';

const ANY = '';

// "Estadísticas de Acciones": la plantilla completa (portería + cancha +
// área + 9m + 7m) en modo lectura, con gradiente de color por zona (verde
// 100% de acierto → rojo 0%, sin pintar si no hay datos) en vez de solo
// texto. Tres selectores independientes:
// - Equipo: propio (con todos nuestros datos) o rival.
// - Tipo: Goles / Fallos (mismo dato en espejo: Fallos/Tiros + % de
//   fallo, el color de la zona no cambia entre los dos, siempre se basa
//   en el acierto real) / Paradas (nuestro portero).
// - Jugador: equipo entero o uno concreto — solo aplica al equipo propio,
//   un gol/fallo/parada rival no está ligado a nuestra plantilla. La lista
//   se adapta al Tipo elegido (solo quien tenga algo que mostrar ahí), no
//   es la plantilla completa siempre.
// El rival SOLO tiene "Goles" disponible: no registramos sus fallos con
// zona (solo un contador total del partido), así que ni Fallos ni Paradas
// tienen datos que mostrar para él — decisión explícita, no un descuido.
export default function ActionStatsView({ shotEvents = [], saveEvents = [], rivalGoals = [], players = [] }) {
  const [team, setTeam] = useState('own'); // 'own' | 'rival'
  const [tipo, setTipo] = useState('goles'); // 'goles' | 'fallos' | 'paradas'
  const [playerId, setPlayerId] = useState(ANY);

  const effectiveTipo = team === 'rival' ? 'goles' : tipo;

  // Solo jugadores con algo que mostrar en el modo actual — quien no haya
  // marcado/fallado/parado nunca no aparece, para no tener que ir uno por
  // uno a comprobar si tiene datos.
  const idsWithData = useMemo(() => {
    if (effectiveTipo === 'paradas') return new Set(saveEvents.map((e) => e.playerId).filter(Boolean));
    const wantedType = effectiveTipo === 'fallos' ? 'miss' : 'goal';
    return new Set(shotEvents.filter((e) => e.type === wantedType).map((e) => e.playerId));
  }, [effectiveTipo, shotEvents, saveEvents]);
  const selectablePlayers = (effectiveTipo === 'paradas' ? players.filter((p) => p.isGK) : players)
    .filter((p) => idsWithData.has(p.id));

  // Si el jugador elegido se queda sin datos al cambiar de modo (p. ej.
  // marcó goles pero nunca falló, y se pasa a "Fallos"), se olvida la
  // selección en vez de enseñar un diagrama vacío en silencio.
  const effectivePlayerId = playerId && idsWithData.has(playerId) ? playerId : ANY;
  const player = effectivePlayerId ? players.find((p) => p.id === effectivePlayerId) : null;

  const filteredShotEvents = player ? shotEvents.filter((e) => e.playerId === effectivePlayerId) : shotEvents;
  const filteredSaveEvents = player ? saveEvents.filter((e) => e.playerId === effectivePlayerId) : saveEvents;

  let originStats, entryStats, originColors, goalColors, title, hasGradient;
  if (team === 'rival') {
    const s = rivalGoalZoneStats(rivalGoals);
    originStats = s.origin;
    entryStats = s.entry;
    originColors = {};
    goalColors = {};
    title = 'Goles del rival';
    hasGradient = false;
  } else if (effectiveTipo === 'paradas') {
    const s = goalkeeperZoneStats(filteredSaveEvents, rivalGoals);
    originStats = s.origin;
    entryStats = s.entry;
    originColors = zoneHeatColors(s.originRatios);
    goalColors = zoneHeatColors(s.entryRatios);
    title = 'Paradas';
    hasGradient = true;
  } else {
    const s = fieldPlayerZoneStats(filteredShotEvents, { mirror: effectiveTipo === 'fallos' });
    originStats = s.origin;
    entryStats = s.entry;
    originColors = zoneHeatColors(s.originRatios);
    goalColors = zoneHeatColors(s.entryRatios);
    title = effectiveTipo === 'fallos' ? 'Fallos' : 'Goles';
    hasGradient = true;
  }

  return (
    <div>
      <div className="list-search" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <select
          className="player-form-input"
          value={team}
          onChange={(e) => { setTeam(e.target.value); setPlayerId(ANY); }}
        >
          <option value="own">Nuestro equipo</option>
          <option value="rival">Rival</option>
        </select>
        <select
          className="player-form-input"
          value={effectiveTipo}
          onChange={(e) => setTipo(e.target.value)}
          disabled={team === 'rival'}
        >
          <option value="goles">Goles</option>
          {team === 'own' && <option value="fallos">Fallos</option>}
          {team === 'own' && <option value="paradas">Paradas</option>}
        </select>
        {team === 'own' && (
          <select className="player-form-input" value={effectivePlayerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value={ANY}>Equipo (todos)</option>
            {selectablePlayers.map((p) => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
          </select>
        )}
      </div>

      <div className="card" style={{ marginTop: 'var(--space-3)' }}>
        <h4>{title}{player ? ` — #${player.number} ${player.name}` : team === 'own' ? ' del equipo' : ''}</h4>
        {hasGradient && (
          <p className="modal-hint">Color de la zona: rojo (0% de acierto) a verde (100%) — sin pintar si no hay datos todavía.</p>
        )}
        <ShotZoneDiagram
          readOnly
          showGoal
          showOut
          showOrigin
          originStats={originStats}
          goalStats={entryStats}
          originColors={originColors}
          goalColors={goalColors}
        />
      </div>
    </div>
  );
}
