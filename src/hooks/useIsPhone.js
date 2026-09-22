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

// La consola de tablet está pensada para 1280×800 (mockup). En pantallas más bajas
// —un portátil de 1366×768 con la barra del navegador deja ~600 px— se reduce
// TODO proporcionalmente (CSS `zoom`) para que siga cabiendo sin scroll. Nunca
// agranda (máx. 1) ni baja de 0,6 (a partir de ahí sería ilegible).
// 830, no 800: con la portería y la cancha a tamaño completo (ver BenchConsole,
// 2026-09-22) el centro necesita un pelín más alto que 800 para caber justo;
// de lo contrario a exactamente 800px de alto quedaba un scroll interno de
// sobra en esa columna.
const TABLET_DESIGN_HEIGHT = 830;
export function useTabletZoom() {
  const read = () => (typeof window === 'undefined' ? 1 : Math.max(0.6, Math.min(1, window.innerHeight / TABLET_DESIGN_HEIGHT)));
  const [zoom, setZoom] = useState(read);
  useEffect(() => {
    const onResize = () => setZoom(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return zoom;
}

// Disposición del panel LANZAMIENTO en tablet/PC (2026-09-22, según el dibujo del
// usuario): con sitio de sobra, los botones (ROBO/PÉRDIDA/AMARILLA/EXCLUSIÓN/ROJA/
// CAMBIO) se agrupan en una columna estrecha a la IZQUIERDA del lanzamiento, con los
// dorsales rivales sancionados debajo en dos columnas (amarilla y roja); la portería y
// la cancha CRECEN para ocupar el ancho que deja libre esa columna. Sin sitio de sobra,
// se queda tal cual la demo: fila compacta de 6 debajo del lanzamiento, a tamaño fijo.
// Es un cálculo analítico (mismos números que el ancho de columnas en App.css), no
// mide el DOM — más simple y ya es el patrón de useTabletZoom más arriba — pero hay
// que mantener estas constantes iguales a las de App.css si cambia el ancho de algo.
const TC_LEFT_MIN = 330, TC_LEFT_VW = 0.26, TC_LEFT_MAX = 410, TC_RIGHT_W = 386;
const TC_CENTER_PAD = 32, TC_GREEN_W = 150, TC_GAP = 14, TC_SAFETY = 20;
const TC_WIDE_MIN_CENTER = 800; // por debajo, ni cabe la columna con holgura
const BOARD_BASE_W = 600, BOARD_MAX_K = 1.2;
export function useLaunchLayout() {
  const read = () => {
    if (typeof window === 'undefined') return { wide: false, k: 1, gk: 1 };
    const left = Math.max(TC_LEFT_MIN, Math.min(TC_LEFT_MAX, window.innerWidth * TC_LEFT_VW));
    const center = window.innerWidth - left - TC_RIGHT_W;
    if (center < TC_WIDE_MIN_CENTER) return { wide: false, k: 1, gk: 1 };
    const avail = center - TC_CENTER_PAD - TC_GREEN_W - TC_GAP - TC_SAFETY;
    const k = Math.max(1, Math.min(BOARD_MAX_K, avail / BOARD_BASE_W));
    return { wide: true, k, gk: k };
  };
  const [layout, setLayout] = useState(read);
  useEffect(() => {
    const onResize = () => setLayout(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return layout;
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
