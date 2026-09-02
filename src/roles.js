export const ROLE_LABELS = {
  admin: 'Administrador de Sistemas',
  team_admin: 'Administrador de Jugadores y Partidos',
  coach: 'Entrenador',
  staff: 'Staff',
  player: 'Jugador',
  family: 'Familia',
};

// Roles que un 'team_admin' puede asignar (nunca puede tocar admin/team_admin).
export const ASSIGNABLE_BY_TEAM_ADMIN = ['coach', 'staff', 'player', 'family'];

export const BENCH_WRITE_ROLES = ['admin', 'team_admin', 'coach', 'staff'];
export const ROLE_MANAGER_ROLES = ['admin', 'team_admin'];

export function canWriteBench(role) {
  return BENCH_WRITE_ROLES.includes(role);
}

export function canManageRoles(role) {
  return ROLE_MANAGER_ROLES.includes(role);
}
