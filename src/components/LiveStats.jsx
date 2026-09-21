import { useMemo, useState } from 'react';
import ActionStatsView from './ActionStatsView';
import LineupsGrid from './LineupsGrid';
import PlayerStatsTable from './PlayerStatsTable';
import SortableTh from './SortableTh';
import { useSortableTable } from '../hooks/useSortableTable';
import { missKindOf } from '../shotZones';
import { teamInitials } from '../utils/teamColors';

// Estadísticas completas del partido en directo (2026-09-21, mockup aprobado): centro
// de la consola de tablet y hoja «Estadísticas» del móvil.
//  - Arriba, los dos escudos (el del equipo elegido, encendido) y el selector
//    Jugadores | Zonas.
//  - Jugadores: tarjetas con los líderes (categoría, número, «#dorsal Nombre») y una
//    tabla con todo — Goles/Tiros juntos, Paradas/Tiros del portero, porcentajes,
//    asistencias, robos y pérdidas — cuyas cabeceras ordenan (primer toque de mayor a
//    menor, segundo al revés). Del rival, lo mismo por dorsal.
//  - Zonas: los mapas de portería y cancha (ActionStatsView) del equipo elegido.
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const countBy = (list, fn) => list.filter(fn).length;

function Leaders({ items }) {
  return (
    <div className="ls-leads">
      {items.map((l) => (
        <div key={l.label} className="ls-lead">
          <div className="ls-lead-l">{l.label}</div>
          <div className="ls-lead-n">{l.n}</div>
          <div className="ls-lead-w">{l.who}</div>
        </div>
      ))}
    </div>
  );
}

// El que más tiene de algo; «—» si nadie pasa de cero.
function leader(rows, label, valueOf, whoOf) {
  let best = null;
  for (const r of rows) {
    const v = valueOf(r);
    if (v > 0 && (!best || v > valueOf(best))) best = r;
  }
  return { label, n: best ? valueOf(best) : '—', who: best ? whoOf(best) : '' };
}

function RivalTable({ rows }) {
  const columns = [
    { key: 'number', label: 'Dorsal', value: (r) => Number(r.number), render: (r) => `#${r.number}` },
    { key: 'goals', label: 'Goles/Tiros', value: (r) => r.goals, render: (r) => `${r.goals}/${r.attempts}` },
    { key: 'accPct', label: '% Acierto', value: (r) => (r.attempts ? r.goals / r.attempts : 0), render: (r) => pct(r.goals, r.attempts) },
    { key: 'sevens', label: '7 m', value: (r) => r.sevenMade, render: (r) => `${r.sevenMade}/${r.sevenTotal}` },
    { key: 'steals', label: 'Robos', value: (r) => r.steals, render: (r) => r.steals },
    { key: 'turnovers', label: 'Pérd.', value: (r) => r.turnovers, render: (r) => r.turnovers },
    { key: 'exclusions', label: 'Excl.', value: (r) => r.exclusions, render: (r) => r.exclusions },
    { key: 'yellow', label: 'Amarilla', value: (r) => Number(r.yellow), render: (r) => (r.yellow ? 'Sí' : '—') },
    { key: 'red', label: 'Roja', value: (r) => Number(r.red), render: (r) => (r.red ? 'Sí' : '—') },
  ];
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(rows, columns, 'goals');
  return (
    <div className="stats-table-wrap">
      <table className="stats-table">
        <thead>
          <tr>{columns.map((c) => <SortableTh key={c.key} label={c.label} columnKey={c.key} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />)}</tr>
        </thead>
        <tbody>
          {sorted.map((r) => <tr key={r.number}>{columns.map((c) => <td key={c.key}>{c.render(r)}</td>)}</tr>)}
          {sorted.length === 0 && <tr><td colSpan={columns.length}><p className="modal-hint">Todavía no hay acciones del rival con dorsal.</p></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function LiveStats({
  state, team, shotEvents = [], saveEvents = [], rivalGoals = [], rivalMisses = [], rivalExclusions = [],
  rivalYellowCards = [], teamActions = [],
}) {
  const [who, setWho] = useState('own'); // 'own' | 'rival'
  const [tab, setTab] = useState('players'); // 'players' | 'zones'
  const players = useMemo(() => Object.values(state.players).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)), [state.players]);

  const ownRows = players.map((p) => ({ ...p, attempts: p.goals + p.shots, shotsFaced: (p.saves || 0) + state.score.rival }));
  const ownLeaders = [
    leader(players, 'Goles', (p) => p.goals, (p) => `#${p.number} ${p.name}`),
    leader(players, 'Asistencias', (p) => p.assists || 0, (p) => `#${p.number} ${p.name}`),
    leader(players.filter((p) => p.isGK), 'Paradas', (p) => p.saves || 0, (p) => `#${p.number} ${p.name}`),
    leader(players, 'Robos', (p) => p.recoveries || 0, (p) => `#${p.number} ${p.name}`),
    leader(players, 'Exclusiones', (p) => p.exclusionsCount || 0, (p) => `#${p.number} ${p.name}`),
  ];

  // Rival por dorsal: todo lo que se ha anotado con su número.
  const rivalRows = useMemo(() => {
    const byNumber = {};
    const row = (n) => {
      const k = String(n);
      if (!byNumber[k]) byNumber[k] = { number: k, goals: 0, attempts: 0, sevenMade: 0, sevenTotal: 0, steals: 0, turnovers: 0, exclusions: 0, yellow: false, red: false };
      return byNumber[k];
    };
    for (const g of rivalGoals) {
      if (g.number == null || g.number === '') continue;
      const r = row(g.number);
      r.goals += 1; r.attempts += 1;
      if (g.shotZone === '7 metros') { r.sevenMade += 1; r.sevenTotal += 1; }
    }
    for (const m of rivalMisses) {
      if (m.number == null || m.number === '') continue;
      const r = row(m.number);
      r.attempts += 1;
      if (m.shotZone === '7 metros') r.sevenTotal += 1;
    }
    for (const a of teamActions) {
      if (a.team !== 'rival' || !a.number) continue;
      const r = row(a.number);
      if (a.kind === 'steal') r.steals += 1;
      else r.turnovers += 1;
    }
    const counts = {};
    for (const e of rivalExclusions) {
      const r = row(e.number);
      if (e.red) { r.red = true; continue; }
      r.exclusions += 1;
      counts[e.number] = (counts[e.number] || 0) + 1;
      if (counts[e.number] >= 3) r.red = true;
    }
    for (const y of rivalYellowCards) row(y.number).yellow = true;
    return Object.values(byNumber);
  }, [rivalGoals, rivalMisses, teamActions, rivalExclusions, rivalYellowCards]);
  const rivalLeaders = [
    leader(rivalRows, 'Goles', (r) => r.goals, (r) => `#${r.number}`),
    leader(rivalRows, 'Tiros', (r) => r.attempts, (r) => `#${r.number}`),
    leader(rivalRows, 'Robos', (r) => r.steals, (r) => `#${r.number}`),
    leader(rivalRows, 'Pérdidas', (r) => r.turnovers, (r) => `#${r.number}`),
    leader(rivalRows, 'Exclusiones', (r) => r.exclusions, (r) => `#${r.number}`),
  ];

  const crest = (k) => {
    const name = k === 'own' ? state.ownTeamName : state.rivalName;
    const url = k === 'own' ? team?.crestUrl : state.rivalCrestUrl;
    return (
      <button key={k} type="button" className={`ls-team ls-team--${k}${who === k ? ' ls-team--on' : ''}`} onClick={() => setWho(k)} aria-pressed={who === k} aria-label={name}>
        <i>{url ? <img src={url} alt="" /> : teamInitials(name)}</i>
        <span>{name}</span>
      </button>
    );
  };

  return (
    <div className="ls">
      <div className="ls-head">
        <div className="ls-teams">{crest('own')}{crest('rival')}</div>
        <div className="ls-seg" role="group" aria-label="Qué ver">
          <button type="button" className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>Jugadores</button>
          <button type="button" className={tab === 'zones' ? 'on' : ''} onClick={() => setTab('zones')}>Zonas</button>
        </div>
      </div>

      {tab === 'players' && who === 'own' && (
        <>
          <Leaders items={ownLeaders} />
          <PlayerStatsTable rows={ownRows} minutesTotalMs={state.clock.elapsedMs} showMinutes showActions defaultSortKey="goals" />
          <LineupsGrid
            title={state.clock.periodCount === 4 ? 'Titulares de cada cuarto' : 'Titulares de cada tiempo'}
            lineups={state.lineups}
            players={state.players}
            periodCount={state.clock.periodCount}
          />
        </>
      )}
      {tab === 'players' && who === 'rival' && (
        <>
          <Leaders items={rivalLeaders} />
          <RivalTable rows={rivalRows} />
        </>
      )}
      {tab === 'zones' && (
        <ActionStatsView
          key={who}
          team={who}
          hideTeamSelect
          shotEvents={shotEvents}
          saveEvents={saveEvents}
          rivalGoals={rivalGoals}
          rivalMisses={rivalMisses}
          players={players}
          ownTeamName={state.ownTeamName}
          rivalName={state.rivalName}
          ownPrimaryColor={team?.primaryColor}
          ownSecondaryColor={team?.secondaryColor}
        />
      )}
      {tab === 'zones' && (
        <p className="modal-hint">
          Palos: {countBy(shotEvents, (e) => e.type === 'miss' && missKindOf(e.goalZone) === 'post')} nuestros · {countBy(rivalMisses, (e) => missKindOf(e.goalZone) === 'post')} del rival.
        </p>
      )}
    </div>
  );
}
