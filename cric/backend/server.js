require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { getDb, initDb } = require('./db');
const { generateToken, authenticateToken, requireRole } = require('./auth');
const {
  generatePlayersCSV,
  generateAuctionResultsPDF,
  generateTeamsPDF,
  generatePlayerSlipPDF
} = require('./export');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// In-memory active auction states
const activeAuctions = {};

// Helper to log audit events
async function logAudit(dbConn, tournamentId, userId, action, details) {
  const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await dbConn.run(
    'INSERT INTO audit_logs (id, tournament_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)',
    [logId, tournamentId, userId, action, details]
  );
}

// Helper to send real-time notification
async function createNotification(dbConn, userId, title, content) {
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await dbConn.run(
    'INSERT INTO notifications (id, user_id, title, content) VALUES (?, ?, ?, ?)',
    [notifId, userId, title, content]
  );
  // Broadcast to this user's socket room if active
  io.to(`user-${userId}`).emit('notification', { id: notifId, title, content, is_read: 0, created_at: new Date() });
}

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join tournament room
  socket.on('join_tournament', async (tournamentId) => {
    socket.join(tournamentId);
    console.log(`Socket ${socket.id} joined tournament room: ${tournamentId}`);

    // If auction state exists in memory, send it, otherwise fetch from DB
    if (!activeAuctions[tournamentId]) {
      await initializeAuctionState(tournamentId);
    }
    socket.emit('auction_state_update', getCleanState(tournamentId));
  });

  // Join user room for direct notifications
  socket.on('join_user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`Socket ${socket.id} joined user room: user-${userId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Initialize Auction State from DB
async function initializeAuctionState(tournamentId) {
  const dbConn = await getDb();
  
  // Get active auction
  const auction = await dbConn.get(
    'SELECT * FROM auctions WHERE tournament_id = ? AND status != "completed" LIMIT 1',
    [tournamentId]
  );

  const settings = await dbConn.get(
    'SELECT * FROM tournament_settings WHERE tournament_id = ?',
    [tournamentId]
  );

  if (!auction) {
    activeAuctions[tournamentId] = {
      auctionId: null,
      status: 'upcoming',
      currentPlayerId: null,
      currentPlayer: null,
      timer: 30,
      timerInterval: null,
      currentBid: 0,
      highestBidderTeamId: null,
      highestBidderTeamName: null,
      bidHistory: [],
      settings: settings || { default_timer_seconds: 30, default_bid_increment: 1000 }
    };
    return;
  }

  // Get current player details if any
  let playerDetails = null;
  let lotNumber = 0;
  let apId = null;
  if (auction.current_player_id) {
    playerDetails = await dbConn.get('SELECT * FROM players WHERE id = ?', [auction.current_player_id]);
    const ap = await dbConn.get(
      'SELECT id, lot_number FROM auction_players WHERE auction_id = ? AND player_id = ?',
      [auction.id, auction.current_player_id]
    );
    if (ap) {
      lotNumber = ap.lot_number;
      apId = ap.id;
    }
  }

  // Get bid history
  let bidHistory = [];
  if (apId) {
    const bids = await dbConn.all(
      `SELECT b.*, t.name as team_name 
       FROM bids b 
       JOIN teams t ON b.team_id = t.id 
       WHERE b.auction_player_id = ? 
       ORDER BY b.timestamp DESC`,
      [apId]
    );
    bidHistory = bids.map(b => ({
      teamId: b.team_id,
      teamName: b.team_name,
      amount: b.bid_amount,
      timestamp: b.timestamp
    }));
  }

  // Find bidder details
  let highestBidderTeamName = null;
  if (auction.highest_bidder_team_id) {
    const team = await dbConn.get('SELECT name FROM teams WHERE id = ?', [auction.highest_bidder_team_id]);
    if (team) highestBidderTeamName = team.name;
  }

  // Count total and sold players
  const progressStats = await dbConn.get(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status='sold' THEN 1 ELSE 0 END) as sold,
       SUM(CASE WHEN status='unsold' THEN 1 ELSE 0 END) as unsold
     FROM auction_players WHERE auction_id = ?`,
    [auction.id]
  );

  activeAuctions[tournamentId] = {
    auctionId: auction.id,
    status: auction.status,
    currentPlayerId: auction.current_player_id,
    currentPlayer: playerDetails,
    lotNumber: lotNumber,
    timer: auction.timer_remaining,
    timerInterval: null,
    currentBid: auction.current_bid,
    highestBidderTeamId: auction.highest_bidder_team_id,
    highestBidderTeamName: highestBidderTeamName,
    bidHistory: bidHistory,
    totalPlayers: progressStats ? progressStats.total : 0,
    auctionedPlayersCount: progressStats ? (progressStats.sold + progressStats.unsold) : 0,
    settings: settings
  };
}

// Get Clean State without interval object
function getCleanState(tournamentId) {
  const state = activeAuctions[tournamentId];
  if (!state) return null;
  const { timerInterval, ...clean } = state;
  return clean;
}

// Start Timer Tick
function startTimer(tournamentId) {
  const state = activeAuctions[tournamentId];
  if (!state || state.timerInterval) return;

  state.timerInterval = setInterval(async () => {
    if (state.timer > 0) {
      state.timer -= 1;
      io.to(tournamentId).emit('timer_tick', { timer: state.timer });
      
      // Periodically update DB with remaining time
      const dbConn = await getDb();
      await dbConn.run(
        'UPDATE auctions SET timer_remaining = ? WHERE id = ?',
        [state.timer, state.auctionId]
      );
    } else {
      // Timer finished
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      io.to(tournamentId).emit('timer_finished', getCleanState(tournamentId));
    }
  }, 1000);
}

// Stop Timer
function stopTimer(tournamentId) {
  const state = activeAuctions[tournamentId];
  if (state && state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

/* ==========================================================================
   AUTHENTICATION ROUTES
   ========================================================================== */

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, role, tournament_id, playerDetails, teamDetails } = req.body;
  
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'All base fields required' });
  }

  const dbConn = await getDb();

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const userId = `u-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    await dbConn.run('BEGIN TRANSACTION;');

    // Insert user
    await dbConn.run(
      'INSERT INTO users (id, tournament_id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, tournament_id || null, username, email, password_hash, role]
    );

    let createdTeamId = null;

    if (role === 'owner' && teamDetails) {
      createdTeamId = `t-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const settings = await dbConn.get('SELECT team_budget FROM tournament_settings WHERE tournament_id = ?', [tournament_id]);
      const initialBudget = settings ? settings.team_budget : 1000000;

      await dbConn.run(
        'INSERT INTO teams (id, tournament_id, name, logo_url, owner_id, budget, remaining_budget) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [createdTeamId, tournament_id, teamDetails.name, teamDetails.logo_url || '', userId, initialBudget, initialBudget]
      );

      // Link owner to team
      await dbConn.run('UPDATE users SET team_id = ? WHERE id = ?', [createdTeamId, userId]);
    }

    if (role === 'player' && playerDetails) {
      // Auto-generate Player ID (e.g. PLY-101)
      const countRes = await dbConn.get('SELECT COUNT(*) as count FROM players');
      const playerIndex = countRes.count + 1;
      const playerId = `PLY-${String(playerIndex).padStart(3, '0')}`;

      await dbConn.run(
        `INSERT INTO players (id, tournament_id, user_id, name, photo_url, village, role, batting_style, bowling_style, experience, highest_score, base_price, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          playerId,
          tournament_id,
          userId,
          playerDetails.name || username,
          playerDetails.photo_url || '',
          playerDetails.village,
          playerDetails.role,
          playerDetails.batting_style,
          playerDetails.bowling_style,
          playerDetails.experience,
          playerDetails.highest_score || 0,
          playerDetails.base_price,
          'registered' // Pending approval
        ]
      );
    }

    await dbConn.run('COMMIT;');
    res.status(201).json({ message: 'User registered successfully', userId });
  } catch (err) {
    await dbConn.run('ROLLBACK;');
    console.error(err);
    res.status(500).json({ error: 'Username or email already exists or invalid data' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const dbConn = await getDb();
  try {
    const user = await dbConn.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({ token, role: user.role, tournament_id: user.tournament_id, team_id: user.team_id, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const dbConn = await getDb();
  const user = await dbConn.get('SELECT id, username, email, role, tournament_id, team_id FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

/* ==========================================================================
   TOURNAMENTS & SETTINGS API
   ========================================================================== */

app.get('/api/tournaments', async (req, res) => {
  const dbConn = await getDb();
  const list = await dbConn.all('SELECT * FROM tournaments ORDER BY created_at DESC');
  res.json(list);
});

app.post('/api/tournaments', authenticateToken, requireRole(['superadmin']), async (req, res) => {
  const { name, logo_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Tournament name is required' });

  const dbConn = await getDb();
  try {
    const id = `t-${Date.now()}`;
    await dbConn.run('BEGIN TRANSACTION;');
    await dbConn.run('INSERT INTO tournaments (id, name, logo_url) VALUES (?, ?, ?)', [id, name, logo_url || '']);
    await dbConn.run(
      'INSERT INTO tournament_settings (tournament_id, registration_open, auction_open, default_bid_increment, default_timer_seconds, max_players_per_team, team_budget, registration_fee) VALUES (?, 1, 0, 1000, 30, 5, 1000000, 500)',
      [id]
    );
    await dbConn.run('COMMIT;');
    res.status(201).json({ id, name, logo_url });
  } catch (err) {
    await dbConn.run('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tournaments/:id/settings', async (req, res) => {
  const dbConn = await getDb();
  const settings = await dbConn.get('SELECT * FROM tournament_settings WHERE tournament_id = ?', [req.params.id]);
  if (!settings) return res.status(404).json({ error: 'Settings not found' });
  res.json(settings);
});

app.put('/api/tournaments/:id/settings', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { registration_open, auction_open, default_bid_increment, default_timer_seconds, max_players_per_team, team_budget, registration_fee } = req.body;
  const dbConn = await getDb();
  try {
    await dbConn.run(
      `UPDATE tournament_settings SET 
        registration_open = ?,
        auction_open = ?,
        default_bid_increment = ?,
        default_timer_seconds = ?,
        max_players_per_team = ?,
        team_budget = ?,
        registration_fee = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE tournament_id = ?`,
      [
        registration_open ? 1 : 0,
        auction_open ? 1 : 0,
        default_bid_increment,
        default_timer_seconds,
        max_players_per_team,
        team_budget,
        registration_fee,
        req.params.id
      ]
    );

    // Sync state if exists
    if (activeAuctions[req.params.id]) {
      const updatedSettings = await dbConn.get('SELECT * FROM tournament_settings WHERE tournament_id = ?', [req.params.id]);
      activeAuctions[req.params.id].settings = updatedSettings;
      io.to(req.params.id).emit('auction_state_update', getCleanState(req.params.id));
    }

    await logAudit(dbConn, req.params.id, req.user.id, 'UPDATE_SETTINGS', 'Settings updated');
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   TEAMS & PLAYERS API
   ========================================================================== */

app.get('/api/tournaments/:id/teams', async (req, res) => {
  const dbConn = await getDb();
  const list = await dbConn.all(
    `SELECT t.*, u.username as owner_name, u.email as owner_email 
     FROM teams t 
     LEFT JOIN users u ON t.owner_id = u.id 
     WHERE t.tournament_id = ?`,
    [req.params.id]
  );
  
  // Attach bought players to each team
  for (const team of list) {
    const playersBought = await dbConn.all(
      `SELECT p.*, ap.sold_price 
       FROM players p
       JOIN auction_players ap ON p.id = ap.player_id
       WHERE ap.sold_to_team_id = ? AND ap.status = 'sold'`,
      [team.id]
    );
    team.players = playersBought;
  }

  res.json(list);
});

app.post('/api/tournaments/:id/teams', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { name, logo_url, owner_username, owner_email, owner_password } = req.body;
  if (!name || !owner_username || !owner_email || !owner_password) {
    return res.status(400).json({ error: 'Team name and owner login credentials required' });
  }

  const dbConn = await getDb();
  try {
    await dbConn.run('BEGIN TRANSACTION;');

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(owner_password, salt);
    const ownerId = `u-${Date.now()}`;
    const teamId = `t-${Date.now()}`;

    // Create Owner User
    await dbConn.run(
      'INSERT INTO users (id, tournament_id, username, email, password_hash, role, team_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [ownerId, req.params.id, owner_username, owner_email, password_hash, 'owner', teamId]
    );

    // Get default budget
    const settings = await dbConn.get('SELECT team_budget FROM tournament_settings WHERE tournament_id = ?', [req.params.id]);
    const budget = settings ? settings.team_budget : 1000000;

    // Create Team
    await dbConn.run(
      'INSERT INTO teams (id, tournament_id, name, logo_url, owner_id, budget, remaining_budget) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [teamId, req.params.id, name, logo_url || '', ownerId, budget, budget]
    );

    await logAudit(dbConn, req.params.id, req.user.id, 'CREATE_TEAM', `Created team ${name} with owner ${owner_username}`);
    await dbConn.run('COMMIT;');
    res.status(201).json({ teamId, name });
  } catch (err) {
    await dbConn.run('ROLLBACK;');
    res.status(500).json({ error: 'Username or email already exists or invalid data' });
  }
});

// Get all players for tournament
app.get('/api/tournaments/:id/players', async (req, res) => {
  const dbConn = await getDb();
  const list = await dbConn.all(
    `SELECT p.*, ap.status as auction_status, ap.sold_price, t.name as team_name
     FROM players p
     LEFT JOIN auction_players ap ON p.id = ap.player_id
     LEFT JOIN teams t ON ap.sold_to_team_id = t.id
     WHERE p.tournament_id = ?`,
    [req.params.id]
  );
  res.json(list);
});

// Admin approves/rejects player registration
app.put('/api/tournaments/:id/players/:playerId/status', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { status } = req.body; // approved, rejected
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const dbConn = await getDb();
  try {
    await dbConn.run('BEGIN TRANSACTION;');

    await dbConn.run(
      'UPDATE players SET status = ? WHERE id = ? AND tournament_id = ?',
      [status, req.params.playerId, req.params.id]
    );

    // If approved, verify if player is in auctions table, otherwise add
    if (status === 'approved') {
      const activeAuction = await dbConn.get('SELECT id FROM auctions WHERE tournament_id = ? AND status != "completed" LIMIT 1', [req.params.id]);
      if (activeAuction) {
        const apExists = await dbConn.get('SELECT id FROM auction_players WHERE auction_id = ? AND player_id = ?', [activeAuction.id, req.params.playerId]);
        if (!apExists) {
          const maxLot = await dbConn.get('SELECT MAX(lot_number) as max_lot FROM auction_players WHERE auction_id = ?', [activeAuction.id]);
          const lot = (maxLot.max_lot || 0) + 1;
          await dbConn.run(
            'INSERT INTO auction_players (id, auction_id, player_id, lot_number, status) VALUES (?, ?, ?, ?, "unsold")',
            [`ap-${req.params.playerId}`, activeAuction.id, req.params.playerId, lot]
          );
        }
      }
    }

    const player = await dbConn.get('SELECT * FROM players WHERE id = ?', [req.params.playerId]);
    if (player && player.user_id) {
      await createNotification(
        dbConn,
        player.user_id,
        status === 'approved' ? 'Registration Approved' : 'Registration Rejected',
        `Your player registration for the tournament has been ${status} by the administrator.`
      );
    }

    await logAudit(dbConn, req.params.id, req.user.id, `PLAYER_${status.toUpperCase()}`, `Player ${req.params.playerId} registration ${status}`);
    await dbConn.run('COMMIT;');
    res.json({ message: `Player registration ${status}` });
  } catch (err) {
    await dbConn.run('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   NOTIFICATIONS & ANNOUNCEMENTS
   ========================================================================== */

app.get('/api/notifications', authenticateToken, async (req, res) => {
  const dbConn = await getDb();
  const list = await dbConn.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(list);
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  const dbConn = await getDb();
  await dbConn.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'Notification marked as read' });
});

app.get('/api/tournaments/:id/announcements', async (req, res) => {
  const dbConn = await getDb();
  const list = await dbConn.all('SELECT * FROM announcements WHERE tournament_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json(list);
});

/* ==========================================================================
   AUDIT LOGS
   ========================================================================== */

app.get('/api/tournaments/:id/audit-logs', authenticateToken, requireRole(['admin']), async (req, res) => {
  const dbConn = await getDb();
  const list = await dbConn.all(
    `SELECT a.*, u.username 
     FROM audit_logs a 
     LEFT JOIN users u ON a.user_id = u.id 
     WHERE a.tournament_id = ? 
     ORDER BY a.timestamp DESC`,
    [req.params.id]
  );
  res.json(list);
});

/* ==========================================================================
   DASHBOARD ANALYTICS
   ========================================================================== */

app.get('/api/tournaments/:id/analytics', async (req, res) => {
  const dbConn = await getDb();
  const tId = req.params.id;

  try {
    // Player Stats
    const playerStats = await dbConn.get(
      `SELECT 
         COUNT(*) as total_registered,
         SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved_players,
         SUM(CASE WHEN status='registered' THEN 1 ELSE 0 END) as pending_approval
       FROM players WHERE tournament_id = ?`,
      [tId]
    );

    // Team Stats
    const teamStats = await dbConn.all(
      `SELECT t.*, u.username as owner_name,
         (SELECT COUNT(*) FROM auction_players ap WHERE ap.sold_to_team_id = t.id AND ap.status = 'sold') as players_bought
       FROM teams t 
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.tournament_id = ?`,
      [tId]
    );

    // Auction summary
    const auction = await dbConn.get('SELECT * FROM auctions WHERE tournament_id = ? AND status != "completed" LIMIT 1', [tId]);
    let auctionSummary = { total_lots: 0, sold_lots: 0, unsold_lots: 0, total_value: 0, highest_sold_price: 0, highest_sold_player: null };
    
    if (auction) {
      const summary = await dbConn.get(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status='sold' THEN 1 ELSE 0 END) as sold,
           SUM(CASE WHEN status='unsold' THEN 1 ELSE 0 END) as unsold,
           SUM(sold_price) as total_value,
           MAX(sold_price) as max_price
         FROM auction_players WHERE auction_id = ?`,
        [auction.id]
      );

      let highestPlayer = null;
      if (summary && summary.max_price > 0) {
        highestPlayer = await dbConn.get(
          `SELECT p.name, t.name as team_name, ap.sold_price 
           FROM auction_players ap
           JOIN players p ON ap.player_id = p.id
           JOIN teams t ON ap.sold_to_team_id = t.id
           WHERE ap.auction_id = ? AND ap.sold_price = ? LIMIT 1`,
          [auction.id, summary.max_price]
        );
      }

      auctionSummary = {
        total_lots: summary.total || 0,
        sold_lots: summary.sold || 0,
        unsold_lots: summary.unsold || 0,
        total_value: summary.total_value || 0,
        highest_sold_price: summary.max_price || 0,
        highest_sold_player: highestPlayer ? highestPlayer.name : null,
        highest_sold_team: highestPlayer ? highestPlayer.team_name : null
      };
    }

    res.json({
      playerStats,
      teamStats,
      auctionSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   EXPORT ENDPOINTS
   ========================================================================== */

app.get('/api/exports/:id/players', async (req, res) => {
  const dbConn = await getDb();
  const players = await dbConn.all('SELECT * FROM players WHERE tournament_id = ?', [req.params.id]);
  const csv = generatePlayersCSV(players);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=players_list_${req.params.id}.csv`);
  res.send(csv);
});

app.get('/api/exports/:id/results', async (req, res) => {
  const dbConn = await getDb();
  const t = await dbConn.get('SELECT name FROM tournaments WHERE id = ?', [req.params.id]);
  const auction = await dbConn.get('SELECT id FROM auctions WHERE tournament_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
  if (!auction) return res.status(404).json({ error: 'No auctions found' });

  const results = await dbConn.all(
    `SELECT ap.*, p.name as player_name, p.role as player_role, t.name as team_name 
     FROM auction_players ap
     JOIN players p ON ap.player_id = p.id
     LEFT JOIN teams t ON ap.sold_to_team_id = t.id
     WHERE ap.auction_id = ? AND ap.status IN ('sold', 'unsold')
     ORDER BY ap.lot_number ASC`,
    [auction.id]
  );

  await generateAuctionResultsPDF(res, t ? t.name : 'Tournament', results);
});

app.get('/api/exports/:id/teams', async (req, res) => {
  const dbConn = await getDb();
  const t = await dbConn.get('SELECT name FROM tournaments WHERE id = ?', [req.params.id]);
  const teams = await dbConn.all(
    `SELECT t.*, u.username as owner_name 
     FROM teams t 
     LEFT JOIN users u ON t.owner_id = u.id
     WHERE t.tournament_id = ?`,
    [req.params.id]
  );

  for (const team of teams) {
    team.players = await dbConn.all(
      `SELECT p.id, p.name, p.role, p.village, ap.sold_price 
       FROM players p
       JOIN auction_players ap ON p.id = ap.player_id
       WHERE ap.sold_to_team_id = ? AND ap.status = 'sold'`,
      [team.id]
    );
  }

  await generateTeamsPDF(res, t ? t.name : 'Tournament', teams);
});

app.get('/api/exports/player/:playerId/slip', async (req, res) => {
  const dbConn = await getDb();
  const player = await dbConn.get('SELECT * FROM players WHERE id = ?', [req.params.playerId]);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const t = await dbConn.get('SELECT name FROM tournaments WHERE id = ?', [player.tournament_id]);

  await generatePlayerSlipPDF(res, player, t ? t.name : 'Tournament');
});


/* ==========================================================================
   SOCKET-BASED BIDDING AND CONTROLS (REST APIS AS FALLBACK OR DIRECT HANDLERS)
   ========================================================================== */

// Place Bid API / Handler
app.post('/api/tournaments/:id/bid', authenticateToken, requireRole(['owner']), async (req, res) => {
  const { amount } = req.body;
  const tId = req.params.id;

  const state = activeAuctions[tId];
  if (!state || state.status !== 'live') {
    return res.status(400).json({ error: 'Auction is not live' });
  }

  if (!state.currentPlayerId) {
    return res.status(400).json({ error: 'No player is active' });
  }

  const dbConn = await getDb();

  // Validate owner team
  const team = await dbConn.get('SELECT * FROM teams WHERE owner_id = ? AND tournament_id = ?', [req.user.id, tId]);
  if (!team) {
    return res.status(400).json({ error: 'You do not own a team in this tournament' });
  }

  // Validate bidding limits
  if (amount <= state.currentBid) {
    return res.status(400).json({ error: `Bid must be greater than current bid (INR ${state.currentBid})` });
  }

  if (team.remaining_budget < amount) {
    return res.status(400).json({ error: `Insufficient team budget (Remaining: INR ${team.remaining_budget})` });
  }

  // Validate slot capacity
  const squadCount = await dbConn.get(
    'SELECT COUNT(*) as count FROM auction_players WHERE sold_to_team_id = ? AND status = "sold"',
    [team.id]
  );
  if (squadCount.count >= state.settings.max_players_per_team) {
    return res.status(400).json({ error: `Maximum roster capacity reached (${state.settings.max_players_per_team} players)` });
  }

  try {
    await dbConn.run('BEGIN TRANSACTION;');

    // Record bid
    const bidId = `bid-${Date.now()}`;
    const apId = `ap-${state.currentPlayerId}`;
    await dbConn.run(
      'INSERT INTO bids (id, auction_player_id, team_id, bid_amount) VALUES (?, ?, ?, ?)',
      [bidId, apId, team.id, amount]
    );

    // Update auction state in memory and database
    state.currentBid = amount;
    state.highestBidderTeamId = team.id;
    state.highestBidderTeamName = team.name;
    
    // Push history item
    state.bidHistory.unshift({
      teamId: team.id,
      teamName: team.name,
      amount: amount,
      timestamp: new Date()
    });

    await dbConn.run(
      'UPDATE auctions SET current_bid = ?, highest_bidder_team_id = ? WHERE id = ?',
      [amount, team.id, state.auctionId]
    );

    // Bidding extension rules: "If a bid comes during last 10 seconds, Timer increases by 10 seconds."
    if (state.timer <= 10) {
      state.timer += 10;
      io.to(tId).emit('announcement_published', {
        id: `an-${Date.now()}`,
        content: `Bid placed in last 10 seconds! Timer extended by 10s.`,
        created_at: new Date()
      });
    }

    await dbConn.run('COMMIT;');

    // Broadcast update
    io.to(tId).emit('auction_state_update', getCleanState(tId));
    io.to(tId).emit('bid_placed', {
      teamName: team.name,
      amount: amount,
      timer: state.timer
    });

    // Check budget warning (e.g. if remaining budget drops below 10% of total)
    if (team.remaining_budget - amount < team.budget * 0.1) {
      await createNotification(
        dbConn,
        team.owner_id,
        'Budget Warning',
        `Your remaining team budget is low: INR ${(team.remaining_budget - amount).toLocaleString()}`
      );
    }

    res.json({ message: 'Bid placed successfully' });
  } catch (err) {
    await dbConn.run('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// Admin Controls API
app.post('/api/tournaments/:id/admin-control', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { action, data } = req.body;
  const tId = req.params.id;

  if (!activeAuctions[tId]) {
    await initializeAuctionState(tId);
  }
  const state = activeAuctions[tId];
  const dbConn = await getDb();

  try {
    if (action === 'START') {
      state.status = 'live';
      await dbConn.run('UPDATE auctions SET status = "live" WHERE id = ?', [state.auctionId]);
      startTimer(tId);
      await logAudit(dbConn, tId, req.user.id, 'START_AUCTION', `Auction status set to live`);
      
      // Notify team owners
      const owners = await dbConn.all('SELECT id FROM users WHERE tournament_id = ? AND role = "owner"', [tId]);
      for (const ow of owners) {
        await createNotification(dbConn, ow.id, 'Auction Started', 'The real-time player auction has officially started!');
      }

      io.to(tId).emit('announcement_published', { id: `an-${Date.now()}`, content: 'Auction Started!', created_at: new Date() });
    }
    
    else if (action === 'PAUSE') {
      state.status = 'paused';
      await dbConn.run('UPDATE auctions SET status = "paused" WHERE id = ?', [state.auctionId]);
      stopTimer(tId);
      await logAudit(dbConn, tId, req.user.id, 'PAUSE_AUCTION', `Auction status paused`);
      io.to(tId).emit('announcement_published', { id: `an-${Date.now()}`, content: 'Auction Paused!', created_at: new Date() });
    }
    
    else if (action === 'RESUME') {
      state.status = 'live';
      await dbConn.run('UPDATE auctions SET status = "live" WHERE id = ?', [state.auctionId]);
      startTimer(tId);
      await logAudit(dbConn, tId, req.user.id, 'RESUME_AUCTION', `Auction status resumed`);
      io.to(tId).emit('announcement_published', { id: `an-${Date.now()}`, content: 'Auction Resumed!', created_at: new Date() });
    }
    
    else if (action === 'END') {
      state.status = 'completed';
      await dbConn.run('UPDATE auctions SET status = "completed" WHERE id = ?', [state.auctionId]);
      stopTimer(tId);
      await logAudit(dbConn, tId, req.user.id, 'END_AUCTION', `Auction completed`);
      io.to(tId).emit('announcement_published', { id: `an-${Date.now()}`, content: 'Auction Completed! Thank you for participating.', created_at: new Date() });
    }
    
    else if (action === 'SELECT_PLAYER') {
      // Find the specific player or the next unsold player
      let selectedPlayerId = data ? data.playerId : null;
      if (!selectedPlayerId) {
        // Find next unsold in auction_players
        const nextAp = await dbConn.get(
          `SELECT player_id FROM auction_players 
           WHERE auction_id = ? AND status = "unsold" 
           ORDER BY lot_number ASC LIMIT 1`,
          [state.auctionId]
        );
        if (!nextAp) {
          return res.status(400).json({ error: 'No more unsold players left in this auction' });
        }
        selectedPlayerId = nextAp.player_id;
      }

      const player = await dbConn.get('SELECT * FROM players WHERE id = ?', [selectedPlayerId]);
      const ap = await dbConn.get('SELECT lot_number FROM auction_players WHERE auction_id = ? AND player_id = ?', [state.auctionId, selectedPlayerId]);
      
      stopTimer(tId);
      
      state.currentPlayerId = selectedPlayerId;
      state.currentPlayer = player;
      state.lotNumber = ap ? ap.lot_number : 0;
      state.currentBid = player.base_price;
      state.highestBidderTeamId = null;
      state.highestBidderTeamName = null;
      state.bidHistory = [];
      state.timer = state.settings.default_timer_seconds;

      // Update in DB
      await dbConn.run(
        'UPDATE auctions SET current_player_id = ?, current_bid = ?, highest_bidder_team_id = ?, timer_remaining = ? WHERE id = ?',
        [selectedPlayerId, player.base_price, null, state.timer, state.auctionId]
      );

      // Start timer if live
      if (state.status === 'live') {
        startTimer(tId);
      }

      await logAudit(dbConn, tId, req.user.id, 'SELECT_PLAYER', `Selected player ${player.name} (Lot #${state.lotNumber})`);
      io.to(tId).emit('announcement_published', {
        id: `an-${Date.now()}`,
        content: `Next Player: ${player.name} (Lot #${state.lotNumber}, Base Price: INR ${player.base_price.toLocaleString()})`,
        created_at: new Date()
      });
    }
    
    else if (action === 'MARK_SOLD') {
      if (!state.currentPlayerId || !state.highestBidderTeamId) {
        return res.status(400).json({ error: 'No active player or no bids placed' });
      }

      stopTimer(tId);
      
      const apId = `ap-${state.currentPlayerId}`;
      const soldPrice = state.currentBid;
      const teamId = state.highestBidderTeamId;

      await dbConn.run('BEGIN TRANSACTION;');

      // Mark player as sold in auction_players
      await dbConn.run(
        'UPDATE auction_players SET status = "sold", sold_to_team_id = ?, sold_price = ? WHERE id = ?',
        [teamId, soldPrice, apId]
      );

      // Deduct budget from team
      await dbConn.run(
        'UPDATE teams SET remaining_budget = remaining_budget - ? WHERE id = ?',
        [soldPrice, teamId]
      );

      await dbConn.run('COMMIT;');

      // Create notifications
      const buyerTeam = await dbConn.get('SELECT name, owner_id FROM teams WHERE id = ?', [teamId]);
      await createNotification(
        dbConn,
        buyerTeam.owner_id,
        'Player Purchased',
        `Success! You bought ${state.currentPlayer.name} for INR ${soldPrice.toLocaleString()}`
      );

      if (state.currentPlayer.user_id) {
        await createNotification(
          dbConn,
          state.currentPlayer.user_id,
          'Selected by Team',
          `Congratulations! You were bought by ${buyerTeam.name} for INR ${soldPrice.toLocaleString()}`
        );
      }

      await logAudit(
        dbConn,
        tId,
        req.user.id,
        'MARK_SOLD',
        `Player ${state.currentPlayer.name} sold to ${buyerTeam.name} for INR ${soldPrice}`
      );

      io.to(tId).emit('announcement_published', {
        id: `an-${Date.now()}`,
        content: `SOLD: ${state.currentPlayer.name} sold to ${buyerTeam.name} for INR ${soldPrice.toLocaleString()}!`,
        created_at: new Date()
      });

      // Clear memory details
      state.currentPlayerId = null;
      state.currentPlayer = null;
      state.currentBid = 0;
      state.highestBidderTeamId = null;
      state.highestBidderTeamName = null;
      state.bidHistory = [];

      // Update progress stats
      const progressStats = await dbConn.get(
        `SELECT 
           SUM(CASE WHEN status='sold' THEN 1 ELSE 0 END) as sold,
           SUM(CASE WHEN status='unsold' THEN 1 ELSE 0 END) as unsold
         FROM auction_players WHERE auction_id = ?`,
        [state.auctionId]
      );
      state.auctionedPlayersCount = progressStats ? (progressStats.sold + progressStats.unsold) : 0;

      await dbConn.run(
        'UPDATE auctions SET current_player_id = NULL, current_bid = 0, highest_bidder_team_id = NULL WHERE id = ?',
        [state.auctionId]
      );
    }
    
    else if (action === 'MARK_UNSOLD') {
      if (!state.currentPlayerId) {
        return res.status(400).json({ error: 'No active player' });
      }

      stopTimer(tId);
      
      const apId = `ap-${state.currentPlayerId}`;
      await dbConn.run(
        'UPDATE auction_players SET status = "unsold" WHERE id = ?',
        [apId]
      );

      await logAudit(dbConn, tId, req.user.id, 'MARK_UNSOLD', `Player ${state.currentPlayer.name} marked UNSOLD`);
      io.to(tId).emit('announcement_published', {
        id: `an-${Date.now()}`,
        content: `UNSOLD: ${state.currentPlayer.name} remains unsold.`,
        created_at: new Date()
      });

      state.currentPlayerId = null;
      state.currentPlayer = null;
      state.currentBid = 0;
      state.highestBidderTeamId = null;
      state.highestBidderTeamName = null;
      state.bidHistory = [];

      const progressStats = await dbConn.get(
        `SELECT 
           SUM(CASE WHEN status='sold' THEN 1 ELSE 0 END) as sold,
           SUM(CASE WHEN status='unsold' THEN 1 ELSE 0 END) as unsold
         FROM auction_players WHERE auction_id = ?`,
        [state.auctionId]
      );
      state.auctionedPlayersCount = progressStats ? (progressStats.sold + progressStats.unsold) : 0;

      await dbConn.run(
        'UPDATE auctions SET current_player_id = NULL, current_bid = 0, highest_bidder_team_id = NULL WHERE id = ?',
        [state.auctionId]
      );
    }
    
    else if (action === 'SKIP_PLAYER') {
      if (!state.currentPlayerId) {
        return res.status(400).json({ error: 'No player is active to skip' });
      }
      
      stopTimer(tId);
      
      const skippedPlayerName = state.currentPlayer.name;
      await logAudit(dbConn, tId, req.user.id, 'SKIP_PLAYER', `Skipped player ${skippedPlayerName}`);

      io.to(tId).emit('announcement_published', {
        id: `an-${Date.now()}`,
        content: `Admin skipped player: ${skippedPlayerName}. Player returned to lot.`,
        created_at: new Date()
      });

      // Clear memory details
      state.currentPlayerId = null;
      state.currentPlayer = null;
      state.currentBid = 0;
      state.highestBidderTeamId = null;
      state.highestBidderTeamName = null;
      state.bidHistory = [];

      await dbConn.run(
        'UPDATE auctions SET current_player_id = NULL, current_bid = 0, highest_bidder_team_id = NULL WHERE id = ?',
        [state.auctionId]
      );
    }
    
    else if (action === 'CANCEL_BID') {
      if (!state.currentPlayerId || state.bidHistory.length === 0) {
        return res.status(400).json({ error: 'No active bids to cancel' });
      }

      await dbConn.run('BEGIN TRANSACTION;');

      // Remove the latest bid from bids table
      const apId = `ap-${state.currentPlayerId}`;
      const latestBid = state.bidHistory[0];
      await dbConn.run(
        'DELETE FROM bids WHERE auction_player_id = ? AND team_id = ? AND bid_amount = ?',
        [apId, latestBid.teamId, latestBid.amount]
      );

      // Revert history
      state.bidHistory.shift();

      if (state.bidHistory.length > 0) {
        const prevBid = state.bidHistory[0];
        state.currentBid = prevBid.amount;
        state.highestBidderTeamId = prevBid.teamId;
        state.highestBidderTeamName = prevBid.teamName;
      } else {
        state.currentBid = state.currentPlayer.base_price;
        state.highestBidderTeamId = null;
        state.highestBidderTeamName = null;
      }

      // Sync to DB
      await dbConn.run(
        'UPDATE auctions SET current_bid = ?, highest_bidder_team_id = ? WHERE id = ?',
        [state.currentBid, state.highestBidderTeamId, state.auctionId]
      );

      await dbConn.run('COMMIT;');

      await logAudit(dbConn, tId, req.user.id, 'CANCEL_BID', `Cancelled bid by ${latestBid.teamName} of INR ${latestBid.amount}`);
      io.to(tId).emit('announcement_published', {
        id: `an-${Date.now()}`,
        content: `Admin cancelled wrong bid. Reverted current bid to INR ${state.currentBid.toLocaleString()}`,
        created_at: new Date()
      });
    }
    
    else if (action === 'CHANGE_BASE_PRICE') {
      const { basePrice } = data;
      if (!state.currentPlayerId) {
        return res.status(400).json({ error: 'No player active' });
      }
      if (state.bidHistory.length > 0) {
        return res.status(400).json({ error: 'Cannot change base price after bids have been placed' });
      }

      await dbConn.run(
        'UPDATE players SET base_price = ? WHERE id = ?',
        [basePrice, state.currentPlayerId]
      );

      state.currentPlayer.base_price = basePrice;
      state.currentBid = basePrice;
      
      await dbConn.run(
        'UPDATE auctions SET current_bid = ? WHERE id = ?',
        [basePrice, state.auctionId]
      );

      await logAudit(dbConn, tId, req.user.id, 'CHANGE_BASE_PRICE', `Changed base price of ${state.currentPlayer.name} to INR ${basePrice}`);
      io.to(tId).emit('announcement_published', {
        id: `an-${Date.now()}`,
        content: `Base price for ${state.currentPlayer.name} updated to INR ${basePrice.toLocaleString()}`,
        created_at: new Date()
      });
    }
    
    else if (action === 'ADD_ANNOUNCEMENT') {
      const { content } = data;
      if (!content) return res.status(400).json({ error: 'Content required' });
      
      const announcementId = `an-${Date.now()}`;
      await dbConn.run(
        'INSERT INTO announcements (id, tournament_id, content) VALUES (?, ?, ?)',
        [announcementId, tId, content]
      );

      io.to(tId).emit('announcement_published', {
        id: announcementId,
        content,
        created_at: new Date()
      });
    }

    // Broadcast full state update to everyone in room
    io.to(tId).emit('auction_state_update', getCleanState(tId));
    res.json({ message: 'Action completed successfully', state: getCleanState(tId) });
  } catch (err) {
    if (dbConn.inTransaction) await dbConn.run('ROLLBACK;');
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Live Auction Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
