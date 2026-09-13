import { GOAL_ZONES, OUT_ZONES, SHOT_ZONES } from '../shotZones';

// Diagrama visual de portería + cancha, en dos modos:
// - Interactivo (por defecto): tocar una zona la selecciona (mismo dato de
//   siempre — shotZone/goalZone son las cadenas de shotZones.js — solo
//   cambia cómo se elige, ahora sobre un dibujo en vez de una rejilla de
//   botones).
// - Solo lectura (`readOnly`): cada zona muestra el texto que le pase
//   `originStats`/`goalStats` (p. ej. "3/5" y "60%") en vez de reaccionar
//   al toque — para las estadísticas de después del partido.
// La portería se dibuja como una portería de verdad (postes/larguero a
// rayas, red de fondo), y la zona de lanzamiento como un abanico de 5
// sectores desde el centro de la portería (extremo izq./izquierda/centro/
// derecha/extremo der. — SHOT_ZONES menos "7 metros") más un punto propio
// de 7 metros en la línea de penalti, en vez de simples rectángulos.
const ORIGIN_ZONES = SHOT_ZONES.filter((z) => z !== '7 metros');

const GOAL_X = 50, GOAL_Y = 40, GOAL_W = 200, GOAL_H = 110;
const CELL_W = GOAL_W / 3, CELL_H = GOAL_H / 3;
const POST_T = 8; // grosor del poste/larguero dibujado
const OUT_Y = 8, OUT_H = 22;

const FAN_CX = 150, FAN_CY = GOAL_Y + GOAL_H + 10; // justo debajo de la portería
const FAN_R0 = 16, FAN_R1 = 145;
const FAN_SPAN = 75; // de -75° a +75°, 5 sectores de 30°
const SEVEN_M_R = 65;
const VIEW_H = FAN_CY + FAN_R1 + 15;

function fanPoint(r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: FAN_CX + r * Math.sin(rad), y: FAN_CY + r * Math.cos(rad) };
}

function wedgePath(a1, a2, r0, r1) {
  const p1 = fanPoint(r0, a1);
  const p2 = fanPoint(r1, a1);
  const p3 = fanPoint(r1, a2);
  const p4 = fanPoint(r0, a2);
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r1} ${r1} 0 0 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${r0} ${r0} 0 0 0 ${p1.x} ${p1.y} Z`;
}

function ZoneCell({ shape, x, y, w, h, active, dashed, onClick, label, statLines }) {
  const centerX = shape ? undefined : x + w / 2;
  const centerY = shape ? undefined : y + h / 2;
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {shape ? (
        <path d={shape.d} className={`zone-shape${active ? ' zone-shape--active' : ''}`} />
      ) : (
        <rect x={x} y={y} width={w} height={h} className={`zone-shape${active ? ' zone-shape--active' : ''}${dashed ? ' zone-shape--out' : ''}`} />
      )}
      {statLines ? (
        <text x={shape ? shape.labelX : centerX} y={shape ? shape.labelY : centerY} textAnchor="middle" className="zone-shape-stat">
          {statLines.map((line, i) => (
            <tspan key={i} x={shape ? shape.labelX : centerX} dy={i === 0 ? -6 : 14}>{line}</tspan>
          ))}
        </text>
      ) : (
        <text x={shape ? shape.labelX : centerX} y={shape ? shape.labelY : centerY} textAnchor="middle" dominantBaseline="middle" className="zone-shape-label">
          {label}
        </text>
      )}
    </g>
  );
}

export default function ShotZoneDiagram({
  showGoal = true,
  showOut = false,
  showOrigin = true,
  shotZone, onShotZone,
  goalZone, onGoalZone,
  readOnly = false,
  originStats, // { [zone]: string[] } — líneas de texto a mostrar en modo lectura
  goalStats,
}) {
  function goalCellRect(i) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return { x: GOAL_X + col * CELL_W, y: GOAL_Y + row * CELL_H, w: CELL_W, h: CELL_H };
  }

  const wedgeAngles = ORIGIN_ZONES.map((_, i) => {
    const a1 = -FAN_SPAN + i * ((2 * FAN_SPAN) / ORIGIN_ZONES.length);
    const a2 = -FAN_SPAN + (i + 1) * ((2 * FAN_SPAN) / ORIGIN_ZONES.length);
    return [a1, a2];
  });

  return (
    <svg viewBox={`0 0 300 ${showOrigin ? VIEW_H : GOAL_Y + GOAL_H + 40}`} className="shot-zone-diagram" role="img" aria-label="Diagrama de portería y cancha">
      <defs>
        <pattern id="goal-net" width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 0 L9 9 M9 0 L0 9" className="goal-net-line" />
        </pattern>
      </defs>

      {showGoal && (
        <>
          <rect x={GOAL_X} y={GOAL_Y} width={GOAL_W} height={GOAL_H} fill="url(#goal-net)" />
          {/* Postes y larguero a rayas, por encima de la red */}
          <g className="goal-frame-stripes">
            {Array.from({ length: Math.ceil(GOAL_H / POST_T) }).map((_, i) => (
              <rect key={`l${i}`} x={GOAL_X - POST_T} y={GOAL_Y + i * POST_T} width={POST_T} height={POST_T} className={i % 2 === 0 ? 'goal-post-red' : 'goal-post-white'} />
            ))}
            {Array.from({ length: Math.ceil(GOAL_H / POST_T) }).map((_, i) => (
              <rect key={`r${i}`} x={GOAL_X + GOAL_W} y={GOAL_Y + i * POST_T} width={POST_T} height={POST_T} className={i % 2 === 0 ? 'goal-post-red' : 'goal-post-white'} />
            ))}
            {Array.from({ length: Math.ceil((GOAL_W + POST_T * 2) / POST_T) }).map((_, i) => (
              <rect key={`t${i}`} x={GOAL_X - POST_T + i * POST_T} y={GOAL_Y - POST_T} width={POST_T} height={POST_T} className={i % 2 === 0 ? 'goal-post-red' : 'goal-post-white'} />
            ))}
          </g>
          {GOAL_ZONES.map((z, i) => {
            const r = goalCellRect(i);
            return (
              <ZoneCell
                key={z}
                {...r}
                active={goalZone === z}
                onClick={readOnly ? undefined : () => onGoalZone(goalZone === z ? null : z)}
                statLines={goalStats?.[z]}
              />
            );
          })}
          {showOut && OUT_ZONES.map((z, i) => (
            <ZoneCell
              key={z}
              x={GOAL_X + i * (GOAL_W / 3)}
              y={OUT_Y}
              w={GOAL_W / 3}
              h={OUT_H}
              dashed
              active={goalZone === z}
              onClick={readOnly ? undefined : () => onGoalZone(goalZone === z ? null : z)}
              label={readOnly ? undefined : 'Fuera'}
              statLines={goalStats?.[z]}
            />
          ))}
        </>
      )}

      {showOrigin && (
        <>
          {ORIGIN_ZONES.map((z, i) => {
            const [a1, a2] = wedgeAngles[i];
            const mid = fanPoint((FAN_R0 + FAN_R1) / 2, (a1 + a2) / 2);
            const shortLabel = { 'Extremo izquierdo': 'Ext. izq.', Izquierda: 'Izq.', Centro: 'Centro', Derecha: 'Der.', 'Extremo derecho': 'Ext. der.' }[z];
            return (
              <ZoneCell
                key={z}
                shape={{ d: wedgePath(a1, a2, FAN_R0, FAN_R1), labelX: mid.x, labelY: mid.y }}
                active={shotZone === z}
                onClick={readOnly ? undefined : () => onShotZone(shotZone === z ? null : z)}
                label={readOnly ? undefined : shortLabel}
                statLines={originStats?.[z]}
              />
            );
          })}
          <g
            onClick={readOnly ? undefined : () => onShotZone(shotZone === '7 metros' ? null : '7 metros')}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
          >
            <circle
              cx={FAN_CX} cy={FAN_CY + SEVEN_M_R} r={18}
              className={`zone-shape zone-shape--seven${shotZone === '7 metros' ? ' zone-shape--active' : ''}`}
            />
            {originStats?.['7 metros'] ? (
              <text x={FAN_CX} y={FAN_CY + SEVEN_M_R} textAnchor="middle" className="zone-shape-stat">
                {originStats['7 metros'].map((line, i) => (
                  <tspan key={i} x={FAN_CX} dy={i === 0 ? -6 : 14}>{line}</tspan>
                ))}
              </text>
            ) : (
              <text x={FAN_CX} y={FAN_CY + SEVEN_M_R} textAnchor="middle" dominantBaseline="middle" className="zone-shape-label">7m</text>
            )}
          </g>
        </>
      )}
    </svg>
  );
}
