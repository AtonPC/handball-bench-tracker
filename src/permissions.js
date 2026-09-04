// Etiquetas de staff visibles y sus capacidades por defecto (sección 01 del
// Cuaderno de Juego). El Gestor de Club puede editar las capacidades de cada
// membresía; esto solo define el punto de partida al crearla.
export const STAFF_LABELS = {
  coach: 'Entrenador',
  delegate: 'Delegado',
  assistant_coach: '2º Entrenador',
  support: 'Apoyo',
};

export const CAPABILITIES = ['manageRoster', 'manageStaff', 'coachPanel', 'benchConsole'];

export const CAPABILITY_LABELS = {
  manageRoster: 'Gestionar plantilla',
  manageStaff: 'Gestionar staff',
  coachPanel: 'Panel del entrenador',
  benchConsole: 'Consola de banquillo',
};

export const DEFAULT_CAPABILITIES_BY_LABEL = {
  coach: { manageRoster: true, manageStaff: true, coachPanel: true, benchConsole: true },
  delegate: { manageRoster: true, manageStaff: true, coachPanel: true, benchConsole: true },
  assistant_coach: { manageRoster: true, manageStaff: false, coachPanel: true, benchConsole: true },
  support: { manageRoster: false, manageStaff: false, coachPanel: false, benchConsole: true },
};

export function membershipDocId(teamId, uid) {
  return `${teamId}_${uid}`;
}

export function isSystemAdmin(identity) {
  return identity?.systemRole === 'admin';
}

export function isClubManagerOf(identity, clubId) {
  if (!identity || !clubId) return false;
  return identity.managedClubIds.includes(clubId);
}

export function membershipFor(identity, teamId) {
  return identity?.staffMemberships?.find((m) => m.teamId === teamId) || null;
}

export function hasCapability(identity, teamId, capability) {
  if (isSystemAdmin(identity)) return true;
  const membership = membershipFor(identity, teamId);
  const team = identity?.teamsById?.[teamId];
  if (team && isClubManagerOf(identity, team.clubId)) return true;
  return !!membership?.active && !!membership.capabilities?.[capability];
}

export function canWriteBench(identity, teamId) {
  return hasCapability(identity, teamId, 'benchConsole');
}

// Todos los equipos a los que la persona tiene algún tipo de acceso de
// gestión: por membresía de staff, o porque gestiona el club dueño del equipo.
export function accessibleTeams(identity) {
  if (!identity) return [];
  if (isSystemAdmin(identity)) return identity.allTeams || [];
  const byId = new Map();
  for (const team of identity.allTeams || []) {
    if (identity.managedClubIds.includes(team.clubId)) byId.set(team.id, team);
  }
  for (const m of identity.staffMemberships || []) {
    if (!m.active) continue;
    const team = identity.teamsById?.[m.teamId];
    if (team) byId.set(team.id, team);
  }
  return [...byId.values()];
}
