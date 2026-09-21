import { useMemo, useState } from 'react';
import StatsBoard from './StatsBoard';
import { GOAL_ZONES, OUT_ZONES, POST_ZONES } from '../shotZones';
import { teamInitials } from '../utils/teamColors';

// Estadísticas completas del partido en directo (mockup aprobado, 2026-09-21): centro de
// la consola de tablet y hoja «Estadísticas» del móvil.
//  - Arriba, el escudo de cada equipo (el elegido, encendido) y el selector
//    Jugadores | Zonas.
//  - Jugadores: cinco tarjetas de líderes (categoría, número y «#dorsal Nombre») y una
//    tabla compacta — Jugador, G/T, %, P/T, P%, Rob, Pér, Exc, Am, Roj, Asi (del rival:
//    Dorsal, G/T, %, Rob, Pér, Exc, Am, Roj). El máximo de cada columna va resaltado, los
//    ceros en gris y las cabeceras ordenan (primer toque de mayor a menor, segundo al revés).
//  - Zonas: «Goles» (goles/tiros por zona, en verde) o «Fallos» (en rojo), filtrable por
//    jugador o dorsal, sobre la portería y la cancha (StatsBoard).
const EMPTY = { g: 0, t: 0, sv: 0, f: 0, ro: 0, pe: 0, ex: 0, am: 0, rj: 0, as: 0 };

const COLS = {
  own: [['n', 'Jugador'], ['gt', 'G/T'], ['gp', '%'], ['pt', 'P/T'], ['pp', 'P%'], ['ro', 'Rob'], ['pe', 'Pér'], ['ex', 'Exc'], ['am', 'Am'], ['rj', 'Roj'], ['as', 'Asi']],
  rival: [['n', 'Dorsal'], ['gt', 'G/T'], ['gp', '%'], ['ro', 'Rob'], ['pe', 'Pér'], ['ex', 'Exc'], ['am', 'Am'], ['rj', 'Roj']],
};
const LEADS = {
  own: [['Goles', 'g'], ['Robos', 'ro'], ['Pérdidas', 'pe'], ['Paradas', 'sv'], ['Asistencias', 'as']],
  rival: [['Goles', 'g'], ['Robos', 'ro'], ['Pérdidas', 'pe'], ['Exclusiones', 'ex'], ['Amarillas', 'am']],
};

// Fila de estadísticas por jugador nuestro.
function ownStats(state) {
  const out = {};
  for (const p of Object.values(state.players)) {
    const gk = p.isGK || (p.saves || 0) > 0;
    out[p.id] = {
      ...EMPTY,
      g: p.goals || 0, t: (p.goals || 0) + (p.shots || 0),
      sv: p.saves || 0, f: gk ? (p.saves || 0) + state.score.rival : 0,
      ro: p.recoveries || 0, pe: p.turnovers || 0, ex: p.exclusionsCount || 0,
      am: p.yellowCard ? 1 : 0, rj: p.disqualified ? 1 : 0, as: p.assists || 0,
    };
  }
  return out;
}

// Fila de estadísticas por dorsal rival («?» para lo anotado sin dorsal).
function rivalStats({ rivalGoals, rivalMisses, teamActions, rivalExclusions, rivalYellowCards }) {
  const out = {};
  const row = (n) => {
    const k = n == null || n === '' ? '?' : String(n);
    if (!out[k]) out[k] = { ...EMPTY };
    return out[k];
  };
  for (const g of rivalGoals) { const r = row(g.number); r.g += 1; r.t += 1; }
  for (const m of rivalMisses) row(m.number).t += 1;
  for (const a of teamActions) {
    if (a.team !== 'rival') continue;
    const r = row(a.number);
    if (a.kind === 'steal') r.ro += 1; else r.pe += 1;
  }
  const counts = {};
  for (const e of rivalExclusions) {
    const r = row(e.number);
    if (e.red) { r.rj = 1; continue; }
    r.ex += 1;
    counts[e.number] = (counts[e.number] || 0) + 1;
    if (counts[e.number] >= 3) r.rj = 1;
  }
  for (const y of rivalYellowCards) row(y.number).am = 1;
  return out;
}

// Zonas: por origen {t, g}, por cuadrante de portería {g, s} y fuera/palos.
function zoneStats(shots, who) {
  const zones = {};
  const cells = {};
  const outs = { top: 0, left: 0, right: 0, pl: 0, bar: 0, pr: 0 };
  for (const e of shots) {
    if (who && e.id !== who) continue;
    if (e.zone) {
      const q = zones[e.zone] || (zones[e.zone] = { t: 0, g: 0 });
      q.t += 1;
      if (e.kind === 'goal') q.g += 1;
    }
    const gz = e.goalZone;
    if (gz && GOAL_ZONES.includes(gz)) {
      const q = cells[gz] || (cells[gz] = { g: 0, s: 0 });
      if (e.kind === 'goal') q.g += 1; else q.s += 1;
    } else if (gz === OUT_ZONES[0]) outs.top += 1;
    else if (gz === OUT_ZONES[1]) outs.left += 1;
    else if (gz === OUT_ZONES[2]) outs.right += 1;
    else if (gz === POST_ZONES[0]) outs.pl += 1;
    else if (gz === POST_ZONES[1]) outs.bar += 1;
    else if (gz === POST_ZONES[2]) outs.pr += 1;
  }
  return { zones, cells, outs };
}

export default function LiveStats({
  state, team, shotEvents = [], rivalGoals = [], rivalMisses = [], rivalExclusions = [],
  rivalYellowCards = [], teamActions = [], compact = false,
}) {
  const [who, setWho] = useState('own'); // 'own' | 'rival'
  const [tab, setTab] = useState('players'); // 'players' | 'zones'
  const [sort, setSort] = useState({ key: 'gt', dir: 'desc' });
  const [metric, setMetric] = useState('goals'); // 'goals' | 'misses'
  const [pick, setPick] = useState(''); // jugador o dorsal concreto en «Zonas»

  const players = useMemo(() => Object.values(state.players).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)), [state.players]);
  const own = who === 'own';
  const q = useMemo(
    () => (own ? ownStats(state) : rivalStats({ rivalGoals, rivalMisses, teamActions, rivalExclusions, rivalYellowCards })),
    [own, state, rivalGoals, rivalMisses, teamActions, rivalExclusions, rivalYellowCards]
  );
  const ids = own
    ? players.map((p) => p.id)
    : Object.keys(q).filter((k) => k !== '?').sort((a, b) => Number(a) - Number(b)).concat(q['?'] ? ['?'] : []);
  const nameOf = (id) => (own ? `#${state.players[id]?.number ?? '?'} ${state.players[id]?.name ?? ''}`.trim() : id === '?' ? 'Sin dorsal' : `#${id}`);
  const stat = (id) => q[id] || EMPTY;
  const cols = COLS[who];

  const raw = (id, k) => stat(id)[{ gt: 'g', gp: 'g', pt: 'sv', pp: 'sv' }[k] || k];
  const sortVal = (id, k) => {
    const s = stat(id);
    if (k === 'gt') return s.g * 1000 + (s.t ? Math.round((s.g * 100) / s.t) : 0);
    if (k === 'pt') return s.f ? s.sv * 1000 + Math.round((s.sv * 100) / s.f) : -1;
    if (k === 'gp') return s.t ? Math.round((s.g * 100) / s.t) : -1;
    if (k === 'pp') return s.f ? Math.round((s.sv * 100) / s.f) : -1;
    if (k === 'n') return own ? (state.players[id]?.number ?? 0) : id === '?' ? 999 : Number(id);
    return s[k];
  };
  const maxOf = {};
  for (const [k] of cols) if (k !== 'n') maxOf[k] = Math.max(0, ...ids.map((id) => raw(id, k)));
  const sorted = [...ids].sort((a, b) => {
    const d = sortVal(a, sort.key) - sortVal(b, sort.key);
    return (sort.dir === 'desc' ? -d : d) || sortVal(a, 'n') - sortVal(b, 'n');
  });
  const setSortKey = (k) => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 'desc' ? 'asc' : 'desc') : (k === 'n' ? 'asc' : 'desc') }));

  const leaders = LEADS[who].map(([label, k]) => {
    const best = Math.max(0, ...ids.map((id) => raw(id, k)));
    const names = best === 0 ? '—' : ids.filter((id) => raw(id, k) === best).map(nameOf).join('\n');
    return { label, n: best, who: names };
  });

  // Zonas: los tiros de cada equipo con su origen y su entrada.
  const shots = useMemo(() => (own
    ? shotEvents.map((e) => ({ id: e.playerId, kind: e.type, zone: e.shotZone, goalZone: e.goalZone }))
    : [
      ...rivalGoals.map((e) => ({ id: e.number == null ? '?' : String(e.number), kind: 'goal', zone: e.shotZone, goalZone: e.goalZone })),
      ...rivalMisses.map((e) => ({ id: e.number == null ? '?' : String(e.number), kind: 'miss', zone: e.shotZone, goalZone: e.goalZone })),
    ]), [own, shotEvents, rivalGoals, rivalMisses]);
  const shooters = useMemo(() => {
    const count = {};
    for (const s of shots) count[s.id] = (count[s.id] || 0) + 1;
    return count;
  }, [shots]);
  const pickIds = (own ? players.map((p) => p.id) : Object.keys(shooters).filter((k) => k !== '?').sort((a, b) => Number(a) - Number(b))).filter((id) => shooters[id] > 0);
  const zs = zoneStats(shots, pick);

  const crest = (k) => {
    const name = k === 'own' ? state.ownTeamName : state.rivalName;
    const url = k === 'own' ? team?.crestUrl : state.rivalCrestUrl;
    return (
      <button key={k} type="button" className={`ls-team ls-team--${k}${who === k ? ' ls-team--on' : ''}`} onClick={() => { setWho(k); setPick(''); setSort({ key: 'gt', dir: 'desc' }); }} aria-pressed={who === k} aria-label={name}>
        <i>{url ? <img src={url} alt="" /> : teamInitials(name)}</i>
        {!compact && <span>{name}</span>}
      </button>
    );
  };

  const cellFor = (id, k) => {
    const s = stat(id);
    const v = raw(id, k);
    let shown = v === 0 ? '·' : String(v);
    if (k === 'gt') shown = s.t ? `${s.g}/${s.t}` : '·';
    if (k === 'pt') shown = s.f ? `${s.sv}/${s.f}` : '·';
    if (k === 'gp') shown = s.t ? `${Math.round((s.g * 100) / s.t)}%` : '·';
    if (k === 'pp') shown = s.f ? `${Math.round((s.sv * 100) / s.f)}%` : '·';
    const has = k === 'gt' || k === 'gp' ? s.t > 0 : k === 'pt' || k === 'pp' ? s.f > 0 : v > 0;
    const lead = v > 0 && v === maxOf[k] && k !== 'gp' && k !== 'pp';
    return { shown, cls: `ls-td${lead ? ' ls-td--l' : ''}${!has ? ' ls-td--z' : ''}` };
  };
  const grid = { gridTemplateColumns: `${own ? '128px' : '84px'} repeat(${cols.length - 1}, minmax(0, 1fr))` };

  return (
    <div className={`ls${compact ? ' ls--compact' : ''}`}>
      <div className="ls-head">
        <div className="ls-teams">{crest('own')}{crest('rival')}</div>
        <div className="ls-seg" role="group" aria-label="Qué ver">
          <button type="button" className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>{own ? 'Jugadores' : 'Dorsales'}</button>
          <button type="button" className={tab === 'zones' ? 'on' : ''} onClick={() => setTab('zones')}>Zonas</button>
        </div>
      </div>

      {tab === 'players' && (
        <>
          <div className="ls-leads">
            {leaders.map((l) => (
              <div key={l.label} className="ls-lead">
                <div className="ls-lead-l">{l.label}</div>
                <div className="ls-lead-n">{l.n}</div>
                <div className="ls-lead-w">{l.who}</div>
              </div>
            ))}
          </div>
          <div className="ls-tscroll">
            <div className="ls-tin">
              <div className="ls-tg ls-tgh" style={grid}>
                {cols.map(([k, label]) => (
                  <button key={k} type="button" className={`ls-th${k === 'n' ? ' ls-th--n' : ''}${sort.key === k ? ' ls-th--s' : ''}`} onClick={() => setSortKey(k)}>
                    {label}{sort.key === k ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                  </button>
                ))}
              </div>
              <div className="ls-tg" style={grid}>
                {sorted.flatMap((id) => cols.map(([k]) => {
                  if (k === 'n') return <span key={`${id}-n`} className="ls-td ls-td--n">{nameOf(id)}</span>;
                  const c = cellFor(id, k);
                  return <span key={`${id}-${k}`} className={c.cls}>{c.shown}</span>;
                }))}
              </div>
              {sorted.length === 0 && <p className="ls-empty">Todavía no hay acciones del rival con dorsal.</p>}
            </div>
          </div>
        </>
      )}

      {tab === 'zones' && (
        <>
          <div className="ls-seg ls-seg--full" role="group" aria-label="Qué mapa">
            <button type="button" className={metric === 'goals' ? 'on' : ''} onClick={() => setMetric('goals')}>Goles (goles/tiros)</button>
            <button type="button" className={metric === 'misses' ? 'on' : ''} onClick={() => setMetric('misses')}>Fallos</button>
          </div>
          <div className="ls-who">
            <button type="button" className={`ls-chip${!pick ? ' ls-chip--sel' : ''}`} onClick={() => setPick('')}>Todos</button>
            {pickIds.map((id) => (
              <button key={id} type="button" className={`ls-chip${pick === id ? ' ls-chip--sel' : ''}`} onClick={() => setPick(id)}>
                #{own ? state.players[id]?.number : id}
              </button>
            ))}
          </div>
          <StatsBoard zones={zs.zones} cells={zs.cells} outs={zs.outs} goalsView={metric === 'goals'} />
        </>
      )}
    </div>
  );
}
