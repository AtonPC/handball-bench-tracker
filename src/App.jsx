import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, ClipboardCheck, ClipboardList, Eye, Settings, Shield, Trash2, UserCog } from 'lucide-react';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useMatchStore } from './hooks/useMatchStore';
import { deleteMatchById } from './hooks/useMatches';
import { accessibleClubs, accessibleTeams, canWriteBench, hasCapability, isClubManagerOf, isSystemAdmin } from './permissions';
import LoginScreen from './components/LoginScreen';
import BenchConsole from './components/BenchConsole';
import StatsView from './components/StatsView';
import FinishedMatchEditor from './components/FinishedMatchEditor';
import TeamStats from './components/TeamStats';
import MatchesAdmin from './components/MatchesAdmin';
import PlayersAdmin from './components/PlayersAdmin';
import TrainingAttendance from './components/TrainingAttendance';
import SystemAdmin from './components/SystemAdmin';
import ClubAdmin from './components/ClubAdmin';
import StaffAdmin from './components/StaffAdmin';
import FollowApprovals from './components/FollowApprovals';
import { teamColorStyle } from './utils/teamColors';
import AppSidebar from './components/AppSidebar';
import FollowRequestScreen from './components/FollowRequestScreen';
import FollowerHome from './components/FollowerHome';
import { useMyAccessGrants } from './hooks/useFollowRequests';

export default function App() {
  const auth = useAuth();
  const identity = auth.identity;
  const isAuthed = !!auth.user;

  const teams = useMemo(() => (identity ? accessibleTeams(identity) : []), [identity]);
  const managedClubs = identity?.managedClubs || [];
  const clubOptions = useMemo(() => (identity ? accessibleClubs(identity) : []), [identity]);
  const isAdmin = identity ? isSystemAdmin(identity) : false;

  const [activeTeamId, setActiveTeamId] = useState('');
  const [activeClubId, setActiveClubId] = useState('');
  const [view, setView] = useState('matches');
  const [openMatchId, setOpenMatchId] = useState(null);
  const [openSubView, setOpenSubView] = useState('bench');
  const [followerPreview, setFollowerPreview] = useState(false);

  useEffect(() => {
    if (clubOptions.length === 0) {
      if (activeClubId) setActiveClubId('');
      return;
    }
    if (!clubOptions.some((c) => c.id === activeClubId)) setActiveClubId(clubOptions[0].id);
  }, [clubOptions, activeClubId]);

  // El equipo activo se limita a los del club activo — así elegir un club
  // filtra de verdad qué equipos aparecen, en vez de mezclar todos.
  const teamsInActiveClub = useMemo(
    () => (activeClubId ? teams.filter((t) => t.clubId === activeClubId) : teams),
    [teams, activeClubId]
  );

  useEffect(() => {
    if (teamsInActiveClub.length === 0) {
      if (activeTeamId) setActiveTeamId('');
      return;
    }
    if (!teamsInActiveClub.some((t) => t.id === activeTeamId)) setActiveTeamId(teamsInActiveClub[0].id);
  }, [teamsInActiveClub, activeTeamId]);

  const activeTeam = teamsInActiveClub.find((t) => t.id === activeTeamId) || null;
  const canManageRoster = activeTeamId ? hasCapability(identity, activeTeamId, 'manageRoster') : false;
  const canUseBench = activeTeamId ? canWriteBench(identity, activeTeamId) : false;
  // La asistencia a entrenamientos es cosa del cuerpo técnico (misma
  // capacidad que "Reparto de minutos"): los seguidores no la ven nunca.
  const canCoachPanel = activeTeamId ? hasCapability(identity, activeTeamId, 'coachPanel') : false;
  const canManageClub = activeClubId ? isClubManagerOf(identity, activeClubId) : false;

  const store = useMatchStore(openMatchId, isAuthed);
  const { all: myGrants, approvedTeamIds, tierByTeamId } = useMyAccessGrants(auth.user?.uid);

  if (auth.loading) {
    return <div className="app-loading">Cargando…</div>;
  }

  if (!auth.user) {
    return <LoginScreen auth={auth} />;
  }

  // Una cuenta es o bien staff/gestor/admin, o bien Seguidor — nunca las dos
  // cosas a la vez (decisión de producto para esta pieza).
  const hasAnyAccess = teams.length > 0 || managedClubs.length > 0 || isAdmin;
  if (!hasAnyAccess) {
    if (approvedTeamIds.length > 0) {
      return (
        <FollowerHome identity={identity} approvedTeamIds={approvedTeamIds} tierByTeamId={tierByTeamId} user={auth.user} onLogout={auth.logout} />
      );
    }
    return <FollowRequestScreen identity={identity} user={auth.user} onLogout={auth.logout} myGrants={myGrants} />;
  }

  function openMatch(matchId) {
    setOpenMatchId(matchId);
    setOpenSubView('bench');
  }
  function openStats(matchId) {
    setOpenMatchId(matchId);
    setOpenSubView('stats');
  }
  function openEditFinishedStats(matchId) {
    setOpenMatchId(matchId);
    setOpenSubView('editStats');
  }
  function backToMatches() {
    setOpenMatchId(null);
  }
  // Solo se llega aquí desde un partido finalizado (onOpenStats en
  // MatchesAdmin/TeamStats no se ofrece para otro lifecycle), así que el
  // aviso siempre es el de "se pierden las estadísticas" — igual que
  // handleDelete en MatchesAdmin.jsx.
  async function handleDeleteOpenMatch() {
    if (!confirm('¿Borrar este partido finalizado? Se perderán sus estadísticas (goles, tiempos, goles rivales...) y no se puede deshacer.')) return;
    await deleteMatchById(openMatchId);
    backToMatches();
  }

  if (openMatchId) {
    if (!store.ready) {
      return <div className="app-loading">Sincronizando partido…</div>;
    }
    if (openSubView === 'stats') {
      return (
        <div className="app-shell">
          <nav className="admin-nav">
            <button className="btn btn-logout" onClick={backToMatches}>← PARTIDOS</button>
            <span className="admin-nav-role">Estadísticas</span>
            {canManageRoster && (
              <div className="player-form-actions" style={{ marginLeft: 'auto' }}>
                <button className="btn-icon" onClick={() => openEditFinishedStats(openMatchId)} title="Editar" aria-label="Editar partido finalizado">
                  <Settings size={18} />
                </button>
                <button className="btn-icon btn-icon--danger" onClick={handleDeleteOpenMatch} title="Borrar" aria-label="Borrar partido">
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </nav>
          <StatsView store={store} identity={identity} teamId={activeTeamId} team={activeTeam} />
        </div>
      );
    }
    if (openSubView === 'editStats') {
      return <FinishedMatchEditor store={store} onBack={backToMatches} />;
    }
    return (
      <BenchConsole
        store={store}
        team={activeTeam}
        onBack={backToMatches}
        onFinish={async () => {
          await store.finishMatch();
          backToMatches();
        }}
      />
    );
  }

  // Ver la app tal como la ve un Seguidor del equipo activo, sin pasar por
  // la solicitud/aprobación — el staff ya tiene acceso real a ese equipo,
  // esto es solo una previsualización para comprobar en directo qué están
  // viendo las familias.
  if (followerPreview && activeTeam) {
    return (
      <FollowerHome
        identity={identity}
        approvedTeamIds={[activeTeam.id]}
        user={auth.user}
        onLogout={() => setFollowerPreview(false)}
        previewMode
      />
    );
  }

  const roleLabel = isAdmin ? 'Administrador de Sistema' : managedClubs.length > 0 ? 'Gestor de Club' : 'Staff';

  const tabs = [
    teamsInActiveClub.length > 0 && { key: 'matches', label: 'Partidos', icon: CalendarDays },
    canManageRoster && { key: 'players', label: 'Plantilla', icon: UserCog },
    canCoachPanel && { key: 'attendance', label: 'Asistencia', icon: ClipboardList },
    teamsInActiveClub.length > 0 && { key: 'teamStats', label: 'Estadísticas', icon: BarChart3 },
    teamsInActiveClub.length > 0 && { key: 'followerPreview', label: 'Vista de Seguidor', icon: Eye },
    clubOptions.length > 0 && { key: 'club', label: 'Club', icon: Shield },
    clubOptions.length > 0 && { key: 'staff', label: 'Staff y Permisos', icon: UserCog },
    canManageClub && { key: 'requests', label: 'Solicitudes', icon: ClipboardCheck },
    isAdmin && { key: 'system', label: 'Sistema', icon: Settings },
  ].filter(Boolean);

  function handleViewChange(key) {
    if (key === 'followerPreview') {
      setFollowerPreview(true);
      return;
    }
    setView(key);
  }

  return (
    <div className="app-layout" style={teamColorStyle(activeTeam)}>
      <AppSidebar
        roleLabel={roleLabel}
        clubOptions={clubOptions}
        activeClubId={activeClubId}
        onClubChange={setActiveClubId}
        teamsInActiveClub={teamsInActiveClub}
        activeTeamId={activeTeamId}
        onTeamChange={setActiveTeamId}
        tabs={tabs}
        view={view}
        onViewChange={handleViewChange}
        onLogout={auth.logout}
      />

      <main className="app-main">
        {view === 'matches' && activeTeam && (
          <MatchesAdmin
            clubId={activeTeam.clubId}
            teamId={activeTeam.id}
            ownTeamName={activeTeam.name}
            ownCrestUrl={activeTeam.crestUrl}
            canManageRoster={canManageRoster}
            canUseBench={canUseBench}
            onOpenMatch={openMatch}
            onOpenStats={openStats}
            onEditFinishedStats={openEditFinishedStats}
          />
        )}
        {view === 'players' && canManageRoster && activeTeam && (
          <PlayersAdmin clubId={activeTeam.clubId} teamId={activeTeam.id} teamName={activeTeam.name} />
        )}
        {view === 'attendance' && canCoachPanel && activeTeam && (
          <TrainingAttendance clubId={activeTeam.clubId} teamId={activeTeam.id} teamName={activeTeam.name} />
        )}
        {view === 'teamStats' && activeTeam && (
          <TeamStats clubId={activeTeam.clubId} teamId={activeTeam.id} teamName={activeTeam.name} leagueId={activeTeam.leagueId} onOpenMatchStats={openStats} />
        )}
        {view === 'club' && canManageClub && <ClubAdmin clubId={activeClubId} />}
        {view === 'staff' && canManageClub && <StaffAdmin clubId={activeClubId} />}
        {view === 'requests' && canManageClub && <FollowApprovals clubId={activeClubId} identity={identity} />}
        {view === 'system' && isAdmin && <SystemAdmin />}
      </main>
    </div>
  );
}
