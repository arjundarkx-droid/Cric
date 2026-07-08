import React, { useState, useEffect } from 'react';
import { Search, Trophy, Shield, Users, Award, Bell, Plus, FileText, ArrowRight } from 'lucide-react';

export default function Dashboard({ user, token, addToast, socket, tournament, setTournament, tournaments, fetchTournaments }) {
  const [analytics, setAnalytics] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Search results
  const [searchPlayers, setSearchPlayers] = useState([]);
  const [searchTeams, setSearchTeams] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);

  // Superadmin fields
  const [newTName, setNewTName] = useState('');
  const [newTLogo, setNewTLogo] = useState('');
  const [showCreateT, setShowCreateT] = useState(false);

  useEffect(() => {
    if (!tournament) return;
    
    // Fetch analytics
    fetch(`http://localhost:5000/api/tournaments/${tournament.id}/analytics`)
      .then(res => res.json())
      .then(data => setAnalytics(data))
      .catch(err => console.error(err));

    // Fetch announcements
    fetch(`http://localhost:5000/api/tournaments/${tournament.id}/announcements`)
      .then(res => res.json())
      .then(data => setAnnouncements(data))
      .catch(err => console.error(err));

    // Fetch players and teams for global search
    fetch(`http://localhost:5000/api/tournaments/${tournament.id}/players`)
      .then(res => res.json())
      .then(data => setAllPlayers(data))
      .catch(err => console.error(err));

    fetch(`http://localhost:5000/api/tournaments/${tournament.id}/teams`)
      .then(res => res.json())
      .then(data => setAllTeams(data))
      .catch(err => console.error(err));
  }, [tournament]);

  // Real-time Announcements hook
  useEffect(() => {
    if (!socket || !tournament) return;

    const handleAnnouncement = (announcement) => {
      setAnnouncements(prev => [announcement, ...prev]);
      addToast(`New announcement: ${announcement.content}`, 'warning');
    };

    socket.on('announcement_published', handleAnnouncement);
    return () => {
      socket.off('announcement_published', handleAnnouncement);
    };
  }, [socket, tournament]);

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!newTName) return;

    try {
      const res = await fetch('http://localhost:5000/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newTName, logo_url: newTLogo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast(`Tournament ${newTName} created successfully!`, 'success');
      setNewTName('');
      setNewTLogo('');
      setShowCreateT(false);
      fetchTournaments();
    } catch (err) {
      addToast(err.message, 'danger');
    }
  };

  // Perform search filtering
  const handleSearch = (e) => {
    const q = e.target.value.toLowerCase();
    setSearchQuery(q);

    if (!q) {
      setSearchPlayers([]);
      setSearchTeams([]);
      return;
    }

    const filteredPlayers = allPlayers.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.village.toLowerCase().includes(q) || 
      p.role.toLowerCase().includes(q)
    );
    setSearchPlayers(filteredPlayers);

    const filteredTeams = allTeams.filter(t => 
      t.name.toLowerCase().includes(q) || 
      (t.owner_name && t.owner_name.toLowerCase().includes(q))
    );
    setSearchTeams(filteredTeams);
  };

  const getTournamentProgressPercentage = () => {
    if (!analytics || !analytics.auctionSummary || !analytics.auctionSummary.total_lots) return 0;
    const { sold_lots, unsold_lots, total_lots } = analytics.auctionSummary;
    return Math.round(((sold_lots + unsold_lots) / total_lots) * 100);
  };

  return (
    <div style={{ padding: '0 15px 40px 15px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Hero Welcome banner */}
      <section className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)', padding: '40px' }}>
        <div>
          <span style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Sports Draft Console</span>
          <h2 style={{ fontSize: '2.5rem', fontFamily: 'var(--font-heading)', marginTop: '10px' }} className="text-gradient">Real-Time Auction Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '5px', maxWidth: '500px' }}>
            Monitor and coordinate player selections, team budgets, bid history logs, and instant notifications.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          {user && user.role === 'superadmin' && (
            <button className="btn btn-primary" onClick={() => setShowCreateT(!showCreateT)}>
              <Plus size={16} /> Create Tournament
            </button>
          )}
          {tournaments.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label className="form-label">Switch Tournament</label>
              <select 
                className="form-control"
                value={tournament ? tournament.id : ''}
                onChange={(e) => {
                  const selected = tournaments.find(t => t.id === e.target.value);
                  if (selected) setTournament(selected);
                }}
              >
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Superadmin Create Tournament Form */}
      {showCreateT && (
        <form onSubmit={handleCreateTournament} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }} className="text-gradient">New Tournament Setup</h3>
          <div className="form-group">
            <label className="form-label">Tournament Name</label>
            <input type="text" className="form-control" placeholder="Village Cup 2026" value={newTName} onChange={e => setNewTName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Logo Image URL</label>
            <input type="text" className="form-control" placeholder="https://example.com/logo.jpg" value={newTLogo} onChange={e => setNewTLogo(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateT(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Global Search Bar */}
      <section className="glass-panel" style={{ padding: '15px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label className="form-label" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} /> Global Live Search
        </label>
        <input 
          type="text" 
          className="form-control" 
          placeholder="Search Players, Teams, Village names, or Roles..."
          value={searchQuery}
          onChange={handleSearch}
          style={{ width: '100%', fontSize: '1.05rem', padding: '14px 14px 14px 45px', background: 'var(--bg-secondary)', backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: '15px center' }}
        />

        {searchQuery && (
          <div className="glass-card" style={{ marginTop: '10px', maxH: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {searchPlayers.length > 0 && (
              <div>
                <h4 style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: '8px' }}>Players ({searchPlayers.length})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {searchPlayers.map(p => (
                    <div key={p.id} className="glass-panel" style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={p.photo_url || 'https://images.unsplash.com/photo-1540747737956-37872f76d9fd?w=80'} alt="" style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.role} • {p.village}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchTeams.length > 0 && (
              <div>
                <h4 style={{ fontSize: '1rem', color: 'var(--accent-secondary)', marginBottom: '8px' }}>Teams ({searchTeams.length})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {searchTeams.map(t => (
                    <div key={t.id} className="glass-panel" style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={t.logo_url || 'https://images.unsplash.com/photo-1540747737956-37872f76d9fd?w=80'} alt="" style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{t.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Owner: {t.owner_name || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchPlayers.length === 0 && searchTeams.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '15px' }}>No matches found. Try another term.</div>
            )}
          </div>
        )}
      </section>

      {/* Main Grid: Left statistics, Right announcements */}
      {tournament && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
          
          {/* Analytics Cards & Progress bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* Top Stat Boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
              
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                  <Award size={24} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.5rem' }}>{analytics?.playerStats?.approved_players || 0}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Approved Players</span>
                </div>
              </div>

              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-secondary)' }}>
                  <Users size={24} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.5rem' }}>{analytics?.teamStats?.length || 0}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Teams</span>
                </div>
              </div>

              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)' }}>
                  <Trophy size={24} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.5rem' }}>
                    {analytics?.auctionSummary?.sold_lots || 0} / {analytics?.auctionSummary?.total_lots || 0}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Lots Drafted</span>
                </div>
              </div>

            </div>

            {/* Auction Draft Progress Chart */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)', marginBottom: '15px' }}>Draft Progress</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span>Auctioned Lots</span>
                <span>{getTournamentProgressPercentage()}% Completed</span>
              </div>
              <div style={{ width: '100%', height: '10px', background: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${getTournamentProgressPercentage()}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))', borderRadius: '5px', transition: 'width 0.5s ease-out' }}></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '20px', textAlign: 'center' }}>
                <div style={{ borderRight: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '1.25rem', color: 'var(--success)', fontWeight: 'bold' }}>{analytics?.auctionSummary?.sold_lots || 0}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sold Players</span>
                </div>
                <div style={{ borderRight: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '1.25rem', color: 'var(--danger)', fontWeight: 'bold' }}>{analytics?.auctionSummary?.unsold_lots || 0}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unsold Players</span>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                    INR {analytics?.auctionSummary?.total_value?.toLocaleString() || 0}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Cash Spent</span>
                </div>
              </div>
            </div>

            {/* Highest Bid highlight card */}
            {analytics?.auctionSummary?.highest_sold_price > 0 && (
              <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.02) 100%)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>🏆 Tournament Marquee Signing</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-heading)' }}>{analytics.auctionSummary.highest_sold_player}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Purchased by: <strong>{analytics.auctionSummary.highest_sold_team}</strong></p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                      INR {analytics.auctionSummary.highest_sold_price.toLocaleString()}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Top Sold Bid</span>
                  </div>
                </div>
              </div>
            )}

            {/* Teams Standings Summary table */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)', marginBottom: '15px' }}>Team Roster Standings</h3>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Owner</th>
                    <th>Initial Budget</th>
                    <th>Remaining Budget</th>
                    <th>Slots Bought</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.teamStats?.map(team => (
                    <tr key={team.id}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                        <img src={team.logo_url || 'https://images.unsplash.com/photo-1540747737956-37872f76d9fd?w=80'} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                        {team.name}
                      </td>
                      <td>{team.owner_name || 'N/A'}</td>
                      <td>INR {team.budget.toLocaleString()}</td>
                      <td style={{ color: team.remaining_budget < team.budget * 0.15 ? 'var(--danger)' : 'var(--text-primary)' }}>
                        INR {team.remaining_budget.toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 'bold' }}>{team.players_bought}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/ {analytics.auctionSummary.total_lots ? analytics.auctionSummary.total_lots : 5}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Right hand side: Announcements feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Bell size={20} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Live Bulletin Board</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', maxHeight: '550px', paddingRight: '5px' }}>
                {announcements.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                    No announcements posted yet.
                  </div>
                ) : (
                  announcements.map((a, idx) => (
                    <div key={a.id || idx} className="glass-panel" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '5px', borderLeft: '3.5px solid var(--accent-primary)' }}>
                      <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{a.content}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
