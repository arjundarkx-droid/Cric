import React, { useState, useEffect } from 'react';
import { Save, ToggleLeft, ToggleRight, ShieldAlert } from 'lucide-react';

export default function Settings({ token, addToast, tournament }) {
  const [settings, setSettings] = useState({
    registration_open: 1,
    auction_open: 0,
    default_bid_increment: 1000,
    default_timer_seconds: 30,
    max_players_per_team: 5,
    team_budget: 1000000,
    registration_fee: 500
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tournament) return;
    fetch(`http://localhost:5000/api/tournaments/${tournament.id}/settings`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setSettings({
            registration_open: data.registration_open ? 1 : 0,
            auction_open: data.auction_open ? 1 : 0,
            default_bid_increment: data.default_bid_increment,
            default_timer_seconds: data.default_timer_seconds,
            max_players_per_team: data.max_players_per_team,
            team_budget: data.team_budget,
            registration_fee: data.registration_fee
          });
        }
      })
      .catch(err => console.error(err));
  }, [tournament]);

  const handleChange = (field, val) => {
    setSettings(prev => ({ ...prev, [field]: val }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`http://localhost:5000/api/tournaments/${tournament.id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast('Tournament settings updated and broadcasted successfully', 'success');
    } catch (err) {
      addToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '0 15px 40px 15px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header strip */}
      <section className="glass-panel" style={{ padding: '15px 24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)' }} className="text-gradient">Tournament Configurations</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Manage live rule parameters, draft limits, and parameters</span>
      </section>

      {/* Main Settings Card */}
      <form onSubmit={handleSaveSettings} className="glass-card" style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Registration and Auction Toggles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Player Registration</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allow new players to sign up</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleChange('registration_open', settings.registration_open ? 0 : 1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: settings.registration_open ? 'var(--success)' : 'var(--text-muted)' }}
            >
              {settings.registration_open ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Auction Active</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enable bidding interfaces</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleChange('auction_open', settings.auction_open ? 0 : 1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: settings.auction_open ? 'var(--success)' : 'var(--text-muted)' }}
            >
              {settings.auction_open ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
            </button>
          </div>

        </div>

        {/* Input Parameters Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          <div className="form-group">
            <label className="form-label">Default Bid Increment (INR)</label>
            <input 
              type="number" 
              className="form-control" 
              value={settings.default_bid_increment}
              onChange={e => handleChange('default_bid_increment', parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Draft Clock Timer (Seconds)</label>
            <input 
              type="number" 
              className="form-control" 
              value={settings.default_timer_seconds}
              onChange={e => handleChange('default_timer_seconds', parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Max Players Per Team</label>
            <input 
              type="number" 
              className="form-control" 
              value={settings.max_players_per_team}
              onChange={e => handleChange('max_players_per_team', parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Franchise Budget (INR)</label>
            <input 
              type="number" 
              className="form-control" 
              value={settings.team_budget}
              onChange={e => handleChange('team_budget', parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Player Registration Fee (INR)</label>
            <input 
              type="number" 
              className="form-control" 
              value={settings.registration_fee}
              onChange={e => handleChange('registration_fee', parseInt(e.target.value) || 0)}
              required
            />
          </div>

        </div>

        {/* Save button panel */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Save size={16} /> {loading ? 'Saving Parameters...' : 'Save Configuration'}
          </button>
        </div>

      </form>

    </div>
  );
}
