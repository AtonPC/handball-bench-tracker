// Rejillas simples (3x3) para registrar de dónde vino un lanzamiento y por
// dónde entró a portería. Es la versión funcional de la "zona de tiro" del
// Cuaderno de Juego — el diagrama visual de cancha/portería llega con el
// diseño; el dato que se guarda es el mismo.
export const SHOT_ZONES = [
  'Izquierda cerca', 'Centro cerca', 'Derecha cerca',
  'Izquierda media', 'Centro media', 'Derecha media',
  'Izquierda lejos', 'Centro lejos', 'Derecha lejos',
];

export const GOAL_ZONES = [
  'Arriba izquierda', 'Arriba centro', 'Arriba derecha',
  'Medio izquierda', 'Medio centro', 'Medio derecha',
  'Abajo izquierda', 'Abajo centro', 'Abajo derecha',
];
