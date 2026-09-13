import { ownPlayerLabel } from '../utils/followerHelpers';
import PlayerStatsTable from './PlayerStatsTable';

// Estadísticas del partido (en curso o ya finalizado, la lógica es la
// misma), construidas directamente de state.players. Misma tabla que ve el
// staff (PlayerStatsTable): Goles/Tiros, % Acierto, Paradas/Tiros y
// % Paradas (portero), Recuperaciones, Exclusiones, Expulsado y % Minutos
// jugados del partido — nunca el tiempo jugado en minutos, solo el
// reparto en %.
// "Tiros" de paradas = paradas + goles rivales encajados por el equipo —
// no se sabe qué portero concreto encajó cada gol (no se registra quién
// estaba en la portería en ese momento), así que es del equipo, no 1:1
// del portero si hubo más de uno en el partido.
export default function FollowerMatchStatsTable({ statePlayers, playersById, authorizedById, rivalGoalsConceded, matchElapsedMs }) {
  const rows = Object.values(statePlayers).map((p) => ({
    ...p,
    attempts: p.goals + p.shots,
    shotsFaced: (p.saves || 0) + rivalGoalsConceded,
    name: ownPlayerLabel(playersById, authorizedById, p.id),
  }));

  return <PlayerStatsTable rows={rows} minutesTotalMs={matchElapsedMs} />;
}
