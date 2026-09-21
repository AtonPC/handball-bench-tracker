import { GOAL_ZONES, OUT_ZONES, POST_ZONES } from '../shotZones';
import { BOARD_ZONES, zoneClipPath, zoneLabelPoint } from '../utils/shotBoard';

// Portería + cancha del panel LANZAMIENTO (mockup aprobado, 2026-09-21): la
// portería arriba y la cancha debajo, todo tocable a la vez.
//  - Cancha: 8 zonas de origen + el punto de 7 m, cortadas justo sobre el área
//    de 6 m y la línea de 9 m (geometría en utils/shotBoard.js).
//  - Portería: los 9 cuadrantes; los 3 «fuera» (a los lados y arriba) y los
//    palos/larguero, que son las tiras rojiblancas del marco. Un cuadrante solo
//    SELECCIONA (falta elegir PARADA o GOL); un «fuera» o un palo terminan el
//    lanzamiento en el acto como fallo (`onOut`), por eso se desactivan hasta
//    que hay lanzador (`outDisabled`).
// `scale` ({ k, gk }, ver useBoardScale) dibuja todo más pequeño en móvil y en
// pantallas bajas para que el panel entero quepa sin scroll; el tamaño va por
// variables CSS (--k cancha, --gk portería).
export default function ShotBoard({ scale = { k: 1, gk: 1 }, shotZone, onShotZone, goalZone, onGoalZone, onOut, outDisabled }) {
  const { k, gk } = scale;
  const [outTop, outLeft, outRight] = OUT_ZONES;
  const [postLeft, postBar, postRight] = POST_ZONES;
  const pick = (setter, current, zone) => () => setter(current === zone ? null : zone);

  return (
    <div className="sb" style={{ '--k': k, '--gk': gk }}>
      <div className="sb-goalwrap">
        <button type="button" className="sb-out sb-out--top" disabled={outDisabled} onClick={() => onOut(outTop)} aria-label="Fuera por arriba">Fuera</button>
        <button type="button" className="sb-out sb-out--left" disabled={outDisabled} onClick={() => onOut(outLeft)} aria-label="Fuera por la izquierda">Fuera</button>
        <div className="sb-goal">
          <div className="sb-net">
            {GOAL_ZONES.map((z) => (
              <button
                key={z}
                type="button"
                className={`sb-cell${goalZone === z ? ' sb-cell--sel' : ''}`}
                onClick={pick(onGoalZone, goalZone, z)}
                aria-label={z}
                aria-pressed={goalZone === z}
              />
            ))}
          </div>
          <button type="button" className="sb-bar sb-bar--h" disabled={outDisabled} onClick={() => onOut(postBar)} aria-label="Larguero" />
          <button type="button" className="sb-bar sb-bar--l" disabled={outDisabled} onClick={() => onOut(postLeft)} aria-label="Palo izquierdo" />
          <button type="button" className="sb-bar sb-bar--r" disabled={outDisabled} onClick={() => onOut(postRight)} aria-label="Palo derecho" />
        </div>
        <button type="button" className="sb-out sb-out--right" disabled={outDisabled} onClick={() => onOut(outRight)} aria-label="Fuera por la derecha">Fuera</button>
      </div>

      <div className="sb-court">
        <div className="sb-six" />
        <div className="sb-nine" />
        {BOARD_ZONES.map((z) => (
          <button
            key={z.zone}
            type="button"
            className={`sb-zone sb-zone--${z.t}${shotZone === z.zone ? ' sb-zone--sel' : ''}`}
            style={{ clipPath: zoneClipPath(z, k) }}
            onClick={pick(onShotZone, shotZone, z.zone)}
            aria-label={z.zone}
            aria-pressed={shotZone === z.zone}
          />
        ))}
        {k >= 0.8 && BOARD_ZONES.map((z) => {
          const [x, y] = zoneLabelPoint(z, k);
          return <span key={`l-${z.zone}`} className="sb-zl" style={{ left: x - 16, top: y - 7 }}>{z.code}</span>;
        })}
        <button
          type="button"
          className={`sb-seven${shotZone === '7 metros' ? ' sb-seven--sel' : ''}`}
          onClick={pick(onShotZone, shotZone, '7 metros')}
          aria-label="Lanzamiento de 7 metros"
          aria-pressed={shotZone === '7 metros'}
        >
          7 m
        </button>
      </div>
    </div>
  );
}
