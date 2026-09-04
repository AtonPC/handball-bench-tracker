import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useMatchStore } from './hooks/useMatchStore';
import { accessibleTeams, canWriteBench, hasCapability, isClubManagerOf, isSystemAdmin } from './permissions';
import LoginScreen from './components/LoginScreen';
import BenchConsole from './components/BenchConsole';
import StatsView from './components/StatsView';
import TeamStats from './components/TeamStats';
import MatchesAdmin from './components/MatchesAdmin';
import PlayersAdmin from './components/PlayersAdmin';
import SystemAdmin from './components/SystemAdmin';
import ClubAdmin from './components/ClubAdmin';
import StaffAdmin from './components/StaffAdmin';

export default function App() {
  const auth = useAuth();
  const identity = auth.identity;
  const isAuthed = !!auth.user;

  const teams = useMemo(() => (identity ? accessibleTeams(identity) : []), [identity]);
  const managedClubs = identity?.managedClubs || [];
  const isAdmin = identity ? isSystemAdmin(identity) : false;

  const [activeTeamId, setActiveTeamId] = useState('');
  const [activeClubId, setActiveClubId] = useState('');
  const [view, setView] = useState('matches');
  const [openMatchId, setOpenMatchId] = useState(null);
  const [openSubView, setOpenSubView] = useState('bench');

  useEffect(() => {
    if (teams.length === 0) {
      if (activeTeamId) setActiveTeamId('');
      return;
    }
    if (!teams.some((t) => t.id === activeTeamId)) setActiveTeamId(teams[0].id);
  }, [teams, activeTeamId]);

  useEffect(() => {
    if (managedClubs.length === 0) {
      if (activeClubId) setActiveClubId('');
      return;
    }
    if (!managedClubs.some((c) => c.id === activeClubId)) setActiveClubId(managedClubs[0].id);
  }, [managedClubs, activeClubId]);

  const activeTeam = teams.find((t) => t.id === activeTeamId) || null;
  const canManageRoster = activeTeamId ? hasCapability(identity, activeTeamId, 'manageRoster') : false;
  const canUseBench = activeTeamId ? canWriteBench(identity, activeTeamId) : false;
  const canManageClub = activeClubId ? isClubManagerOf(identity, activeClubId) : false;

  const store = useMatchStore(openMatchId, isAuthed);

  if (auth.loading) {
    return <div className="app-loading">Cargando…</div>;
  }

  if (!auth.user) {
    return <LoginScreen auth={auth} />;
  }

  const hasAnyAccess = teams.length > 0 || managedClubs.length > 0 || isAdmin;
  if (!hasAnyAccess) {
    return (
      <div className="app-shell">
        <nav className="admin-nav">
          <span className="admin-nav-role">{auth.user.displayName || auth.user.email}</span>
          <button className="btn btn-logout" onClick={auth.logout}>SALIR</button>
        </nav>
        <div className="app-loading">
          Todavía no perteneces a ningún equipo. Pídele a tu club que te dé de alta como staff, o espera a que
          se active el flujo de seguidores.
        </div>
      </div>
    );
  }

  function openMatch(matchId) {
    setOpenMatchId(matchId);
    setOpenSubView('bench');
  }
  function openStats(matchId) {
    setOpenMatchId(matchId);
    setOpenSubView('stats');
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

  return (
    <div className="app-shell">
      <nav className="admin-nav">
        <span className="admin-nav-role">{roleLabel}</span>
        {teams.length > 0 && (
          <select
            className="admin-role-select"
            value={activeTeamId}
            onChange={(e) => setActiveTeamId(e.target.value)}
            title="Equipo activo"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {managedClubs.length > 0 && (
          <select
            className="admin-role-select"
            value={activeClubId}
            onChange={(e) => setActiveClubId(e.target.value)}
            title="Club activo"
          >
            {managedClubs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <div className="admin-nav-tabs">
          {teams.length > 0 && (
            <button
              className={`admin-nav-tab${view === 'matches' ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setView('matches')}
            >
              Partidos
            </button>
          )}
          {canManageRoster && (
            <button
              className={`admin-nav-tab${view === 'players' ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setView('players')}
            >
              Plantilla
            </button>
          )}
          {teams.length > 0 && (
            <button
              className={`admin-nav-tab${view === 'teamStats' ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setView('teamStats')}
            >
              Estadísticas
            </button>
          )}
          {managedClubs.length > 0 && (
            <button
              className={`admin-nav-tab${view === 'club' ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setView('club')}
            >
              Club
            </button>
          )}
          {managedClubs.length > 0 && (
            <button
              className={`admin-nav-tab${view === 'staff' ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setView('staff')}
            >
              Staff y Permisos
            </button>
          )}
          {isAdmin && (
            <button
              className={`admin-nav-tab${view === 'system' ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setView('system')}
            >
              Sistema
            </button>
          )}
        </div>
        <button className="btn btn-logout" onClick={auth.logout}>SALIR</button>
      </nav>

      {view === 'matches' && activeTeam && (
        <MatchesAdmin
          clubId={activeTeam.clubId}
          teamId={activeTeam.id}
          ownTeamName={activeTeam.name}
          canManageRoster={canManageRoster}
          canUseBench={canUseBench}
          onOpenMatch={openMatch}
          onOpenStats={openStats}
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
    </div>
  );
}
