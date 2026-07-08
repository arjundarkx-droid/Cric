const PDFDocument = require('pdfkit');
const qrCode = require('qrcode');

// Generate CSV for Players
function generatePlayersCSV(players) {
  const headers = ['Player ID', 'Name', 'Village', 'Role', 'Batting Style', 'Bowling Style', 'Experience', 'Highest Score', 'Base Price', 'Status'];
  const rows = players.map(p => [
    p.id,
    p.name,
    p.village,
    p.role,
    p.batting_style,
    p.bowling_style,
    p.experience,
    p.highest_score,
    p.base_price,
    p.status
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

// Generate PDF for Auction Results
async function generateAuctionResultsPDF(res, tournamentName, results) {
  const doc = new PDFDocument({ margin: 50 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=auction_results_${Date.now()}.pdf`);
  doc.pipe(res);

  // Title
  doc.fillColor('#1e1b4b').fontSize(22).text('LIVE AUCTION RESULTS', { align: 'center' });
  doc.fontSize(14).fillColor('#475569').text(tournamentName, { align: 'center' });
  doc.moveDown(2);

  // Table Headers
  const tableTop = 150;
  doc.fontSize(10).fillColor('#1e293b');
  doc.text('Lot #', 50, tableTop);
  doc.text('Player ID', 100, tableTop);
  doc.text('Player Name', 180, tableTop);
  doc.text('Role', 300, tableTop);
  doc.text('Sold To Team', 380, tableTop);
  doc.text('Price (INR)', 480, tableTop);

  // Underline headers
  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#cbd5e1').stroke();

  // Rows
  let y = tableTop + 25;
  results.forEach((row, i) => {
    // Page break handling if content exceeds height
    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    doc.fillColor('#334155');
    doc.text(String(row.lot_number), 50, y);
    doc.text(String(row.player_id), 100, y);
    doc.text(String(row.player_name), 180, y);
    doc.text(String(row.player_role), 300, y);
    doc.text(String(row.team_name || 'UNSOLD'), 380, y);
    doc.text(row.status === 'sold' ? `INR ${row.sold_price.toLocaleString()}` : '-', 480, y);

    y += 20;
  });

  doc.end();
}

// Generate PDF for Teams summary
async function generateTeamsPDF(res, tournamentName, teamsData) {
  const doc = new PDFDocument({ margin: 50 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=teams_summary_${Date.now()}.pdf`);
  doc.pipe(res);

  doc.fillColor('#1e1b4b').fontSize(22).text('TEAMS SUMMARY REPORT', { align: 'center' });
  doc.fontSize(14).fillColor('#475569').text(tournamentName, { align: 'center' });
  doc.moveDown(2);

  let y = 150;
  for (const team of teamsData) {
    if (y > 650) {
      doc.addPage();
      y = 50;
    }

    // Team Header Card
    doc.rect(50, y, 500, 45).fill('#f1f5f9');
    doc.fillColor('#1e1b4b').fontSize(12).text(team.name, 60, y + 10, { bold: true });
    doc.fontSize(9).fillColor('#475569').text(`Owner: ${team.owner_name} | Total Budget: INR ${team.budget.toLocaleString()} | Remaining Budget: INR ${team.remaining_budget.toLocaleString()}`, 60, y + 25);
    
    y += 55;

    // Sub-table for Team's players
    doc.fontSize(9).fillColor('#0f172a');
    doc.text('ID', 70, y);
    doc.text('Player Name', 120, y);
    doc.text('Role', 250, y);
    doc.text('Village', 350, y);
    doc.text('Purchase Price', 450, y);

    doc.moveTo(70, y + 12).lineTo(530, y + 12).strokeColor('#cbd5e1').stroke();
    y += 18;

    if (team.players.length === 0) {
      doc.fillColor('#94a3b8').text('No players purchased yet', 70, y);
      y += 20;
    } else {
      team.players.forEach(p => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        doc.fillColor('#334155');
        doc.text(p.id, 70, y);
        doc.text(p.name, 120, y);
        doc.text(p.role, 250, y);
        doc.text(p.village, 350, y);
        doc.text(`INR ${p.sold_price.toLocaleString()}`, 450, y);
        y += 15;
      });
    }

    y += 20; // spacing between teams
  }

  doc.end();
}

// Generate Printable Player Registration Slip
async function generatePlayerSlipPDF(res, player, tournamentName) {
  const doc = new PDFDocument({ size: [400, 600], margin: 30 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=registration_slip_${player.id}.pdf`);
  doc.pipe(res);

  // Border
  doc.rect(10, 10, 380, 580).strokeColor('#f59e0b').lineWidth(2).stroke();

  // Header banner
  doc.rect(11, 11, 378, 80).fill('#1e1b4b');
  doc.fillColor('#ffffff').fontSize(16).text(tournamentName.toUpperCase(), 30, 30, { align: 'center', bold: true });
  doc.fontSize(10).fillColor('#f59e0b').text('PLAYER REGISTRATION SLIP', { align: 'center' });

  // QR Code Generation
  const profileUrl = `http://localhost:5173/player/${player.id}`;
  const qrBuffer = await qrCode.toBuffer(profileUrl, { margin: 1 });

  // Player Details Layout
  const top = 110;
  doc.fillColor('#1e293b').fontSize(12).text('PLAYER DETAILS', 30, top, { underline: true });
  
  let y = top + 25;
  const drawRow = (label, val) => {
    doc.fillColor('#475569').fontSize(10).text(label, 30, y);
    doc.fillColor('#0f172a').fontSize(10).text(val, 160, y, { bold: true });
    y += 22;
  };

  drawRow('Player ID:', player.id);
  drawRow('Name:', player.name);
  drawRow('Village:', player.village);
  drawRow('Role:', player.role);
  drawRow('Batting Style:', player.batting_style);
  drawRow('Bowling Style:', player.bowling_style);
  drawRow('Experience:', player.experience);
  drawRow('Highest Score:', String(player.highest_score));
  drawRow('Base Price:', `INR ${player.base_price.toLocaleString()}`);

  // Place QR Code in the slip
  const qrTop = y + 10;
  doc.image(qrBuffer, 150, qrTop, { width: 100, height: 100 });
  doc.fillColor('#64748b').fontSize(8).text('Scan QR Code to view Player Profile online', 30, qrTop + 115, { align: 'center' });

  // Footer note
  doc.fillColor('#94a3b8').fontSize(7).text('Generated automatically on registration approval. Bring this slip to the draft.', 30, 560, { align: 'center' });

  doc.end();
}

module.exports = {
  generatePlayersCSV,
  generateAuctionResultsPDF,
  generateTeamsPDF,
  generatePlayerSlipPDF
};
