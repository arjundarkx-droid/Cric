import React, { useState, useEffect } from 'react';
import { Download, Users, Briefcase, Award } from 'lucide-react';

export default function TeamProfile({ token, addToast, tournament }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTeams = () => {
    if (!tournament) return;
    setLoading(true);
    fetch(`http://localhost:5000/api/tournaments/${tournament.id}/teams`)
      .then(res => res.json())
      .then(data => {
        setTeams(data);
        if (data.length > 0) {
          // If a team is currently viewed, refresh its details
          if (selectedTeam) {
            const updated = data.find(t => t.id === selectedTeam.id);
            setSelectedTeam(updated || data[0]);
          } else {
            setSelectedTeam(data[0]);
          }
        }
      })
      .catch(err => {
        console.error(err);
        addToast('Failed to load teams list', 'danger');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTeams();
  }, [tournament]);

  const handleExportTeamsPDF = () => {
    if (!tournament) return;
    window.open(`http://localhost:5000/api/exports/${tournament.id}/teams`);
    addToast('Generating team rosters PDF export...', 'success');
  };

  return (
    <div style={{ padding: '0 15px 40px 15px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header bar */}
      <section className="glass-panel" style={{ padding: '15px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)' }} className="text-gradient">Team Portfolios</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Review franchise roster budgets and player lists</span>
        </div>
        <button className="btn btn-secondary" onClick={handleExportTeamsPDF}>
          <Download size={16} /> Export Teams PDF
        </button>
      </section>

      {/* Grid: Left teams list selector, Right team details dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '30px' }}>
        
        {/* Teams List Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>FRANCHISES</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {teams.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No teams created.</div>
            ) : (
              teams.map(t => (
                <div 
                  key={t.id} 
                  className="glass-panel" 
                  onClick={() => setSelectedTeam(t)}
                  style={{ 
                    padding: '15px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    borderLeft: selectedTeam?.id === t.id ? '4px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: selectedTeam?.id === t.id ? 'var(--bg-card-hover)' : 'var(--bg-card)'
                  }}
                >
                  <img src={t.logo_url || 'https://images.unsplash.com/photo-1540747737956-37872f76d9fd?w=80'} alt="" style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{t.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Owner: {t.owner_name || 'N/A'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Team Profile Dashboard */}
        {selectedTeam && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Team details header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src={selectedTeam.logo_url || 'https://images.unsplash.com/photo-1540747737956-37872f76d9fd?w=120'} alt="Team Logo" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)' }} />
                <div>
                  <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-heading)' }}>{selectedTeam.name}</h2>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Owner: <strong>{selectedTeam.owner_name || 'N/A'}</strong> ({selectedTeam.owner_email || 'No email'})</span>
                </div>
              </div>
              
              {/* Financial Box */}
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ textAlign: 'right', borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TOTAL BUDGET</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>INR {selectedTeam.budget.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>REMAINING BUDGET</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: selectedTeam.remaining_budget < selectedTeam.budget * 0.15 ? 'var(--danger)' : 'var(--success)' }}>
                    INR {selectedTeam.remaining_budget.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Squad lists */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Squad Roster</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Players Purchased: <strong>{selectedTeam.players?.length || 0}</strong>
                </span>
              </div>

              {!selectedTeam.players || selectedTeam.players.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  <Users size={32} style={{ margin: '0 auto 12px auto', display: 'block' }} />
                  <span>No players signed yet. Participate in the live auction draft.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                  {selectedTeam.players.map(p => (
                    <div key={p.id} className="glass-panel" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <img 
                        src={p.photo_url || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150'} 
                        alt="" 
                        style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px' }}
                      />
                      
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 'bold' }}>{p.name}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Village: {p.village}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{p.role}</span>
                        <strong style={{ color: 'var(--accent-gold)' }}>INR {p.sold_price.toLocaleString()}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
