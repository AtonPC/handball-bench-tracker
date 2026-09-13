import { GOAL_ZONES, OUT_ZONES } from '../shotZones';

// Diagrama visual de portería + cancha, en dos modos:
// - Interactivo (por defecto): tocar una zona la selecciona (mismo dato de
//   siempre — shotZone/goalZone son las cadenas de shotZones.js — solo
//   cambia cómo se elige, ahora sobre un dibujo en vez de una rejilla de
//   botones).
// - Solo lectura (`readOnly`): cada zona muestra el texto que le pase
//   `originStats`/`goalStats` (p. ej. "3/5" y "60%") en vez de reaccionar
//   al toque — para las estadísticas de después del partido.
// "7 metros" es una zona de origen aparte, sin lado, así que se dibuja
// como un punto propio en la línea de 7m, no como parte de los tres
// carriles izquierda/centro/derecha.
const GOAL_X = 20, GOAL_Y = 40, GOAL_W = 200, GOAL_H = 110;
const CELL_W = GOAL_W / 3, CELL_H = GOAL_H / 3;
const OUT_Y = 10, OUT_H = 24;
const COURT_TOP = 175, COURT_BOTTOM = 320, COURT_X = 10, COURT_W = 220;
const SEVEN_M_Y = 205, SEVEN_M_R = 20;

function ZoneCell({ x, y, w, h, active, dashed, onClick, label, statLines }) {
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <rect
        x={x} y={y} width={w} height={h}
        className={`zone-shape${active ? ' zone-shape--active' : ''}${dashed ? ' zone-shape--out' : ''}`}
      />
      {statLines ? (
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" className="zone-shape-stat">
          {statLines.map((line, i) => (
            <tspan key={i} x={x + w / 2} dy={i === 0 ? -6 : 14}>{line}</tspan>
          ))}
        </text>
      ) : (
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" className="zone-shape-label">
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
  const viewHeight = showOrigin ? COURT_BOTTOM + 10 : (showOut ? GOAL_Y + GOAL_H + 20 : GOAL_H + 60);

  function goalCellRect(i) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return { x: GOAL_X + col * CELL_W, y: GOAL_Y + row * CELL_H, w: CELL_W, h: CELL_H };
  }

  return (
    <svg viewBox={`0 0 240 ${viewHeight}`} className="shot-zone-diagram" role="img" aria-label="Diagrama de portería y cancha">
      {showGoal && (
        <>
          <rect x={GOAL_X - 4} y={GOAL_Y - 4} width={GOAL_W + 8} height={GOAL_H + 8} className="goal-frame" />
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
          <path
            d={`M ${COURT_X} ${COURT_TOP} A ${COURT_W / 2} ${COURT_BOTTOM - COURT_TOP} 0 0 0 ${COURT_X + COURT_W} ${COURT_TOP}`}
            className="court-arc"
          />
          <ZoneCell
            x={COURT_X} y={COURT_TOP} w={COURT_W / 3} h={COURT_BOTTOM - COURT_TOP}
            active={shotZone === 'Izquierda'}
            onClick={readOnly ? undefined : () => onShotZone(shotZone === 'Izquierda' ? null : 'Izquierda')}
            label={readOnly ? undefined : 'Izq.'}
            statLines={originStats?.Izquierda}
          />
          <ZoneCell
            x={COURT_X + COURT_W / 3} y={COURT_TOP} w={COURT_W / 3} h={COURT_BOTTOM - COURT_TOP}
            active={shotZone === 'Centro'}
            onClick={readOnly ? undefined : () => onShotZone(shotZone === 'Centro' ? null : 'Centro')}
            label={readOnly ? undefined : 'Centro'}
            statLines={originStats?.Centro}
          />
          <ZoneCell
            x={COURT_X + (2 * COURT_W) / 3} y={COURT_TOP} w={COURT_W / 3} h={COURT_BOTTOM - COURT_TOP}
            active={shotZone === 'Derecha'}
            onClick={readOnly ? undefined : () => onShotZone(shotZone === 'Derecha' ? null : 'Derecha')}
            label={readOnly ? undefined : 'Der.'}
            statLines={originStats?.Derecha}
          />
          <g
            onClick={readOnly ? undefined : () => onShotZone(shotZone === '7 metros' ? null : '7 metros')}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
          >
            <circle
              cx={120} cy={SEVEN_M_Y} r={SEVEN_M_R}
              className={`zone-shape zone-shape--seven${shotZone === '7 metros' ? ' zone-shape--active' : ''}`}
            />
            {originStats?.['7 metros'] ? (
              <text x={120} y={SEVEN_M_Y} textAnchor="middle" className="zone-shape-stat">
                {originStats['7 metros'].map((line, i) => (
                  <tspan key={i} x={120} dy={i === 0 ? -6 : 14}>{line}</tspan>
                ))}
              </text>
            ) : (
              <text x={120} y={SEVEN_M_Y} textAnchor="middle" dominantBaseline="middle" className="zone-shape-label">7m</text>
            )}
          </g>
        </>
      )}
    </svg>
  );
}
