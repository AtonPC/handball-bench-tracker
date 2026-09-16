import { useMemo, useState } from 'react';
import ShotZoneDiagram from './ShotZoneDiagram';
import { fieldPlayerZoneStats, goalkeeperZoneStats, rivalShotZoneStats, zoneHeatColors } from '../utils/zoneStats';

const ANY = '';

// "Estadísticas de Acciones": la plantilla completa (portería + cancha +
// área + 9m + 7m) en modo lectura, con gradiente de color por zona (verde
// 100% de acierto → rojo 0%, sin pintar si no hay datos) en vez de solo
// texto. Tres selectores independientes (Equipo y Tipo como botones
// visibles, Jugador como desplegable — hay demasiados nombres para
// botones):
// - Equipo: propio o rival, con el nombre real de cada uno.
// - Tipo: Goles / Fallos (mismo dato en espejo: Fallos/Tiros + % de
//   fallo, el color de la zona no cambia entre los dos, siempre se basa
//   en el acierto real) / Paradas (nuestro portero — el rival no tiene
//   este botón, ver más abajo).
// - Jugador: equipo entero o uno concreto — solo aplica al equipo propio,
//   un gol/fallo/parada rival no está ligado a nuestra plantilla. La lista
//   se adapta al Tipo elegido (solo quien tenga algo que mostrar ahí), no
//   es la plantilla completa siempre.
// El rival tiene Goles y Fallos (con ratio real: sus goles + nuestras
// paradas + sus fallos por fuera son todos "tiros suyos") pero no
// Paradas — eso sería "el portero rival parándonos a nosotros", dato que
// no tenemos con detalle (solo se puede aproximar desde nuestros propios
// fallos, y se decidió no mezclar aproximaciones con datos reales aquí).
//
// Además de los tres selectores, cada zona del dibujo es en sí misma un
// filtro: tocar una zona de origen (p. ej. "7 metros") recalcula SOLO el
// mapa de entrada (por dónde entraron esos goles/fallos/paradas de 7m) —
// el mapa de origen se queda mostrando el global, con esa zona resaltada.
// Tocar una zona de entrada hace lo mismo al revés (recalcula el origen).
// Solo una zona a la vez (de una lista u otra, no las dos) — tocarla de
// nuevo, o cambiar de equipo/tipo, la quita.
export default function ActionStatsView({
  shotEvents = [], saveEvents = [], rivalGoals = [], rivalMisses = [], players = [],
  ownTeamName = 'Nuestro equipo', rivalName = 'Rival',
  ownPrimaryColor, ownSecondaryColor,
}) {
  // El cuadrito del botón de equipo es dos triángulos (un gradiente en
  // diagonal partido justo al 50%) con los colores reales del equipo. El
  // rival todavía no tiene colores propios registrados (es solo texto
  // libre en el partido, no una entidad con ficha) — se deja un marcador
  // con el rojo de "rival" repetido, para que en cuanto exista esa ficha
  // (mejora pendiente) solo haga falta pasarle sus dos colores aquí.
  const ownColor1 = ownPrimaryColor || 'var(--own)';
  const ownColor2 = ownSecondaryColor || ownColor1;
  const rivalColor1 = 'var(--rival)';
  const rivalColor2 = 'var(--rival)';
  const [team, setTeam] = useState('own'); // 'own' | 'rival'
  const [tipo, setTipo] = useState('goles'); // 'goles' | 'fallos' | 'paradas'
  const [playerId, setPlayerId] = useState(ANY);
  const [filterZone, setFilterZone] = useState(null); // { dim: 'origin'|'entry', zone: string } | null

  const effectiveTipo = team === 'rival' && tipo === 'paradas' ? 'goles' : tipo;

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

  // Además del jugador, filtra por la zona tocada (si hay una) — solo para
  // recalcular la OTRA mitad del dibujo; la mitad que se tocó se queda con
  // su propio global, así no se pierde el contexto de conjunto.
  function byZone(events) {
    if (!filterZone) return events;
    const field = filterZone.dim === 'origin' ? 'shotZone' : 'goalZone';
    return events.filter((e) => e[field] === filterZone.zone);
  }

  let originStats, entryStats, originColors, goalColors, title;
  if (team === 'rival') {
    const opts = { mirror: effectiveTipo === 'fallos' };
    const full = rivalShotZoneStats(rivalGoals, rivalMisses, opts);
    const filtered = rivalShotZoneStats(byZone(rivalGoals), byZone(rivalMisses), opts);
    originStats = filterZone?.dim === 'entry' ? filtered.origin : full.origin;
    entryStats = filterZone?.dim === 'origin' ? filtered.entry : full.entry;
    originColors = zoneHeatColors(filterZone?.dim === 'entry' ? filtered.originRatios : full.originRatios);
    goalColors = zoneHeatColors(filterZone?.dim === 'origin' ? filtered.entryRatios : full.entryRatios);
    title = effectiveTipo === 'fallos' ? `Fallos de ${rivalName}` : `Goles de ${rivalName}`;
  } else if (effectiveTipo === 'paradas') {
    const full = goalkeeperZoneStats(filteredSaveEvents, rivalGoals);
    const filtered = goalkeeperZoneStats(byZone(filteredSaveEvents), byZone(rivalGoals));
    originStats = filterZone?.dim === 'entry' ? filtered.origin : full.origin;
    entryStats = filterZone?.dim === 'origin' ? filtered.entry : full.entry;
    originColors = zoneHeatColors(filterZone?.dim === 'entry' ? filtered.originRatios : full.originRatios);
    goalColors = zoneHeatColors(filterZone?.dim === 'origin' ? filtered.entryRatios : full.entryRatios);
    title = 'Paradas';
  } else {
    const opts = { mirror: effectiveTipo === 'fallos' };
    const full = fieldPlayerZoneStats(filteredShotEvents, opts);
    const filtered = fieldPlayerZoneStats(byZone(filteredShotEvents), opts);
    originStats = filterZone?.dim === 'entry' ? filtered.origin : full.origin;
    entryStats = filterZone?.dim === 'origin' ? filtered.entry : full.entry;
    originColors = zoneHeatColors(filterZone?.dim === 'entry' ? filtered.originRatios : full.originRatios);
    goalColors = zoneHeatColors(filterZone?.dim === 'origin' ? filtered.entryRatios : full.entryRatios);
    title = effectiveTipo === 'fallos' ? 'Fallos' : 'Goles';
  }

  function selectTeam(next) {
    setTeam(next);
    setPlayerId(ANY);
    setFilterZone(null);
  }

  function selectTipo(next) {
    setTipo(next);
    setFilterZone(null);
  }

  return (
    <div>
      <div className="team-select-row">
        <button
          type="button"
          className={`team-select-btn${team === 'own' ? ' team-select-btn--active' : ''}`}
          onClick={() => selectTeam('own')}
        >
          <span className="team-select-swatch" style={{ background: `linear-gradient(to bottom right, ${ownColor1} 50%, ${ownColor2} 50%)` }} />
          <span className="team-select-name">{ownTeamName}</span>
        </button>
        <button
          type="button"
          className={`team-select-btn${team === 'rival' ? ' team-select-btn--active' : ''}`}
          onClick={() => selectTeam('rival')}
        >
          <span className="team-select-swatch" style={{ background: `linear-gradient(to bottom right, ${rivalColor1} 50%, ${rivalColor2} 50%)` }} />
          <span className="team-select-name">{rivalName}</span>
        </button>
      </div>

      <div className="home-away-toggle" style={{ marginTop: 'var(--space-2)' }}>
        <button type="button" className={`btn btn-timeout${effectiveTipo === 'goles' ? ' admin-nav-tab--active' : ''}`} onClick={() => selectTipo('goles')}>
          Goles
        </button>
        <button type="button" className={`btn btn-timeout${effectiveTipo === 'fallos' ? ' admin-nav-tab--active' : ''}`} onClick={() => selectTipo('fallos')}>
          Fallos
        </button>
        {team === 'own' && (
          <button type="button" className={`btn btn-timeout${effectiveTipo === 'paradas' ? ' admin-nav-tab--active' : ''}`} onClick={() => selectTipo('paradas')}>
            Paradas
          </button>
        )}
      </div>

      {team === 'own' && (
        <div className="list-search" style={{ marginTop: 'var(--space-2)' }}>
          <select className="player-form-input" value={effectivePlayerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value={ANY}>Equipo (todos)</option>
            {selectablePlayers.map((p) => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
          </select>
        </div>
      )}

      <div className="card" style={{ marginTop: 'var(--space-3)' }}>
        <h4>{title}{player ? ` — #${player.number} ${player.name}` : team === 'own' ? ' del equipo' : ''}</h4>
        <p className="modal-hint">Color de la zona: rojo (0% de acierto) a verde (100%) — sin pintar si no hay datos todavía. Toca una zona para ver solo lo suyo en la otra mitad del dibujo.</p>
        {filterZone && (
          <p className="modal-hint">
            Filtrado por <b>{filterZone.zone}</b> ({filterZone.dim === 'origin' ? 'de dónde vino' : 'por dónde entró'}) —{' '}
            <button type="button" className="link-button" onClick={() => setFilterZone(null)}>quitar filtro</button>
          </p>
        )}
        <ShotZoneDiagram
          showGoal
          showOut
          showOrigin
          shotZone={filterZone?.dim === 'origin' ? filterZone.zone : null}
          onShotZone={(z) => setFilterZone(z ? { dim: 'origin', zone: z } : null)}
          goalZone={filterZone?.dim === 'entry' ? filterZone.zone : null}
          onGoalZone={(z) => setFilterZone(z ? { dim: 'entry', zone: z } : null)}
          originStats={originStats}
          goalStats={entryStats}
          originColors={originColors}
          goalColors={goalColors}
        />
      </div>
    </div>
  );
}
