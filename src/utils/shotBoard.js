// Geometría de la cancha del panel LANZAMIENTO (2026-09-21, mockup aprobado
// por el usuario). Puro y sin React, para poder probarlo con node.
//
// La cancha se dibuja en un rectángulo de 600×290 unidades (× una escala `k`),
// con la línea de gol arriba y la portería justo encima. El área de 6 m y la
// línea de 9 m son "estadios" (dos arcos elípticos unidos por un tramo recto
// del ancho de la portería) y las zonas se cortan EXACTAMENTE sobre esas dos
// líneas: la banda cercana va entre el área y la línea de 9 m, la lejana
// (marcada "9") más allá. Los extremos no tienen banda de 9 m: a esa distancia
// la línea ya se sale de la pista. Los vértices NO se recortan a la pista (el
// recorte los aplastaba en franjas): el desborde lo corta el contenedor con
// overflow:hidden.
import { SHOT_ZONES } from '../shotZones.js';

export const BOARD_W = 600;
export const BOARD_H = 290;
const CX = 300;
const A = 45; // medio ancho de la portería
const RX = 180; // radio horizontal del área de 6 m
const RY = 100; // radio vertical del área de 6 m (la de 9 m es ×1,5)

// Punto del contorno "de estadio" a distancia relativa k (1 = área de 6 m,
// 1,5 = línea de 9 m). u recorre el contorno: [0,1] arco derecho (0 = pegado a
// la línea de gol, 1 = abajo), [1,2] tramo recto, [2,3] arco izquierdo.
export function boardPoint(u, k) {
  if (u <= 1) {
    const f = (u * 90 * Math.PI) / 180;
    return [CX + A + RX * k * Math.cos(f), RY * k * Math.sin(f)];
  }
  if (u <= 2) return [CX + A - (u - 1) * 2 * A, RY * k];
  const f = ((3 - u) * 90 * Math.PI) / 180;
  return [CX - A - RX * k * Math.cos(f), RY * k * Math.sin(f)];
}

// 't': w = extremo, n = banda cercana, f = banda de 9 m.
// Izquierda/derecha como las ve quien mira la cancha (la portería arriba).
export const BOARD_ZONES = [
  { zone: 'Extremo derecho', code: 'ED', t: 'w', u: [0, 0.42], k: [1.03, 3], lu: 0.1, lk: 1.6 },
  // 2026-09-22: LD/C/LI (lo que más se toca) ganan terreno a LD9/C9/LI9 — antes eran casi
  // un cuarto del espacio de esa franja, ahora está sobre el 40/60 que pidió el usuario.
  // Rompe la correspondencia exacta con la línea de 9 m dibujada (sigue en k=1.5): es
  // a propósito, prioriza el tamaño del botón sobre el ajuste centimétrico a la línea.
  { zone: 'Lateral derecho', code: 'LD', t: 'n', u: [0.46, 0.8], k: [1.03, 1.85], lu: 0.54, lk: 1.44 },
  { zone: 'Lateral derecho 9m', code: 'LD 9', t: 'f', u: [0.46, 0.8], k: [1.91, 3], lu: 0.6, lk: 2.26 },
  { zone: 'Central', code: 'C', t: 'n', u: [0.84, 2.16], k: [1.03, 1.85], lu: 0.9, lk: 1.44 },
  { zone: 'Central 9m', code: 'C 9', t: 'f', u: [0.84, 2.16], k: [1.91, 3], lu: 1.5, lk: 2.26 },
  { zone: 'Lateral izquierdo', code: 'LI', t: 'n', u: [2.2, 2.54], k: [1.03, 1.85], lu: 2.46, lk: 1.44 },
  { zone: 'Lateral izquierdo 9m', code: 'LI 9', t: 'f', u: [2.2, 2.54], k: [1.91, 3], lu: 2.4, lk: 2.26 },
  { zone: 'Extremo izquierdo', code: 'EI', t: 'w', u: [2.58, 3], k: [1.03, 3], lu: 2.9, lk: 1.6 },
];

// Todas las zonas de origen del panel: las 8 de arriba + el punto de 7 m.
export const BOARD_ORIGIN_ZONES = [...BOARD_ZONES.map((z) => z.zone), '7 metros'];

// Puntos del polígono de una zona (en unidades de la cancha, sin escalar).
export function zoneOutline(def) {
  const [u1, u2] = def.u;
  const [k1, k2] = def.k;
  const us = [];
  const n = Math.max(2, Math.ceil((u2 - u1) / 0.06));
  for (let i = 0; i <= n; i += 1) us.push(u1 + ((u2 - u1) * i) / n);
  for (const c of [1, 2]) if (c > u1 && c < u2) us.push(c);
  us.sort((a, b) => a - b);
  return [
    ...us.map((u) => boardPoint(u, k2)),
    ...[...us].reverse().map((u) => boardPoint(u, k1)),
  ];
}

// clip-path CSS de una zona, ya escalado por k.
export function zoneClipPath(def, k = 1) {
  const pts = zoneOutline(def).map(([x, y]) => `${Math.round(x * k)}px ${Math.round(y * k)}px`);
  return `polygon(${pts.join(',')})`;
}

// Centro de la etiqueta de una zona, dentro de la pista (escalado por k).
export function zoneLabelPoint(def, k = 1) {
  const [x, y] = boardPoint(def.lu, def.lk);
  return [Math.min(BOARD_W - 20, Math.max(20, x)) * k, Math.min(BOARD_H - 12, Math.max(10, y)) * k];
}

// ¿Está el punto dentro del polígono? (para comprobar que las zonas no se solapan)
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Zonas de origen válidas (las mismas que guarda la app), para no desincronizar
// el dibujo de los valores de `shotZone`.
export const ALL_ORIGIN_ZONES_OK = BOARD_ORIGIN_ZONES.every((z) => SHOT_ZONES.includes(z));
