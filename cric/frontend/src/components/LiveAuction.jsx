import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, AlertTriangle, UserCheck, XCircle, Award, FastForward, Edit2, Volume2, Clock, CheckCircle2, UserPlus } from 'lucide-react';

export default function LiveAuction({ user, token, addToast, socket, tournament }) {
  const [auctionState, setAuctionState] = useState(null);
  const [localTimer, setLocalTimer] = useState(30);
  const [customBidIncrement, setCustomBidIncrement] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');

  // Ref to trigger animations on bid updates
  const bidRef = useRef(null);

  // Fetch initial auction state
  const fetchState = () => {
    if (!tournament) return;
    fetch(`http://localhost:5000/api/tournaments/${tournament.id}/auction`)
      .then(res => res.json())
      .then(data => {
        // Fallback: If not initialized yet
        if (!data || !data.auctionId) {
          initializeDefaultAuctionOnServer();
        }
      })
      .catch(err => console.error(err));
  };

  const initializeDefaultAuctionOnServer = async () => {
    // Just ping the admin control endpoint to kick off state initialization
    try {
      await fetch(`http://localhost:5000/api/tournaments/${tournament.id}/admin-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'SYNC' })
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!tournament) return;

    fetchState();

    if (!socket) return;

    // Join tournament room
    socket.emit('join_tournament', tournament.id);

    // Socket Event listeners
    socket.on('auction_state_update', (state) => {
      setAuctionState(state);
      if (state) {
        setLocalTimer(state.timer);
      }
    });

    socket.on('timer_tick', (data) => {
      setLocalTimer(data.timer);
    });

    socket.on('bid_placed', (data) => {
      // Trigger scaling animation
      if (bidRef.current) {
        bidRef.current.classList.add('bid-bump');
        setTimeout(() => {
          if (bidRef.current) bidRef.current.classList.remove('bid-bump');
        }, 4000);
      }
      addToast(`New Bid: ${data.teamName} bid INR ${data.amount.toLocaleString()}!`, 'success');
    });

    socket.on('timer_finished', () => {
      addToast('Time has run out! Admin needs to finalize lot.', 'warning');
    });

    return () => {
      socket.off('auction_state_update');
      socket.off('timer_tick');
      socket.off('bid_placed');
      socket.off('timer_finished');
    };
  }, [socket, tournament]);

  // Handle owner bidding Action
  const handlePlaceBid = async (increment) => {
    if (!auctionState || !auctionState.currentPlayer) return;

    // Calculate bid amount
    let bidAmount = auctionState.currentBid + increment;
    if (increment === 0) {
      // Custom bid increment
      const customInc = parseInt(customBidIncrement);
      if (isNaN(customInc) || customInc <= 0) {
        addToast('Please enter a valid custom increment', 'danger');
        return;
      }
      bidAmount = auctionState.currentBid + customInc;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/tournaments/${tournament.id}/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: bidAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCustomBidIncrement('');
    } catch (err) {
      addToast(err.message, 'danger');
    }
  };

  // Handle Admin Controls Action
  const handleAdminControl = async (action, extraData = null) => {
    try {
      const res = await fetch(`http://localhost:5000/api/tournaments/${tournament.id}/admin-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, data: extraData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (action === 'ADD_ANNOUNCEMENT') {
        setAnnouncementContent('');
      }
      addToast(`Action ${action} executed successfully`, 'success');
    } catch (err) {
      addToast(err.message, 'danger');
    }
  };

  // Determine budget / slot warning for Team Owners
  const isBiddingDisabled = () => {
    if (!user || user.role !== 'owner' || !auctionState || auctionState.status !== 'live' || !auctionState.currentPlayer) {
      return true;
    }
    // We would need current team details which we can pull from analytics or settings
    return false;
  };

  // Render Status Badge
  const renderStatusBadge = () => {
    if (!auctionState) return null;
    const status = auctionState.status.toUpperCase();
    if (status === 'LIVE') return <span style={{ backgroundColor: 'var(--success)', color: '#fff', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><span className="pulse-red-dot"></span> LIVE</span>;
    if (status === 'PAUSED') return <span style={{ backgroundColor: 'var(--warning)', color: '#fff', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>PAUSED</span>;
    return <span style={{ backgroundColor: 'var(--text-muted)', color: '#fff', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>{status}</span>;
  };

  return (
    <div style={{ padding: '0 15px 40px 15px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Upper Status strip */}
      <section className="glass-panel" style={{ padding: '15px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {renderStatusBadge()}
          <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            Lot Progress: <strong>{auctionState?.auctionedPlayersCount || 0} / {auctionState?.totalPlayers || 0}</strong>
          </span>
        </div>
        
        {/* Real-time Countdown Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className={localTimer <= 10 && auctionState?.status === 'live' ? 'text-danger' : ''}>
          <Clock size={20} />
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
            Time Remaining: {localTimer}s
          </span>
        </div>
      </section>

      {/* Main Grid: Left player details, Right bidding and logs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
        
        {/* Left Side: Active Player Details Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {!auctionState?.currentPlayer ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <Award size={48} style={{ color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>No Player Active</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.95rem' }}>
                The auction draft is waiting. {user?.role === 'admin' ? 'Select a player from the administrator control panel to start bidding.' : 'Waiting for the administrator to select the next player.'}
              </p>
              {user?.role === 'admin' && (
                <button className="btn btn-primary" onClick={() => handleAdminControl('SELECT_PLAYER')}>
                  Select Next Player
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Header card details */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
                <div>
                  <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Current Lot Selection</span>
                  <h3 style={{ fontSize: '1.85rem', fontFamily: 'var(--font-heading)' }}>
                    {auctionState.currentPlayer.name}
                  </h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Lot #{auctionState.lotNumber}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: '4px' }}>
                    {auctionState.currentPlayer.role}
                  </span>
                </div>
              </div>

              {/* Player Image and Bio */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '25px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <img 
                    src={auctionState.currentPlayer.photo_url || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300'} 
                    alt="Player Photo" 
                    style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '12px', border: '1.5px solid var(--border-color)' }}
                  />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    ID: {auctionState.currentPlayer.id}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>VILLAGE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{auctionState.currentPlayer.village}</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>EXPERIENCE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{auctionState.currentPlayer.experience}</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BATTING STYLE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{auctionState.currentPlayer.batting_style}</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BOWLING STYLE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{auctionState.currentPlayer.bowling_style}</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>HIGHEST SCORE / WKTS</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{auctionState.currentPlayer.highest_score}</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BASE PRICE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>INR {auctionState.currentPlayer.base_price.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Big Bid Display Box */}
              <div ref={bidRef} className="glass-panel" style={{ marginTop: '25px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.03) 100%)', border: '1.5px solid var(--accent-gold)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Leading Bid</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent-gold)' }}>
                    INR {auctionState.currentBid.toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Highest Bidder</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {auctionState.highestBidderTeamName || 'NO BIDS YET'}
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Right Side: Bid history, announcements and Owner Bidding panel / Admin Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Active Bidding Pad for Team Owners */}
          {user?.role === 'owner' && auctionState?.currentPlayer && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>OWNER BIDDING PAD</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className="btn btn-bid" onClick={() => handlePlaceBid(500)} disabled={isBiddingDisabled()}>+500</button>
                <button className="btn btn-bid" onClick={() => handlePlaceBid(1000)} disabled={isBiddingDisabled()}>+1000</button>
                <button className="btn btn-bid" onClick={() => handlePlaceBid(2000)} disabled={isBiddingDisabled()}>+2000</button>
                <button className="btn btn-bid" onClick={() => handlePlaceBid(5000)} disabled={isBiddingDisabled()}>+5000</button>
              </div>

              {/* Custom bidding input */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Custom Increment" 
                  value={customBidIncrement}
                  onChange={e => setCustomBidIncrement(e.target.value)}
                  disabled={isBiddingDisabled()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={() => handlePlaceBid(0)} disabled={isBiddingDisabled()}>
                  Place Bid
                </button>
              </div>

              {isBiddingDisabled() && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontSize: '0.8rem', marginTop: '5px' }}>
                  <AlertTriangle size={14} />
                  <span>Bidding is locked. Ensure the auction is LIVE.</span>
                </div>
              )}
            </div>
          )}

          {/* Admin Control Dashboard */}
          {user?.role === 'admin' && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--accent-secondary)' }}>ADMINISTRATOR AUCTION CONSOLE</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {auctionState?.status !== 'live' ? (
                  <button className="btn btn-success" onClick={() => handleAdminControl('START')}>
                    <Play size={14} /> Start / Resume
                  </button>
                ) : (
                  <button className="btn btn-secondary" onClick={() => handleAdminControl('PAUSE')}>
                    <Pause size={14} /> Pause Auction
                  </button>
                )}
                
                <button className="btn btn-secondary" onClick={() => handleAdminControl('SKIP_PLAYER')} disabled={!auctionState?.currentPlayer}>
                  <FastForward size={14} /> Skip Player
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button className="btn btn-success" onClick={() => handleAdminControl('MARK_SOLD')} disabled={!auctionState?.highestBidderTeamId}>
                  <CheckCircle2 size={14} /> Mark Sold
                </button>
                <button className="btn btn-danger" onClick={() => handleAdminControl('MARK_UNSOLD')} disabled={!auctionState?.currentPlayer}>
                  <XCircle size={14} /> Mark Unsold
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => handleAdminControl('CANCEL_BID')} disabled={!auctionState?.bidHistory?.length}>
                  Cancel Wrong Bid
                </button>
                <button className="btn btn-secondary" onClick={() => {
                  const newBase = prompt('Enter new base price (INR):', auctionState?.currentPlayer?.base_price);
                  if (newBase) handleAdminControl('CHANGE_BASE_PRICE', { basePrice: parseInt(newBase) });
                }} disabled={!auctionState?.currentPlayer || auctionState?.bidHistory?.length > 0}>
                  <Edit2 size={14} /> Edit Base Price
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Broadcast Announcement</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Lunch Break / Next player up..." 
                      value={announcementContent}
                      onChange={e => setAnnouncementContent(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" onClick={() => handleAdminControl('ADD_ANNOUNCEMENT', { content: announcementContent })}>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Watch-only disclaimer for public viewers */}
          {(!user || user.role === 'public' || user.role === 'player') && (
            <div className="glass-panel" style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed var(--accent-primary)' }}>
              <Volume2 size={18} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                You are in **Spectator Mode**. Bidding and dashboard control actions are locked.
              </span>
            </div>
          )}

          {/* Bid History Feed */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: '260px' }}>
            <h3 style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-secondary)' }}>ACTIVE BID HISTORY</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '300px' }}>
              {!auctionState?.bidHistory || auctionState.bidHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '0.9rem' }}>
                  No bids registered on this lot.
                </div>
              ) : (
                auctionState.bidHistory.map((bid, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '6px', backgroundColor: idx === 0 ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-secondary)', border: idx === 0 ? '1px solid var(--accent-gold)' : '1px solid transparent' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: idx === 0 ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                        {bid.teamName}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(bid.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: idx === 0 ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                      INR {bid.amount.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
