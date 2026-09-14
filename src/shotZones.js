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
