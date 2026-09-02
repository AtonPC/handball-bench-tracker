import { useMemo, useState } from 'react';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useMatchStore } from './hooks/useMatchStore';
import { useMatches } from './hooks/useMatches';
import { canManageRoles, canWriteBench, ROLE_LABELS } from './roles';
import LoginScreen from './components/LoginScreen';
import BenchConsole from './components/BenchConsole';
import FamilyView from './components/FamilyView';
import AdminPanel from './components/AdminPanel';
import StatsView from './components/StatsView';
import MatchesAdmin from './components/MatchesAdmin';
import PlayersAdmin from './components/PlayersAdmin';
import TeamsAdmin from './components/TeamsAdmin';

export default function App() {
  const auth = useAuth();
  const isAuthed = !!auth.user;
  const [view, setView] = useState('matches'); // 'matches' | 'players' | 'teams' | 'users'
  const [openMatchId, setOpenMatchId] = useState(null);
  const [openSubView, setOpenSubView] = useState('bench'); // 'bench' | 'stats'

  const store = useMatchStore(openMatchId, isAuthed);
  const { matches } = useMatches(isAuthed && !canWriteBench(auth.role));
  const liveMatch = useMemo(() => matches.find((m) => m.lifecycle === 'live'), [matches]);
  const familyStore = useMatchStore(liveMatch?.id || null, isAuthed);

  if (auth.loading) {
    return <div className="app-loading">Cargando…</div>;
  }

  if (!auth.user) {
    return <LoginScreen auth={auth} />;
  }

  if (!canWriteBench(auth.role)) {
    if (!liveMatch) {
      return (
        <div className="app-loading">
          No hay ningún partido en juego ahora mismo.
        </div>
      );
    }
    if (!familyStore.ready) {
      return <div className="app-loading">Sincronizando partido…</div>;
    }
    return <FamilyView store={familyStore} onLogout={auth.logout} />;
  }

  const showAdminTab = canManageRoles(auth.role);

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

  return (
    <div className="app-shell">
      <nav className="admin-nav">
        <span className="admin-nav-role">{ROLE_LABELS[auth.role]}</span>
        <div className="admin-nav-tabs">
          <button
            className={`admin-nav-tab${view === 'matches' ? ' admin-nav-tab--active' : ''}`}
            onClick={() => setView('matches')}
          >
            Partidos
          </button>
          {showAdminTab && (
            <button
              className={`admin-nav-tab${view === 'players' ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setView('players')}
            >
              Jugadores
            </button>
          )}
          {showAdminTab && (
            <button
              className={`admin-nav-tab${view === 'teams' ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setView('teams')}
            >
              Equipos
            </button>
          )}
          {showAdminTab && (
            <button
              className={`admin-nav-tab${view === 'users' ? ' admin-nav-tab--active' : ''}`}
              onClick={() => setView('users')}
            >
              Usuarios
            </button>
          )}
        </div>
        <button className="btn btn-logout" onClick={auth.logout}>SALIR</button>
      </nav>

      {view === 'matches' && (
        <MatchesAdmin canCreate={showAdminTab} onOpenMatch={openMatch} onOpenStats={openStats} />
      )}
      {view === 'players' && showAdminTab && <PlayersAdmin />}
      {view === 'teams' && showAdminTab && <TeamsAdmin />}
      {view === 'users' && showAdminTab && <AdminPanel myRole={auth.role} myUid={auth.user.uid} />}
    </div>
  );
}
