import { useMyAccessGrants } from './useFollowRequests';

// Envoltorio fino sobre useMyAccessGrants, pensado para que App.jsx decida el
// enrutado (staff vs Seguidor) sin acoplarse al detalle de follows/guardianships.
export function useFollowerAccess(uid) {
  const { approvedTeamIds, pending } = useMyAccessGrants(uid);
  return { approvedTeamIds, hasPending: pending.length > 0 };
}
