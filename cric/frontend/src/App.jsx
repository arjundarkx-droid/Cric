import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import LiveAuction from './components/LiveAuction';
import TeamProfile from './components/TeamProfile';
import PlayerList from './components/PlayerList';
import Settings from './components/Settings';
import AuditLogs from './components/AuditLogs';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('auction_token') || '');
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('auction_theme') || 'dark');
  const [activePage, setActivePage] = useState('dashboard');
  const [tournaments, setTournaments] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [socket, setSocket] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Toast Notification manager
  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Toggle Theme
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('auction_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Set initial theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Socket connection manager
  useEffect(() => {
    const s = io('http://localhost:5000');
    setSocket(s);

    s.on('connect', () => {
      console.log('Socket.IO connected to backend');
    });

    s.on('notification', (notif) => {
      addToast(`${notif.title}: ${notif.content}`, 'info');
    });

    return () => {
      s.close();
    };
  }, []);

  // Fetch current user details if token exists
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    fetch('http://localhost:5000/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) {
          localStorage.removeItem('auction_token');
          setToken('');
          throw new Error('Session expired');
        }
        return res.json();
      })
      .then(data => {
        setUser(data);
        if (socket && data.id) {
          socket.emit('join_user', data.id);
        }
      })
      .catch(err => {
        addToast(err.message, 'danger');
      });
  }, [token, socket]);

  // Fetch Tournaments list
  const fetchTournaments = () => {
    fetch('http://localhost:5000/api/tournaments')
      .then(res => res.json())
      .then(data => {
        setTournaments(data);
        if (data.length > 0 && !tournament) {
          // Set default active tournament
          setTournament(data[0]);
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  // Join tournament room when selected tournament updates
  useEffect(() => {
    if (socket && tournament) {
      socket.emit('join_tournament', tournament.id);
    }
  }, [socket, tournament]);

  const logout = () => {
    localStorage.removeItem('auction_token');
    setToken('');
    setUser(null);
    setActivePage('dashboard');
    addToast('Logged out successfully', 'info');
  };

  // Main Page routing switch
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard 
            user={user} 
            token={token} 
            addToast={addToast} 
            socket={socket} 
            tournament={tournament}
            setTournament={setTournament}
            tournaments={tournaments}
            fetchTournaments={fetchTournaments}
          />
        );
      case 'live-auction':
        return (
          <LiveAuction 
            user={user} 
            token={token} 
            addToast={addToast} 
            socket={socket} 
            tournament={tournament}
          />
        );
      case 'teams':
        return (
          <TeamProfile 
            token={token} 
            addToast={addToast} 
            tournament={tournament}
          />
        );
      case 'players':
        return (
          <PlayerList 
            user={user} 
            token={token} 
            addToast={addToast} 
            tournament={tournament}
          />
        );
      case 'settings':
        return (
          <Settings 
            token={token} 
            addToast={addToast} 
            tournament={tournament}
          />
        );
      case 'audit-logs':
        return (
          <AuditLogs 
            token={token} 
            addToast={addToast} 
            tournament={tournament}
          />
        );
      case 'login':
        return (
          <Login 
            setToken={setToken} 
            setUser={setUser} 
            addToast={addToast} 
            setActivePage={setActivePage} 
          />
        );
      case 'register':
        return (
          <Register 
            addToast={addToast} 
            setActivePage={setActivePage} 
          />
        );
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Navigation */}
      <Navbar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        user={user} 
        logout={logout} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        tournament={tournament}
      />

      {/* Main View Container */}
      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '15px' }}>
        {renderPage()}
      </main>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)}>×</button>
          </div>
        ))}
      </div>

    </div>
  );
}
