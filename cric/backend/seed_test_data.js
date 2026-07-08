const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.db');
const tournamentId = 't-1783440836462';

async function seed() {
  console.log('Connecting to database...');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Verify tournament exists
  const tournament = await db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
  if (!tournament) {
    console.error(`Tournament with ID ${tournamentId} not found!`);
    process.exit(1);
  }
  console.log(`Found tournament: ${tournament.name}`);

  await db.run('BEGIN TRANSACTION;');

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123', salt);

    // 1. Seed Teams
    const teamData = [
      { key: 'rcb', name: 'Royal Challengers Bengaluru', logo: 'https://images.unsplash.com/photo-1540747737956-37872f76d9fd?w=200&auto=format&fit=crop&q=60' },
      { key: 'dc', name: 'Delhi Capitals', logo: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&auto=format&fit=crop&q=60' },
      { key: 'kkr', name: 'Kolkata Knight Riders', logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&auto=format&fit=crop&q=60' },
      { key: 'rr', name: 'Rajasthan Royals', logo: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a27?w=200&auto=format&fit=crop&q=60' },
      { key: 'gt', name: 'Gujarat Titans', logo: 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=200&auto=format&fit=crop&q=60' },
      { key: 'lsg', name: 'Lucknow Super Giants', logo: 'https://images.unsplash.com/photo-1579952362973-27a3c14a4a97?w=200&auto=format&fit=crop&q=60' },
      { key: 'pbks', name: 'Punjab Kings', logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&auto=format&fit=crop&q=60' },
      { key: 'srh', name: 'Sunrisers Hyderabad', logo: 'https://images.unsplash.com/photo-1540747737956-37872f76d9fd?w=200&auto=format&fit=crop&q=60' },
      { key: 'bw', name: 'Bithuja Warriors', logo: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&auto=format&fit=crop&q=60' },
      { key: 'vv', name: 'Village Vikings', logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&auto=format&fit=crop&q=60' }
    ];

    console.log('Seeding teams and owners...');
    for (const team of teamData) {
      // Check if team already exists to prevent duplicate username issues
      const existingTeam = await db.get('SELECT id FROM teams WHERE tournament_id = ? AND name = ?', [tournamentId, team.name]);
      if (existingTeam) {
        console.log(`Team ${team.name} already exists. Skipping team creation.`);
        continue;
      }

      const userId = `u-owner-${team.key}-${Date.now().toString(36)}`;
      const teamId = `t-team-${team.key}-${Date.now().toString(36)}`;
      const username = `owner_${team.key}`;
      const email = `owner_${team.key}@bithuja.com`;

      // Insert User (Owner)
      await db.run(
        'INSERT INTO users (id, tournament_id, username, email, password_hash, role, team_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, tournamentId, username, email, passwordHash, 'owner', teamId]
      );

      // Insert Team
      await db.run(
        'INSERT INTO teams (id, tournament_id, name, logo_url, owner_id, budget, remaining_budget) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [teamId, tournamentId, team.name, team.logo, userId, 1000000, 1000000]
      );

      console.log(`Created team ${team.name} with owner ${username}`);
    }

    // 2. Seed Players
    console.log('Seeding players...');
    const playerTemplates = [
      { name: 'Virat Kohly', role: 'Batsman', batting: 'Right-handed', bowling: 'Right-arm medium', exp: '10 Years', score: 183, base: 100000 },
      { name: 'Rohit Sharmaa', role: 'Batsman', batting: 'Right-handed', bowling: 'Right-arm off-break', exp: '12 Years', score: 264, base: 100000 },
      { name: 'MS Dhonii', role: 'Wicket-Keeper', batting: 'Right-handed', bowling: 'Right-arm medium', exp: '15 Years', score: 183, base: 100000 },
      { name: 'Jasprit Bumrahh', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm fast', exp: '8 Years', score: 34, base: 80000 },
      { name: 'Hardik Pandyaa', role: 'All-Rounder', batting: 'Right-handed', bowling: 'Right-arm fast-medium', exp: '7 Years', score: 92, base: 80000 },
      { name: 'Rishabh Pantt', role: 'Wicket-Keeper', batting: 'Left-handed', bowling: 'None', exp: '5 Years', score: 159, base: 60000 },
      { name: 'KL Rahull', role: 'Wicket-Keeper', batting: 'Right-handed', bowling: 'None', exp: '8 Years', score: 132, base: 60000 },
      { name: 'Suryakumar Yadavv', role: 'Batsman', batting: 'Right-handed', bowling: 'Right-arm spin', exp: '6 Years', score: 117, base: 70000 },
      { name: 'Ravindra Jadejaa', role: 'All-Rounder', batting: 'Left-handed', bowling: 'Left-arm orthodox', exp: '11 Years', score: 104, base: 80000 },
      { name: 'Yuzvendra Chahall', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm leg-break', exp: '8 Years', score: 10, base: 50000 },
      { name: 'Shubman Gilll', role: 'Batsman', batting: 'Right-handed', bowling: 'None', exp: '4 Years', score: 208, base: 60000 },
      { name: 'Shreyas Iyerr', role: 'Batsman', batting: 'Right-handed', bowling: 'Right-arm leg-break', exp: '6 Years', score: 113, base: 50000 },
      { name: 'Ishan Kishann', role: 'Wicket-Keeper', batting: 'Left-handed', bowling: 'None', exp: '4 Years', score: 210, base: 50000 },
      { name: 'Mohammed Shami', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm fast-medium', exp: '9 Years', score: 25, base: 70000 },
      { name: 'Mohammed Sirajj', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm fast', exp: '5 Years', score: 15, base: 60000 },
      { name: 'Axar Patell', role: 'All-Rounder', batting: 'Left-handed', bowling: 'Left-arm spin', exp: '7 Years', score: 64, base: 60000 },
      { name: 'Shardul Thakurr', role: 'All-Rounder', batting: 'Right-handed', bowling: 'Right-arm medium-fast', exp: '6 Years', score: 67, base: 40000 },
      { name: 'Kuldeep Yadavv', role: 'Bowler', batting: 'Left-handed', bowling: 'Left-arm chinaman', exp: '7 Years', score: 19, base: 50000 },
      { name: 'Deepak Chaharr', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm medium-fast', exp: '6 Years', score: 69, base: 40000 },
      { name: 'Arshdeep Singhh', role: 'Bowler', batting: 'Left-handed', bowling: 'Left-arm fast-medium', exp: '3 Years', score: 9, base: 50000 },
      { name: 'Sanju Samsonn', role: 'Wicket-Keeper', batting: 'Right-handed', bowling: 'None', exp: '8 Years', score: 119, base: 50000 },
      { name: 'Ruturaj Gaikwadd', role: 'Batsman', batting: 'Right-handed', bowling: 'None', exp: '4 Years', score: 101, base: 50000 },
      { name: 'Yashasvi Jaiswall', role: 'Batsman', batting: 'Left-handed', bowling: 'Right-arm leg-break', exp: '2 Years', score: 124, base: 50000 },
      { name: 'Rinku Singhh', role: 'Batsman', batting: 'Left-handed', bowling: 'Right-arm off-break', exp: '3 Years', score: 67, base: 40000 },
      { name: 'Tilak Varmaa', role: 'Batsman', batting: 'Left-handed', bowling: 'Right-arm off-break', exp: '2 Years', score: 51, base: 30000 },
      { name: 'Washington Sundarr', role: 'All-Rounder', batting: 'Left-handed', bowling: 'Right-arm off-break', exp: '5 Years', score: 62, base: 40000 },
      { name: 'Ravi Bishnoii', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm leg-spin', exp: '3 Years', score: 8, base: 40000 },
      { name: 'Prasidh Krishnar', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm fast', exp: '3 Years', score: 5, base: 30000 },
      { name: 'Avesh Khan', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm fast-medium', exp: '4 Years', score: 12, base: 30000 },
      { name: 'Mukesh Kumarr', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm medium-fast', exp: '2 Years', score: 4, base: 20000 },
      { name: 'Jitesh Sharmaa', role: 'Wicket-Keeper', batting: 'Right-handed', bowling: 'None', exp: '2 Years', score: 49, base: 20000 },
      { name: 'Shivam Dubee', role: 'All-Rounder', batting: 'Left-handed', bowling: 'Right-arm medium-fast', exp: '4 Years', score: 95, base: 40000 },
      { name: 'Riyan Paragg', role: 'All-Rounder', batting: 'Right-handed', bowling: 'Right-arm leg-break', exp: '4 Years', score: 84, base: 30000 },
      { name: 'Mayank Yadavv', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm superfast', exp: '1 Year', score: 2, base: 30000 },
      { name: 'Abhishek Sharmaa', role: 'All-Rounder', batting: 'Left-handed', bowling: 'Left-arm orthodox', exp: '3 Years', score: 100, base: 40000 },
      { name: 'Nitish Reddyd', role: 'All-Rounder', batting: 'Right-handed', bowling: 'Right-arm medium', exp: '1 Year', score: 76, base: 20000 },
      { name: 'Harshit Ranar', role: 'Bowler', batting: 'Right-handed', bowling: 'Right-arm fast', exp: '2 Years', score: 15, base: 20000 },
      { name: 'Ramandeep Singhh', role: 'All-Rounder', batting: 'Right-handed', bowling: 'Right-arm medium', exp: '2 Years', score: 45, base: 20000 },
      { name: 'Vijay Shankarr', role: 'All-Rounder', batting: 'Right-handed', bowling: 'Right-arm medium', exp: '6 Years', score: 63, base: 20000 },
      { name: 'Krunal Pandyaa', role: 'All-Rounder', batting: 'Left-handed', bowling: 'Left-arm orthodox', exp: '7 Years', score: 86, base: 40000 }
    ];

    const villages = ['Bithuja Center', 'Bithuja East', 'Bithuja West', 'Bithuja North', 'Bithuja South', 'Ramdev Colony', 'Khed Road', 'Balotra Gate'];
    const photoUrls = [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'
    ];

    // Find current players count to generate consecutive player IDs
    const countRes = await db.get('SELECT COUNT(*) as count FROM players');
    let playerIndex = countRes.count + 1;

    const insertedPlayerIds = [];

    for (const p of playerTemplates) {
      // Check if player name already exists
      const existingPlayer = await db.get('SELECT id FROM players WHERE tournament_id = ? AND name = ?', [tournamentId, p.name]);
      if (existingPlayer) {
        console.log(`Player ${p.name} already exists. Skipping.`);
        insertedPlayerIds.push(existingPlayer.id);
        continue;
      }

      const playerId = `PLY-${String(playerIndex++).padStart(3, '0')}`;
      const village = villages[Math.floor(Math.random() * villages.length)];
      const photo = photoUrls[Math.floor(Math.random() * photoUrls.length)];

      await db.run(
        `INSERT INTO players (id, tournament_id, name, photo_url, village, role, batting_style, bowling_style, experience, highest_score, base_price, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [playerId, tournamentId, p.name, photo, village, p.role, p.batting, p.bowling, p.exp, p.score, p.base, 'approved']
      );

      insertedPlayerIds.push(playerId);
    }
    console.log(`Successfully seeded ${playerTemplates.length} players.`);

    // 3. Create or Update Auction
    console.log('Checking active auction for Bithuja...');
    let auction = await db.get('SELECT * FROM auctions WHERE tournament_id = ? AND status != "completed" LIMIT 1', [tournamentId]);
    let auctionId;
    if (!auction) {
      auctionId = `a-bithuja-${Date.now()}`;
      await db.run(
        'INSERT INTO auctions (id, tournament_id, name, status, current_player_id, timer_remaining, timer_configured) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [auctionId, tournamentId, 'Bithuja Championship Auction 2026', 'upcoming', null, 30, 30]
      );
      console.log('Created new Bithuja Live Auction.');
    } else {
      auctionId = auction.id;
      console.log(`Using existing Bithuja Live Auction: ${auction.name}`);
    }

    // 4. Link Players to Auction in auction_players
    console.log('Linking players to auction lots...');
    const existingLotsCount = await db.get('SELECT COUNT(*) as count FROM auction_players WHERE auction_id = ?', [auctionId]);
    let lotNumber = existingLotsCount.count + 1;

    for (const pid of insertedPlayerIds) {
      // Check if already in auction_players
      const apExists = await db.get('SELECT id FROM auction_players WHERE auction_id = ? AND player_id = ?', [auctionId, pid]);
      if (!apExists) {
        await db.run(
          'INSERT INTO auction_players (id, auction_id, player_id, lot_number, status, sold_to_team_id, sold_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [`ap-${pid}`, auctionId, pid, lotNumber++, 'unsold', null, 0]
        );
      }
    }

    // Also verify any existing approved players not in auction get added
    const approvedPlayers = await db.all('SELECT id FROM players WHERE tournament_id = ? AND status = "approved"', [tournamentId]);
    for (const ap of approvedPlayers) {
      const apExists = await db.get('SELECT id FROM auction_players WHERE auction_id = ? AND player_id = ?', [auctionId, ap.id]);
      if (!apExists) {
        await db.run(
          'INSERT INTO auction_players (id, auction_id, player_id, lot_number, status, sold_to_team_id, sold_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [`ap-${ap.id}`, auctionId, ap.id, lotNumber++, 'unsold', null, 0]
        );
      }
    }

    console.log('Updating tournament settings to make sure auction is open...');
    await db.run(
      'UPDATE tournament_settings SET auction_open = 1 WHERE tournament_id = ?',
      [tournamentId]
    );

    // Commit transaction
    await db.run('COMMIT;');
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding data, rolling back...', error);
    await db.run('ROLLBACK;');
    process.exit(1);
  }
}

seed();
