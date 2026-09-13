// Zonas para registrar de dónde vino un lanzamiento y por dónde entró a
// portería, mostradas sobre un diagrama visual de cancha/portería
// (ShotZoneDiagram.jsx) en vez de las rejillas de botones originales — el
// dato que se guarda es el mismo de siempre.
// "7 metros" no tiene lado (izq/centro/der): es un lanzamiento aparte,
// siempre desde el mismo punto, así que es una 4ª opción de origen, no una
// marca independiente.
export const SHOT_ZONES = ['Izquierda', 'Centro', 'Derecha', '7 metros'];

export const GOAL_ZONES = [
  'Arriba izquierda', 'Arriba centro', 'Arriba derecha',
  'Medio izquierda', 'Medio centro', 'Medio derecha',
  'Abajo izquierda', 'Abajo centro', 'Abajo derecha',
];

// Fila aparte para un fallo que no entró: no fue parada del portero, se fue
// fuera de la portería. No aplica a un gol (por definición, entró).
export const OUT_ZONES = ['Fuera izquierda', 'Fuera centro', 'Fuera derecha'];
