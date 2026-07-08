const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

let db = null;

async function getDb() {
  if (db) return db;
  const dbPath = path.resolve(__dirname, 'database.db');
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  return db;
}

async function initDb() {
  const database = await getDb();

  // Enable foreign keys
  await database.run('PRAGMA foreign_keys = ON;');

  // Create Tables
  await database.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      status TEXT CHECK( status IN ('active', 'completed') ) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tournament_settings (
      tournament_id TEXT PRIMARY KEY,
      registration_open BOOLEAN DEFAULT 1,
      auction_open BOOLEAN DEFAULT 0,
      default_bid_increment INTEGER DEFAULT 1000,
      default_timer_seconds INTEGER DEFAULT 30,
      max_players_per_team INTEGER DEFAULT 5,
      team_budget INTEGER DEFAULT 1000000,
      registration_fee INTEGER DEFAULT 500,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tournament_id TEXT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK( role IN ('superadmin', 'admin', 'owner', 'player', 'public') ) NOT NULL,
      team_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      name TEXT NOT NULL,
      logo_url TEXT,
      owner_id TEXT,
      budget INTEGER NOT NULL,
      remaining_budget INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY, -- PLY-001 format
      tournament_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      photo_url TEXT,
      village TEXT NOT NULL,
      role TEXT CHECK( role IN ('Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper') ) NOT NULL,
      batting_style TEXT NOT NULL,
      bowling_style TEXT NOT NULL,
      experience TEXT NOT NULL,
      highest_score INTEGER DEFAULT 0,
      base_price INTEGER NOT NULL,
      status TEXT CHECK( status IN ('registered', 'approved', 'rejected') ) DEFAULT 'registered',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS auctions (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT CHECK( status IN ('upcoming', 'live', 'paused', 'completed') ) DEFAULT 'upcoming',
      current_player_id TEXT,
      timer_remaining INTEGER DEFAULT 30,
      timer_configured INTEGER DEFAULT 30,
      current_bid INTEGER DEFAULT 0,
      highest_bidder_team_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (current_player_id) REFERENCES players(id) ON DELETE SET NULL,
      FOREIGN KEY (highest_bidder_team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS auction_players (
      id TEXT PRIMARY KEY,
      auction_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      lot_number INTEGER NOT NULL,
      status TEXT CHECK( status IN ('unsold', 'live', 'sold') ) DEFAULT 'unsold',
      sold_to_team_id TEXT,
      sold_price INTEGER DEFAULT 0,
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (sold_to_team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      auction_player_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      bid_amount INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auction_player_id) REFERENCES auction_players(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tournament_id TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Seed Data if DB is empty
  const tournamentCount = await database.get('SELECT COUNT(*) as count FROM tournaments');
  if (tournamentCount.count === 0) {
    console.log('Seeding initial database...');
    
    // Seed default Tournament
    const tId = 't-default';
    await database.run(
      'INSERT INTO tournaments (id, name, logo_url, status) VALUES (?, ?, ?, ?)',
      [tId, 'Premier Cricket League 2026', 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=200&auto=format&fit=crop&q=60', 'active']
    );

    // Seed settings
    await database.run(
      'INSERT INTO tournament_settings (tournament_id, registration_open, auction_open, default_bid_increment, default_timer_seconds, max_players_per_team, team_budget, registration_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tId, 1, 0, 1000, 30, 5, 1000000, 500]
    );

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const superadminPw = await bcrypt.hash('Password123', salt);
    const adminPw = await bcrypt.hash('Password123', salt);
    const ownerPw = await bcrypt.hash('Password123', salt);
    const playerPw = await bcrypt.hash('Password123', salt);

    // Seed Users
    await database.run(
      'INSERT INTO users (id, tournament_id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      ['u-sa', null, 'superadmin', 'superadmin@auction.com', superadminPw, 'superadmin']
    );
    await database.run(
      'INSERT INTO users (id, tournament_id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      ['u-admin1', tId, 'admin', 'admin@auction.com', adminPw, 'admin']
    );
    await database.run(
      'INSERT INTO users (id, tournament_id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      ['u-owner1', tId, 'owner1', 'owner1@auction.com', ownerPw, 'owner']
    );
    await database.run(
      'INSERT INTO users (id, tournament_id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      ['u-owner2', tId, 'owner2', 'owner2@auction.com', ownerPw, 'owner']
    );
    await database.run(
      'INSERT INTO users (id, tournament_id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      ['u-owner3', tId, 'owner3', 'owner3@auction.com', ownerPw, 'owner']
    );

    // Seed Teams
    await database.run(
      'INSERT INTO teams (id, tournament_id, name, logo_url, owner_id, budget, remaining_budget) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['t-team1', tId, 'Mumbai Mavericks', 'https://images.unsplash.com/photo-1540747737956-37872f76d9fd?w=200&auto=format&fit=crop&q=60', 'u-owner1', 1000000, 1000000]
    );
    await database.run(
      'INSERT INTO teams (id, tournament_id, name, logo_url, owner_id, budget, remaining_budget) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['t-team2', tId, 'Chennai Champions', 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&auto=format&fit=crop&q=60', 'u-owner2', 1000000, 1000000]
    );
    await database.run(
      'INSERT INTO teams (id, tournament_id, name, logo_url, owner_id, budget, remaining_budget) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['t-team3', tId, 'Bangalore Blasters', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&auto=format&fit=crop&q=60', 'u-owner3', 1000000, 1000000]
    );

    // Update users team_id
    await database.run('UPDATE users SET team_id = ? WHERE id = ?', ['t-team1', 'u-owner1']);
    await database.run('UPDATE users SET team_id = ? WHERE id = ?', ['t-team2', 'u-owner2']);
    await database.run('UPDATE users SET team_id = ? WHERE id = ?', ['t-team3', 'u-owner3']);

    // Seed Players
    const samplePlayers = [
      { id: 'PLY-001', name: 'Aarav Sharma', village: 'Ramnagar', role: 'Batsman', batting: 'Right-handed', bowling: 'Off-break', exp: '3 Years', score: 85, base: 20000, photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80' },
      { id: 'PLY-002', name: 'Kabir Verma', village: 'Sultanpur', role: 'Bowler', batting: 'Right-handed', bowling: 'Fast-medium', exp: '5 Years', score: 24, base: 30000, photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80' },
      { id: 'PLY-003', name: 'Vihaan Patel', village: 'Bilaspur', role: 'All-Rounder', batting: 'Right-handed', bowling: 'Leg-break', exp: '4 Years', score: 112, base: 40000, photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80' },
      { id: 'PLY-004', name: 'Rohan Gupta', village: 'Gopalganj', role: 'Wicket-Keeper', batting: 'Left-handed', bowling: 'None', exp: '2 Years', score: 67, base: 15000, photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80' },
      { id: 'PLY-005', name: 'Dhruv Singh', village: 'Ramnagar', role: 'Batsman', batting: 'Left-handed', bowling: 'None', exp: '6 Years', score: 145, base: 50000, photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80' },
      { id: 'PLY-006', name: 'Ishaan Yadav', village: 'Sultanpur', role: 'Bowler', batting: 'Right-handed', bowling: 'Fast-spinner', exp: '1 Year', score: 12, base: 10000, photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80' },
      { id: 'PLY-007', name: 'Arjun Mehra', village: 'Bilaspur', role: 'All-Rounder', batting: 'Right-handed', bowling: 'Fast', exp: '8 Years', score: 98, base: 60000, photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80' },
      { id: 'PLY-008', name: 'Rudransh Dixit', village: 'Gopalganj', role: 'Batsman', batting: 'Right-handed', bowling: 'Medium-fast', exp: '4 Years', score: 104, base: 25000, photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80' },
      { id: 'PLY-009', name: 'Sai Karthik', village: 'Ramnagar', role: 'Bowler', batting: 'Left-handed', bowling: 'Left-arm spin', exp: '2 Years', score: 8, base: 15000, photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80' },
      { id: 'PLY-010', name: 'Aditya Sen', village: 'Bilaspur', role: 'Wicket-Keeper', batting: 'Right-handed', bowling: 'None', exp: '3 Years', score: 76, base: 20000, photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80' }
    ];

    for (const p of samplePlayers) {
      await database.run(
        'INSERT INTO players (id, tournament_id, name, photo_url, village, role, batting_style, bowling_style, experience, highest_score, base_price, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, tId, p.name, p.photo, p.village, p.role, p.batting, p.bowling, p.exp, p.score, p.base, 'approved']
      );
    }

    // Seed default Auction
    const aId = 'a-default';
    await database.run(
      'INSERT INTO auctions (id, tournament_id, name, status, current_player_id, timer_remaining, timer_configured) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [aId, tId, 'Main Player Auction', 'upcoming', null, 30, 30]
    );

    // Link players to auction
    let lot = 1;
    for (const p of samplePlayers) {
      await database.run(
        'INSERT INTO auction_players (id, auction_id, player_id, lot_number, status, sold_to_team_id, sold_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [`ap-${p.id}`, aId, p.id, lot++, 'unsold', null, 0]
      );
    }

    // Seed announcements
    await database.run(
      'INSERT INTO announcements (id, tournament_id, content) VALUES (?, ?, ?)',
      ['an-1', tId, 'Welcome to the Premier Cricket League 2026 Live Auction! Auction starts soon.']
    );

    console.log('Seeding finished successfully.');
  }
}

module.exports = {
  getDb,
  initDb
};
