import { useEffect, useState } from 'react';

// Escalas de dibujo según el dispositivo (mismo punto de corte de móvil que App.css: 599px).
// Tamaño de la cancha y la portería del panel LANZAMIENTO según el dispositivo:
// móvil en vertical (pequeño), pantallas bajas como una tablet apaisada de 10"
// (mediano, para que quepa sin scroll) o grande.
// true en tablet apaisada o PC (≥ 1000 px de ancho): la consola usa entonces la
// disposición de tres columnas (TabletConsole) en vez de la de móvil.
export function useIsTablet() {
  const query = '(min-width: 1000px)';
  const [yes, setYes] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setYes(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return yes;
}

export function useBoardScale() {
  const read = () => {
    if (typeof window === 'undefined') return { k: 1, gk: 1 };
    if (window.innerWidth < 600) return { k: 0.6, gk: 0.78 };
    if (window.innerHeight < 900) return { k: 0.8, gk: 0.9 };
    return { k: 1, gk: 1 };
  };
  const [scale, setScale] = useState(read);
  useEffect(() => {
    const onResize = () => setScale((prev) => {
      const next = read();
      return next.k === prev.k && next.gk === prev.gk ? prev : next;
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}
