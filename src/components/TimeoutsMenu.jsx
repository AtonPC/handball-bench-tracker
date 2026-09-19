import { useEffect, useRef, useState } from 'react';
import { Timer, X } from 'lucide-react';
import { periodShortLabel } from '../utils/periods';

const sum = (map) => Object.values(map || {}).reduce((s, n) => s + (n || 0), 0);

// Tiempos muertos (2026-09-19): en vez de dos contadores fijos en la cabecera
// (que ocupaban sitio para algo muy puntual y provocaban scroll horizontal en
// el móvil), UN botón central "Tiempos muertos" que abre un desplegable tipo
// marcador — total de cada equipo, desglose por periodo — y un botón por
// equipo para pedir el tiempo muerto. Cada petición cuenta en el periodo en
// curso (igual que antes: `timeouts.{own|rival}.{periodo}`); "Quitar uno"
// corrige un toque por error en ese mismo periodo.
// El desplegable se coloca con position:fixed bajo el botón porque la
// cabecera tiene overflow:hidden y lo recortaría.
export default function TimeoutsMenu({ ownName, rivalName, isHome, timeouts, period, periodCount, onRequest }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function toggle() {
    if (!open && buttonRef.current) setTop(buttonRef.current.getBoundingClientRect().bottom + 6);
    setOpen((v) => !v);
  }

  const totals = { own: sum(timeouts.own), rival: sum(timeouts.rival) };
  // Mismo orden que el marcador: el local a la izquierda.
  const sides = isHome
    ? [{ key: 'own', name: ownName }, { key: 'rival', name: rivalName }]
    : [{ key: 'rival', name: rivalName }, { key: 'own', name: ownName }];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`ctrl-btn ctrl-btn--tm${open ? ' ctrl-btn--tm-open' : ''}`}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Timer size={15} />
        <span className="tm-btn-label">TIEMPOS MUERTOS</span>
        <span className="tm-btn-badge" aria-label={`Tiempos muertos: ${totals[sides[0].key]} a ${totals[sides[1].key]}`}>
          {totals[sides[0].key]}–{totals[sides[1].key]}
        </span>
      </button>

      {open && (
        <>
          <div className="tm-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="tm-menu" style={{ top }} role="dialog" aria-label="Tiempos muertos">
            <div className="tm-menu-head">
              <strong>TIEMPOS MUERTOS</strong>
              <button type="button" className="tm-menu-close" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>

            <div className="tm-board">
              {sides.map((side) => (
                <div key={side.key} className={`tm-side tm-side--${side.key}`}>
                  <span className="tm-team">{side.name}</span>
                  <span className="tm-total">{totals[side.key]}</span>
                  <span className="tm-periods">
                    {Array.from({ length: periodCount }, (_, k) => k + 1).map((p) => (
                      <span key={p} className={p === period ? 'tm-period tm-period--now' : 'tm-period'}>
                        {periodShortLabel(p, periodCount)} {(timeouts[side.key] || {})[p] || 0}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>

            <div className="tm-actions">
              {sides.map((side) => (
                <div key={side.key} className="tm-action">
                  <button type="button" className={`tm-request tm-request--${side.key}`} onClick={() => onRequest(side.key, 1)}>
                    TIEMPO MUERTO
                    <span>{side.name}</span>
                  </button>
                  <button
                    type="button"
                    className="tm-remove"
                    disabled={!((timeouts[side.key] || {})[period])}
                    onClick={() => onRequest(side.key, -1)}
                  >
                    Quitar uno
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
