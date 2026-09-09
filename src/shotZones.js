// Rejillas simples para registrar de dónde vino un lanzamiento y por dónde
// entró a portería. Es la versión funcional de la "zona de tiro" del
// Cuaderno de Juego — el diagrama visual de cancha/portería llega con el
// diseño; el dato que se guarda es el mismo.
export const SHOT_ZONES = ['Izquierda', 'Centro', 'Derecha'];

export const GOAL_ZONES = [
  'Arriba izquierda', 'Arriba centro', 'Arriba derecha',
  'Medio izquierda', 'Medio centro', 'Medio derecha',
  'Abajo izquierda', 'Abajo centro', 'Abajo derecha',
];

// Fila aparte para un fallo que no entró: no fue parada del portero, se fue
// fuera de la portería. No aplica a un gol (por definición, entró).
export const OUT_ZONES = ['Fuera izquierda', 'Fuera centro', 'Fuera derecha'];
