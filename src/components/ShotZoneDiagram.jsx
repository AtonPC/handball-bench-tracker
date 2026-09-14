import { GOAL_ZONES, OUT_ZONES } from '../shotZones';

// Diagrama visual de portería + cancha, en dos modos:
// - Interactivo (por defecto): tocar una zona la selecciona (mismo dato de
//   siempre — shotZone/goalZone son las cadenas de shotZones.js — solo
//   cambia cómo se elige, ahora sobre un dibujo en vez de una rejilla de
//   botones).
// - Solo lectura (`readOnly`): cada zona muestra el texto que le pase
//   `originStats`/`goalStats` (p. ej. "3/5" y "60%") en vez de reaccionar
//   al toque — para las estadísticas de después del partido.
// La portería se dibuja como una portería de verdad (postes/larguero a
// rayas, red de fondo), pegada directamente al área. Debajo: el área de
// 6m en azul sólido — con el lado plano pegado a la portería y solo el
// lado de abajo curvado, como un área de verdad, no un simple sector de
// abanico — la línea de 9m de puntos (como se entrena tirar) y dos
// anillos de zonas clicables alrededor de esas líneas — anillo cercano
// (5, junto al área: extremo izq./lateral izq./central/lateral der.
// /extremo der.) y anillo lejano (3, solo los 3 puestos centrales, ya
// pasada la línea de 9m) — más el punto de 7 metros dentro del área,
// pequeño para no comerse el hueco de "Central" que no es de 7m. Eso son
// las 8 zonas de origen clicables + 7m de SHOT_ZONES. Sin nombres de zona
// dibujados encima (solo "7m") — el dato se sigue guardando igual, es
// solo que ya no se rotula cada zona en pantalla.
const INNER_ORIGIN_ZONES = ['Extremo izquierdo', 'Lateral izquierdo', 'Central', 'Lateral derecho', 'Extremo derecho'];
const OUTER_ORIGIN_ZONES = ['Lateral izquierdo 9m', 'Central 9m', 'Lateral derecho 9m'];

const GOAL_X = 50, GOAL_Y = 40, GOAL_W = 200, GOAL_H = 110;
const CELL_W = GOAL_W / 3, CELL_H = GOAL_H / 3;
const POST_T = 8; // grosor del poste/larguero dibujado
const OUT_Y = 8;
const OUT_TOP_H = GOAL_Y - POST_T - OUT_Y; // hueco entre el borde y el larguero
const OUT_SIDE_H = GOAL_Y + GOAL_H - OUT_Y; // misma altura que portería + hueco de arriba
const VIEW_W = 300;

const FAN_CX = 150, FAN_CY = GOAL_Y + GOAL_H; // pegado a la línea de gol, sin hueco
const FAN_SPAN = 75; // de -75° a +75°: 5 sectores de 30° en el anillo cercano
const AREA_RX = GOAL_W / 2, AREA_RY = 58; // semiejes de la elipse del área (misma que areaDomePath)
const SEVEN_M_R = 68; // punto de 7m: justo fuera del área, antes de los 9m
// El radio de la línea de 9m y del borde exterior no tienen que quedar
// alineados con la proyección de los postes — los agrandamos para que las
// zonas sean cómodas de tocar en móvil/tablet, aunque la punta lejana del
// anillo exterior se salga del recuadro visible en los extremos.
const NINE_M_R = 155; // línea de 9m de puntos = límite entre los dos anillos
const OUTER_R1 = 215; // borde exterior del anillo lejano (9m)
const VIEW_H = FAN_CY + OUTER_R1 + 15;

function fanPoint(r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: FAN_CX + r * Math.sin(rad), y: FAN_CY + r * Math.cos(rad) };
}

function wedgePath(a1, a2, r0, r1) {
  const p1 = fanPoint(r0, a1);
  const p2 = fanPoint(r1, a1);
  const p3 = fanPoint(r1, a2);
  const p4 = fanPoint(r0, a2);
  // sweep-flag 0 en el arco exterior y 1 en el interior: con nuestro
  // centro (el de la portería) por encima de ambas cuerdas, es la única
  // combinación que curva los dos arcos hacia fuera (lejos de portería),
  // no hacia dentro/arriba — comprobado con la fórmula de conversión de
  // arco SVG (endpoint→center), no a ojo.
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r1} ${r1} 0 0 0 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${r0} ${r0} 0 0 1 ${p1.x} ${p1.y} Z`;
}

// Solo el arco (sin cerrar), para dibujar la línea de 9m de puntos. Mismo
// sweep-flag 0 que el arco exterior de wedgePath, para que curve en el
// mismo sentido que el área (lejos de portería), no al revés.
function arcPath(r, a1, a2) {
  const p1 = fanPoint(r, a1);
  const p2 = fanPoint(r, a2);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 0 ${p2.x} ${p2.y}`;
}

// Área de 6m: lado plano pegado a la portería (de poste a poste) y solo
// el lado de abajo curvado hacia el centro de la cancha — no un sector de
// abanico que acaba en punta contra la portería.
function areaDomePath() {
  return `M ${GOAL_X} ${FAN_CY} A ${AREA_RX} ${AREA_RY} 0 0 0 ${GOAL_X + GOAL_W} ${FAN_CY} Z`;
}

// Radio (desde el mismo centro que fanPoint) al que el borde del área
// corta un ángulo dado — el área es la MISMA elipse de areaDomePath, ya
// centrada justo en ese punto, así que el anillo cercano puede arrancar
// exactamente en su borde en vez de en un radio fijo que unas veces se
// queda corto y otras se mete dentro del área.
function areaEdgeRadius(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const s = Math.sin(rad), c = Math.cos(rad);
  return 1 / Math.sqrt((s * s) / (AREA_RX * AREA_RX) + (c * c) / (AREA_RY * AREA_RY));
}

// Zona del anillo cercano: el borde de dentro sigue el borde real del
// área (la elipse, no un círculo) y el de fuera es la línea de 9m —
// pegada al área, sin hueco y sin meterse dentro.
function innerWedgePath(a1, a2, r1) {
  const pA1 = fanPoint(areaEdgeRadius(a1), a1);
  const pOut1 = fanPoint(r1, a1);
  const pOut2 = fanPoint(r1, a2);
  const pA2 = fanPoint(areaEdgeRadius(a2), a2);
  return `M ${pA1.x} ${pA1.y} L ${pOut1.x} ${pOut1.y} A ${r1} ${r1} 0 0 0 ${pOut2.x} ${pOut2.y} L ${pA2.x} ${pA2.y} A ${AREA_RX} ${AREA_RY} 0 0 1 ${pA1.x} ${pA1.y} Z`;
}

function ZoneCell({ shape, x, y, w, h, active, dashed, onClick, label, statLines, fillColor }) {
  const centerX = shape ? undefined : x + w / 2;
  const centerY = shape ? undefined : y + h / 2;
  // fillColor es el mapa de calor de las estadísticas (solo lectura): un
  // color inline pisa el "sin relleno hasta pulsar" de siempre, que sigue
  // aplicando tal cual en el diagrama interactivo (fillColor nunca llega
  // ahí, solo lo pasan las vistas de estadísticas).
  const style = fillColor ? { fill: fillColor } : undefined;
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {shape ? (
        <path d={shape.d} style={style} className={`zone-shape${active ? ' zone-shape--active' : ''}`} />
      ) : (
        <rect x={x} y={y} width={w} height={h} style={style} className={`zone-shape${active ? ' zone-shape--active' : ''}${dashed ? ' zone-shape--out' : ''}`} />
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
  originColors, // { [zone]: color } — mapa de calor opcional, solo en modo lectura
  goalColors,
}) {
  function goalCellRect(i) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return { x: GOAL_X + col * CELL_W, y: GOAL_Y + row * CELL_H, w: CELL_W, h: CELL_H };
  }

  // Anillo cercano: 5 sectores iguales de -75° a 75°. El anillo lejano (9m)
  // reutiliza las fronteras de los 3 sectores centrales (índices 1..3).
  const innerAngles = INNER_ORIGIN_ZONES.map((_, i) => {
    const step = (2 * FAN_SPAN) / INNER_ORIGIN_ZONES.length;
    return [-FAN_SPAN + i * step, -FAN_SPAN + (i + 1) * step];
  });
  const outerAngles = innerAngles.slice(1, 1 + OUTER_ORIGIN_ZONES.length);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${showOrigin ? VIEW_H : GOAL_Y + GOAL_H + 40}`} className="shot-zone-diagram" role="img" aria-label="Diagrama de portería y cancha">
      <defs>
        <pattern id="goal-net" width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 0 L9 9 M9 0 L0 9" className="goal-net-line" />
        </pattern>
        <pattern id="court-wood" width="26" height="14" patternUnits="userSpaceOnUse">
          <rect width="26" height="14" className="wood-plank-a" />
          <rect x="13" width="13" height="14" className="wood-plank-b" />
          <line x1="6.5" y1="0" x2="6.5" y2="14" className="wood-grain-line" />
          <line x1="19.5" y1="0" x2="19.5" y2="14" className="wood-grain-line" />
        </pattern>
      </defs>

      {showOrigin && (
        <>
          {/* Suelo: pista de parquet, separada de la pared (portería) por la línea de gol */}
          <rect x={0} y={FAN_CY} width={VIEW_W} height={VIEW_H - FAN_CY} fill="url(#court-wood)" />
          <line x1={0} y1={FAN_CY} x2={VIEW_W} y2={FAN_CY} className="court-divider-line" />
        </>
      )}

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
                fillColor={goalColors?.[z]}
              />
            );
          })}
          {showOut && (() => {
            const [arriba, izquierda, derecha] = OUT_ZONES;
            const outRects = {
              [arriba]: { x: GOAL_X - POST_T, y: OUT_Y, w: GOAL_W + POST_T * 2, h: OUT_TOP_H },
              [izquierda]: { x: 0, y: OUT_Y, w: GOAL_X - POST_T, h: OUT_SIDE_H },
              [derecha]: { x: GOAL_X + GOAL_W + POST_T, y: OUT_Y, w: VIEW_W - (GOAL_X + GOAL_W + POST_T), h: OUT_SIDE_H },
            };
            return OUT_ZONES.map((z) => (
              <ZoneCell
                key={z}
                x={outRects[z].x}
                y={outRects[z].y}
                w={outRects[z].w}
                h={outRects[z].h}
                dashed
                active={goalZone === z}
                onClick={readOnly ? undefined : () => onGoalZone(goalZone === z ? null : z)}
                statLines={goalStats?.[z]}
                fillColor={goalColors?.[z]}
              />
            ));
          })()}
        </>
      )}

      {showOrigin && (
        <>
          {/* Área de 6m, pintada en azul, debajo de las zonas clicables */}
          <path d={areaDomePath()} className="zone-area-fill" />

          {INNER_ORIGIN_ZONES.map((z, i) => {
            const [a1, a2] = innerAngles[i];
            const midAngle = (a1 + a2) / 2;
            const mid = fanPoint((areaEdgeRadius(midAngle) + NINE_M_R) / 2, midAngle);
            return (
              <ZoneCell
                key={z}
                shape={{ d: innerWedgePath(a1, a2, NINE_M_R), labelX: mid.x, labelY: mid.y }}
                active={shotZone === z}
                onClick={readOnly ? undefined : () => onShotZone(shotZone === z ? null : z)}
                statLines={originStats?.[z]}
                fillColor={originColors?.[z]}
              />
            );
          })}

          {/* Línea de 9m de puntos: donde entrenan a tirar, límite entre los dos anillos */}
          <path d={arcPath(NINE_M_R, -FAN_SPAN, FAN_SPAN)} className="nine-m-line" />

          {OUTER_ORIGIN_ZONES.map((z, i) => {
            const [a1, a2] = outerAngles[i];
            const mid = fanPoint((NINE_M_R + OUTER_R1) / 2, (a1 + a2) / 2);
            return (
              <ZoneCell
                key={z}
                shape={{ d: wedgePath(a1, a2, NINE_M_R, OUTER_R1), labelX: mid.x, labelY: mid.y }}
                active={shotZone === z}
                onClick={readOnly ? undefined : () => onShotZone(shotZone === z ? null : z)}
                statLines={originStats?.[z]}
                fillColor={originColors?.[z]}
              />
            );
          })}

          <g
            onClick={readOnly ? undefined : () => onShotZone(shotZone === '7 metros' ? null : '7 metros')}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
          >
            <circle
              cx={FAN_CX} cy={FAN_CY + SEVEN_M_R} r={12}
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
