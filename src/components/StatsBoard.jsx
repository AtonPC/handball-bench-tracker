import { GOAL_ZONES } from '../shotZones';
import { BOARD_ZONES, zoneClipPath, zoneLabelPoint } from '../utils/shotBoard';
import { useBoardScale } from '../hooks/useIsPhone';

// Portería y cancha en modo LECTURA con mapa de calor (mockup aprobado, 2026-09-21): la
// misma geometría que el panel LANZAMIENTO (ShotBoard) pero sin botones. Cada zona lleva
// su número y un color más intenso cuanto más pasa en ella: verde en «Goles», rojo en
// «Fallos». En «Goles» la zona pone goles/tiros; en «Fallos», los fallos.
//  - zones: { [zona de origen]: { t: tiros, g: goles } }
//  - cells: { [cuadrante de la portería]: { g: goles, s: fallos que entraron ahí (paradas) } }
//  - outs:  { top, left, right, pl, bar, pr } (fuera y palos, siempre fallos)
function heat(v, max, goals) {
  const a = v > 0 ? 0.14 + (0.6 * v) / Math.max(1, max) : 0.04;
  return goals ? `rgba(22,121,75,${a.toFixed(2)})` : `rgba(192,57,43,${a.toFixed(2)})`;
}

export default function StatsBoard({ zones, cells, outs, goalsView }) {
  const scale = useBoardScale();
  const { k, gk } = scale;
  const zval = (name) => {
    const q = zones[name];
    return q ? (goalsView ? q.g : q.t - q.g) : 0;
  };
  const zmax = Math.max(1, ...BOARD_ZONES.map((z) => zval(z.zone)), zval('7 metros'));
  const cval = (name) => {
    const q = cells[name];
    return q ? (goalsView ? q.g : q.s) : 0;
  };
  const cmax = Math.max(1, ...GOAL_ZONES.map(cval));
  const seven = zones['7 metros'] || { t: 0, g: 0 };
  const outTxt = (n) => (goalsView ? '—' : String(n));

  return (
    <div className="sb-stat">
      <div className="sb" style={{ '--k': k, '--gk': gk }}>
        <div className="sb-goalwrap">
          <div className="sb-out sb-out--top sb-out--stat">{outTxt(outs.top)}</div>
          <div className="sb-out sb-out--left sb-out--stat">{outTxt(outs.left)}</div>
          <div className="sb-goal">
            <div className="sb-net">
              {GOAL_ZONES.map((z) => (
                <div key={z} className="sb-cell sb-cell--stat" style={{ background: heat(cval(z), cmax, goalsView) }} aria-label={z}>{cval(z) ? cval(z) : '·'}</div>
              ))}
            </div>
            <div className="sb-bar sb-bar--h" />
            <div className="sb-bar sb-bar--l" />
            <div className="sb-bar sb-bar--r" />
          </div>
          <div className="sb-out sb-out--right sb-out--stat">{outTxt(outs.right)}</div>
        </div>

        <div className="sb-court">
          <div className="sb-six" />
          <div className="sb-nine" />
          {BOARD_ZONES.map((z) => (
            <div key={z.zone} className="sb-zone sb-zone--stat" style={{ clipPath: zoneClipPath(z, k), background: heat(zval(z.zone), zmax, goalsView) }} aria-label={z.zone} />
          ))}
          {BOARD_ZONES.map((z) => {
            const [x, y] = zoneLabelPoint(z, k);
            const q = zones[z.zone] || { t: 0, g: 0 };
            return <span key={`l-${z.zone}`} className="sb-zl sb-zl--n" style={{ left: x - 22, top: y - 7 }}>{goalsView ? `${q.g}/${q.t}` : q.t - q.g}</span>;
          })}
          <div className="sb-seven sb-seven--stat">{goalsView ? `7 m ${seven.g}/${seven.t}` : `7 m ${seven.t - seven.g}`}</div>
        </div>
      </div>
      <p className="sb-post">
        Palos: izquierdo {outs.pl} · larguero {outs.bar} · derecho {outs.pr}
        {goalsView ? '' : '   (los «fuera» y los palos cuentan como fallo)'}
      </p>
    </div>
  );
}
