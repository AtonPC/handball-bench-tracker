// Zonas para registrar de dónde vino un lanzamiento y por dónde entró a
// portería, mostradas sobre un diagrama visual de cancha/portería
// (ShotZoneDiagram.jsx) en vez de las rejillas de botones originales — el
// dato que se guarda es el mismo de siempre.
// Los extremos son su propia zona, distinta de los laterales — un tiro
// desde la banda no es lo mismo que uno más cerrado hacia el centro.
// Los 3 puestos centrales (lateral izq./central/lateral der.) se dividen
// además por distancia: "9m" es un lanzamiento desde fuera de la línea de
// 9 metros (línea punteada, como se entrena) y sin sufijo es más cerca,
// dentro de esa línea. Los extremos no se dividen: siempre tiran cerca,
// junto al área. Eso da 8 zonas de origen clicables en total.
// "7 metros" no tiene lado ni distancia: es un lanzamiento aparte, siempre
// desde el mismo punto, así que es una zona de origen más (la 9ª), no una
// marca independiente.
export const SHOT_ZONES = [
  'Extremo izquierdo',
  'Lateral izquierdo', 'Lateral izquierdo 9m',
  'Central', 'Central 9m',
  'Lateral derecho', 'Lateral derecho 9m',
  'Extremo derecho',
  '7 metros',
];

export const GOAL_ZONES = [
  'Arriba izquierda', 'Arriba centro', 'Arriba derecha',
  'Medio izquierda', 'Medio centro', 'Medio derecha',
  'Abajo izquierda', 'Abajo centro', 'Abajo derecha',
];

// Fila aparte para un fallo que no entró: no fue parada del portero, se fue
// fuera de la portería. No aplica a un gol (por definición, entró). Solo
// hace falta saber por dónde se fue fuera, no con cuánto margen: por
// encima del larguero, o a un lado u otro de los postes.
export const OUT_ZONES = ['Fuera arriba', 'Fuera izquierda', 'Fuera derecha'];

// Aviso opcional antes de registrar (2026-09-16): las dos zonas siguen
// siendo opcionales — si no se marca NINGUNA de las dos es un "no ha dado
// tiempo" legítimo, sin aviso. Pero si se marcó una y no la otra, un
// diagnóstico con datos reales confirmó que en los Fallos casi siempre se
// marca por dónde entró/salió y se olvida de dónde vino el lanzamiento —
// este aviso (no bloqueante, se puede seguir e ignorar) es el recordatorio
// para no perder ese dato. Se usa igual en Gol/Fallo propio, Parada y
// Gol/Fallo rival — los tres capturan el mismo par de zonas.
export function missingZoneWarning(shotZone, goalZone) {
  if (shotZone && !goalZone) return 'Has marcado de dónde vino el lanzamiento, pero no por dónde entró o salió. ¿Registrar así de todas formas?';
  if (!shotZone && goalZone) return 'Has marcado por dónde entró o salió, pero no de dónde vino el lanzamiento. ¿Registrar así de todas formas?';
  return null;
}
