import React from 'react';
import { Sun, Moon, LogOut, ShieldAlert, Award, Users, Play, HelpCircle, FileText, Search } from 'lucide-react';

export default function Navbar({ activePage, setActivePage, user, logout, theme, toggleTheme, tournament }) {
  const getRoleBadge = (role) => {
    switch (role) {
      case 'superadmin': return <span style={{ backgroundColor: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>SuperAdmin</span>;
      case 'admin': return <span style={{ backgroundColor: '#eab308', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Admin</span>;
      case 'owner': return <span style={{ backgroundColor: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Team Owner</span>;
      case 'player': return <span style={{ backgroundColor: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Player</span>;
      default: return <span style={{ backgroundColor: '#64748b', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Public Viewer</span>;
    }
  };

  const showTab = (tab) => {
    if (!user) {
      return ['dashboard', 'live-auction', 'teams'].includes(tab);
    }
    
    // Superadmin has limited dashboard/tournaments actions
    if (user.role === 'superadmin') {
      return ['dashboard', 'tournaments'].includes(tab);
    }

    if (user.role === 'admin') {
      return true; // All pages including settings and logs
    }

    if (user.role === 'public') {
      return ['dashboard', 'live-auction', 'teams', 'players'].includes(tab);
    }

    // Owner and Player roles
    if (tab === 'settings' || tab === 'audit-logs') return false;
    return true;
  };

  return (
    <header className="glass-panel" style={{ margin: '15px', padding: '12px 24px', position: 'sticky', top: '15px', zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setActivePage('dashboard')}>
        {tournament && tournament.logo_url ? (
          <img src={tournament.logo_url} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--accent-gold)' }} />
        ) : (
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>A</div>
        )}
        <div>
          <h1 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>{tournament ? tournament.name : 'Draft Board'}</h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>LIVE AUCTION SYSTEM</span>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: '8px' }}>
        {showTab('dashboard') && (
          <button className={`btn ${activePage === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActivePage('dashboard')}>
            Dashboard
          </button>
        )}
        {showTab('live-auction') && (
          <button className={`btn ${activePage === 'live-auction' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActivePage('live-auction')}>
            <Play size={16} /> Live Auction
          </button>
        )}
        {showTab('teams') && (
          <button className={`btn ${activePage === 'teams' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActivePage('teams')}>
            <Users size={16} /> Teams
          </button>
        )}
        {showTab('players') && (
          <button className={`btn ${activePage === 'players' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActivePage('players')}>
            <Award size={16} /> Players
          </button>
        )}
        {showTab('audit-logs') && (
          <button className={`btn ${activePage === 'audit-logs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActivePage('audit-logs')}>
            <FileText size={16} /> Audit Logs
          </button>
        )}
        {showTab('settings') && (
          <button className={`btn ${activePage === 'settings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActivePage('settings')}>
            Settings
          </button>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        {/* Theme Toggle */}
        <button onClick={toggleTheme} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '6px' }}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>@{user.username}</span>
              {getRoleBadge(user.role)}
            </div>
            <button onClick={logout} className="btn btn-secondary" style={{ padding: '8px', minWidth: 'auto' }} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setActivePage('login')}>Login</button>
            <button className="btn btn-primary" onClick={() => setActivePage('register')}>Register</button>
          </div>
        )}
      </div>
    </header>
  );
}
