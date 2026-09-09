import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Settings, Shield, UserCog } from 'lucide-react';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useMatchStore } from './hooks/useMatchStore';
import { accessibleClubs, accessibleTeams, canWriteBench, hasCapability, isClubManagerOf, isSystemAdmin } from './permissions';
import LoginScreen from './components/LoginScreen';
import BenchConsole from './components/BenchConsole';
import StatsView from './components/StatsView';
import FinishedMatchEditor from './components/FinishedMatchEditor';
import TeamStats from './components/TeamStats';
import MatchesAdmin from './components/MatchesAdmin';
import PlayersAdmin from './components/PlayersAdmin';
import SystemAdmin from './components/SystemAdmin';
import ClubAdmin from './components/ClubAdmin';
import StaffAdmin from './components/StaffAdmin';
import AppSidebar from './components/AppSidebar';
import FollowRequestScreen from './components/FollowRequestScreen';
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
  const canManageClub = activeClubId ? isClubManagerOf(identity, activeClubId) : false;

  const store = useMatchStore(openMatchId, isAuthed);
  const { all: myGrants } = useMyAccessGrants(auth.user?.uid);

  if (auth.loading) {
    return <div className="app-loading">Cargando…</div>;
  }

  if (!auth.user) {
    return <LoginScreen auth={auth} />;
  }

  const hasAnyAccess = teams.length > 0 || managedClubs.length > 0 || isAdmin;
  if (!hasAnyAccess) {
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
          </nav>
          <StatsView store={store} />
        </div>
      );
    }
    if (openSubView === 'editStats') {
      return <FinishedMatchEditor store={store} onBack={backToMatches} />;
    }
    return (
      <BenchConsole
        store={store}
        onBack={backToMatches}
        onFinish={async () => {
          await store.finishMatch();
          backToMatches();
        }}
      />
    );
  }

  const roleLabel = isAdmin ? 'Administrador de Sistema' : managedClubs.length > 0 ? 'Gestor de Club' : 'Staff';

  const tabs = [
    teamsInActiveClub.length > 0 && { key: 'matches', label: 'Partidos', icon: CalendarDays },
    canManageRoster && { key: 'players', label: 'Plantilla', icon: UserCog },
    teamsInActiveClub.length > 0 && { key: 'teamStats', label: 'Estadísticas', icon: BarChart3 },
    clubOptions.length > 0 && { key: 'club', label: 'Club', icon: Shield },
    clubOptions.length > 0 && { key: 'staff', label: 'Staff y Permisos', icon: UserCog },
    isAdmin && { key: 'system', label: 'Sistema', icon: Settings },
  ].filter(Boolean);

  return (
    <div className="app-layout">
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
        onViewChange={setView}
        onLogout={auth.logout}
      />

      <main className="app-main">
        {view === 'matches' && activeTeam && (
          <MatchesAdmin
            clubId={activeTeam.clubId}
            teamId={activeTeam.id}
            ownTeamName={activeTeam.name}
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
        {view === 'teamStats' && activeTeam && (
          <TeamStats clubId={activeTeam.clubId} teamId={activeTeam.id} teamName={activeTeam.name} onOpenMatchStats={openStats} />
        )}
        {view === 'club' && canManageClub && <ClubAdmin clubId={activeClubId} />}
        {view === 'staff' && canManageClub && <StaffAdmin clubId={activeClubId} />}
        {view === 'system' && isAdmin && <SystemAdmin />}
      </main>
    </div>
  );
}
