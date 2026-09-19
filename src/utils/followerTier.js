// Nivel de un Seguidor (2026-09-19). Decide qué estadísticas ve, no si puede
// entrar: eso ya lo decide la aprobación (follows/guardianships).
//  - 'standard' (por defecto, también si el campo `tier` no existe): solo
//    estadísticas del EQUIPO. Ve la cronología en directo, la celebración de
//    gol con su goleador, y las cifras globales (goles, tiros, paradas...),
//    pero ninguna cifra individual de jugadores.
//  - 'pro': además, todo lo individual (tabla por jugador, goleadores,
//    recuperadores, filtro por jugador en las zonas, nombres en toda la
//    cronología).
// Solo se oculta en la interfaz: las reglas de Firestore siguen dejando leer
// todo el equipo a un seguidor aprobado (blindarlo de verdad exigiría un
// feed aparte con solo lo permitido). Un cambio de nivel lo hace el gestor
// del club desde Solicitudes.
export const FOLLOWER_TIERS = {
  standard: 'Estándar',
  pro: 'Pro',
};

export function normalizeTier(tier) {
  return tier === 'pro' ? 'pro' : 'standard';
}

export function isProTier(tier) {
  return tier === 'pro';
}
