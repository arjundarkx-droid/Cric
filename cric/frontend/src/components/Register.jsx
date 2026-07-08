import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Award, Users, MapPin, Trophy } from 'lucide-react';

export default function Register({ addToast, setActivePage }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('public'); // public, player, owner
  
  // Tournaments list to select
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');

  // Player details
  const [playerName, setPlayerName] = useState('');
  const [playerPhoto, setPlayerPhoto] = useState('');
  const [village, setVillage] = useState('');
  const [playerRole, setPlayerRole] = useState('Batsman');
  const [battingStyle, setBattingStyle] = useState('Right-handed');
  const [bowlingStyle, setBowlingStyle] = useState('None');
  const [experience, setExperience] = useState('1 Year');
  const [highestScore, setHighestScore] = useState(0);
  const [basePrice, setBasePrice] = useState(10000);

  // Team details (for owner)
  const [teamName, setTeamName] = useState('');
  const [teamLogo, setTeamLogo] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch tournaments list
    fetch('http://localhost:5000/api/tournaments')
      .then(res => res.json())
      .then(data => {
        setTournaments(data);
        if (data.length > 0) {
          setSelectedTournamentId(data[0].id);
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !email || !password || !role) {
      addToast('Please fill in all core fields', 'danger');
      return;
    }

    if (role !== 'superadmin' && !selectedTournamentId) {
      addToast('Please select a tournament to join', 'danger');
      return;
    }

    const payload = {
      username,
      email,
      password,
      role,
      tournament_id: selectedTournamentId
    };

    if (role === 'owner') {
      if (!teamName) {
        addToast('Please provide a team name', 'danger');
        return;
      }
      payload.teamDetails = {
        name: teamName,
        logo_url: teamLogo
      };
    }

    if (role === 'player') {
      if (!village || !basePrice) {
        addToast('Village and base price are required for players', 'danger');
        return;
      }
      payload.playerDetails = {
        name: playerName || username,
        photo_url: playerPhoto,
        village,
        role: playerRole,
        batting_style: battingStyle,
        bowling_style: bowlingStyle,
        experience,
        highest_score: parseInt(highestScore) || 0,
        base_price: parseInt(basePrice)
      };
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      addToast('Account created successfully! Please sign in.', 'success');
      setActivePage('login');
    } catch (err) {
      addToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)', padding: '40px 20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', marginBottom: '15px' }}>
            <UserPlus size={28} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-heading)' }} className="text-gradient">Join the Tournament</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '5px' }}>Register to bid, list yourself as a player, or follow the live draft board</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="cricket_star"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-control" 
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tournament</label>
              <select 
                className="form-control"
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                required
              >
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Role selector */}
          <div className="form-group">
            <label className="form-label">Register As</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div 
                className={`glass-panel ${role === 'public' ? 'bid-bump' : ''}`} 
                onClick={() => setRole('public')}
                style={{ padding: '15px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', border: role === 'public' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)' }}
              >
                <Users size={20} style={{ color: role === 'public' ? 'var(--accent-primary)' : 'var(--text-secondary)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Public Viewer</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Watch the live auction</div>
              </div>

              <div 
                className={`glass-panel ${role === 'player' ? 'bid-bump' : ''}`} 
                onClick={() => setRole('player')}
                style={{ padding: '15px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', border: role === 'player' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)' }}
              >
                <Award size={20} style={{ color: role === 'player' ? 'var(--accent-primary)' : 'var(--text-secondary)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Draft Player</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>List yourself for selection</div>
              </div>

              <div 
                className={`glass-panel ${role === 'owner' ? 'bid-bump' : ''}`} 
                onClick={() => setRole('owner')}
                style={{ padding: '15px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', border: role === 'owner' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)' }}
              >
                <Trophy size={20} style={{ color: role === 'owner' ? 'var(--accent-primary)' : 'var(--text-secondary)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Team Owner</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Create a team and place bids</div>
              </div>
            </div>
          </div>

          {/* Dynamic forms based on role */}
          {role === 'owner' && (
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>Team Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Team Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Mumbai Challengers"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Team Logo URL</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="https://example.com/logo.png"
                    value={teamLogo}
                    onChange={(e) => setTeamLogo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {role === 'player' && (
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>Player Information</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="John Doe"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Profile Photo URL</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="https://example.com/photo.png"
                    value={playerPhoto}
                    onChange={(e) => setPlayerPhoto(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Village Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Kapurthala"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Playing Role</label>
                  <select 
                    className="form-control" 
                    value={playerRole}
                    onChange={(e) => setPlayerRole(e.target.value)}
                  >
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="Wicket-Keeper">Wicket-Keeper</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Experience</label>
                  <select 
                    className="form-control" 
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                  >
                    <option value="1 Year">1 Year</option>
                    <option value="2 Years">2 Years</option>
                    <option value="3 Years">3 Years</option>
                    <option value="4 Years">4 Years</option>
                    <option value="5+ Years">5+ Years</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Batting Style</label>
                  <select 
                    className="form-control" 
                    value={battingStyle}
                    onChange={(e) => setBattingStyle(e.target.value)}
                  >
                    <option value="Right-handed">Right-handed</option>
                    <option value="Left-handed">Left-handed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Bowling Style</label>
                  <select 
                    className="form-control" 
                    value={bowlingStyle}
                    onChange={(e) => setBowlingStyle(e.target.value)}
                  >
                    <option value="None">None</option>
                    <option value="Fast">Fast</option>
                    <option value="Medium">Medium</option>
                    <option value="Spin">Spin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Highest Score / Wickets</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="120"
                    value={highestScore}
                    onChange={(e) => setHighestScore(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Requested Base Price (INR)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="20000"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  required
                />
              </div>

            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
            {loading ? 'Submitting Registration...' : 'Register'}
          </button>
        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '15px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <span 
            onClick={() => setActivePage('login')} 
            style={{ color: 'var(--accent-primary)', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Sign In here
          </span>
        </div>

      </div>
    </div>
  );
}
