import React, { useState, useEffect } from 'react';
import { Download, Check, X, FileText, Printer, Search, Filter } from 'lucide-react';

export default function PlayerList({ user, token, addToast, tournament }) {
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchName, setSearchName] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const fetchPlayers = () => {
    if (!tournament) return;
    setLoading(true);
    fetch(`http://localhost:5000/api/tournaments/${tournament.id}/players`)
      .then(res => res.json())
      .then(data => {
        setPlayers(data);
        setFilteredPlayers(data);
      })
      .catch(err => {
        console.error(err);
        addToast('Failed to fetch players list', 'danger');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlayers();
  }, [tournament]);

  // Apply filters on lists
  useEffect(() => {
    let result = players;

    if (searchName) {
      const q = searchName.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.village.toLowerCase().includes(q) || 
        p.id.toLowerCase().includes(q)
      );
    }

    if (filterRole !== 'All') {
      result = result.filter(p => p.role === filterRole);
    }

    if (filterStatus !== 'All') {
      result = result.filter(p => p.status === filterStatus);
    }

    setFilteredPlayers(result);
  }, [searchName, filterRole, filterStatus, players]);

  // Approve / Reject player status
  const handleUpdateStatus = async (playerId, status) => {
    try {
      const res = await fetch(`http://localhost:5000/api/tournaments/${tournament.id}/players/${playerId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast(`Player ${playerId} registration set to ${status}`, 'success');
      fetchPlayers();
    } catch (err) {
      addToast(err.message, 'danger');
    }
  };

  const handleExportCSV = () => {
    if (!tournament) return;
    window.open(`http://localhost:5000/api/exports/${tournament.id}/players`);
    addToast('Downloading players list CSV...', 'success');
  };

  const handleExportAuctionResultsPDF = () => {
    if (!tournament) return;
    window.open(`http://localhost:5000/api/exports/${tournament.id}/results`);
    addToast('Generating live auction results PDF...', 'success');
  };

  const handlePrintSlip = (playerId) => {
    window.open(`http://localhost:5000/api/exports/player/${playerId}/slip`);
    addToast('Downloading printable player slip PDF...', 'success');
  };

  return (
    <div style={{ padding: '0 15px 40px 15px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header Panel */}
      <section className="glass-panel" style={{ padding: '15px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)' }} className="text-gradient">Player Database</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Manage registrations, approve drafting statuses, and export records</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={handleExportAuctionResultsPDF}>
            <FileText size={16} /> Auction Results PDF
          </button>
        </div>
      </section>

      {/* Filters block */}
      <section className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        
        <div className="form-group" style={{ flex: 2, minWidth: '200px', marginBottom: 0 }}>
          <label className="form-label">Search Players</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search by name, village, or ID..." 
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
          <label className="form-label">Filter Role</label>
          <select className="form-control" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="All">All Roles</option>
            <option value="Batsman">Batsmen</option>
            <option value="Bowler">Bowlers</option>
            <option value="All-Rounder">All-Rounders</option>
            <option value="Wicket-Keeper">Wicket-Keepers</option>
          </select>
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
          <label className="form-label">Registration Status</label>
          <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="registered">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

      </section>

      {/* Players List Table */}
      <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading player directory...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No players found matching your criteria.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Player ID</th>
                <th>Name</th>
                <th>Village</th>
                <th>Role</th>
                <th>Base Price</th>
                <th>Highest Score</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map(p => (
                <tr key={p.id}>
                  <td>
                    <img 
                      src={p.photo_url || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80'} 
                      alt="" 
                      style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                    />
                  </td>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{p.id}</td>
                  <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                  <td>{p.village}</td>
                  <td>
                    <span style={{ fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: '4px' }}>
                      {p.role}
                    </span>
                  </td>
                  <td>INR {p.base_price.toLocaleString()}</td>
                  <td>{p.highest_score}</td>
                  <td>
                    {p.status === 'approved' && <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.85rem' }}>Approved</span>}
                    {p.status === 'rejected' && <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.85rem' }}>Rejected</span>}
                    {p.status === 'registered' && <span style={{ color: 'var(--warning)', fontWeight: 'bold', fontSize: '0.85rem' }}>Pending</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      {/* Printable slip link */}
                      {p.status === 'approved' && (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px', minWidth: 'auto' }} 
                          onClick={() => handlePrintSlip(p.id)}
                          title="Print Registration Slip"
                        >
                          <Printer size={14} />
                        </button>
                      )}

                      {/* Admin controls to approve/reject */}
                      {user?.role === 'admin' && p.status === 'registered' && (
                        <>
                          <button 
                            className="btn btn-success" 
                            style={{ padding: '6px', minWidth: 'auto', backgroundColor: 'var(--success)' }}
                            onClick={() => handleUpdateStatus(p.id, 'approved')}
                            title="Approve Player"
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '6px', minWidth: 'auto', backgroundColor: 'var(--danger)' }}
                            onClick={() => handleUpdateStatus(p.id, 'rejected')}
                            title="Reject Player"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
