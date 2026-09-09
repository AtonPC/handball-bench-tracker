import { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';

export default function AppSidebar({
  roleLabel,
  clubOptions,
  activeClubId,
  onClubChange,
  teamsInActiveClub,
  activeTeamId,
  onTeamChange,
  tabs,
  view,
  onViewChange,
  onLogout,
}) {
  const [expanded, setExpanded] = useState(false);

  function selectTab(key) {
    onViewChange(key);
    setExpanded(false);
  }

  return (
    <nav className={`app-sidebar${expanded ? ' app-sidebar--expanded' : ''}`}>
      {expanded && <div className="sidebar-scrim" onClick={() => setExpanded(false)} />}
      <div className="sidebar-header">
        <span className="sidebar-brand-text">Bench Tracker</span>
        <button
          className="sidebar-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Cerrar menú' : 'Abrir menú'}
        >
          {expanded ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <span className="sidebar-role">{roleLabel}</span>

      {clubOptions.length > 0 && (
        <select
          className="admin-role-select sidebar-select"
          value={activeClubId}
          onChange={(e) => onClubChange(e.target.value)}
          title="Club activo"
        >
          {clubOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      {teamsInActiveClub.length > 0 && (
        <select
          className="admin-role-select sidebar-select"
          value={activeTeamId}
          onChange={(e) => onTeamChange(e.target.value)}
          title="Equipo activo"
        >
          {teamsInActiveClub.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}

      <div className="sidebar-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`sidebar-tab${view === t.key ? ' sidebar-tab--active' : ''}`}
            onClick={() => selectTab(t.key)}
            title={t.label}
          >
            <t.icon size={18} />
            <span className="sidebar-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <button className="btn btn-logout sidebar-logout" onClick={onLogout}>
        <LogOut size={16} />
        <span className="sidebar-tab-label">SALIR</span>
      </button>
    </nav>
  );
}
