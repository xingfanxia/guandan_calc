// Capture FULLY populated state of the Broadcast theme for the Phase 1.5 audit.
// Seeds 6-player mode, generates players, shuffles teams, plays 3 rounds via
// state mutation to fill history, places ranking partially for live calc preview.
// Captures full page + per-section snapshots so each one can be diffed against
// docs/design/demos/demo-broadcast-v3.png.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import { setDeterministicPlayers, freezeTime } from './_fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_BASE = process.env.VISUAL_REPORT_BASE || path.join(ROOT, 'docs/reports');
const REPORT_DIR = path.join(REPORT_BASE, 'phase1-5-final');

await mkdir(REPORT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`CONSOLE: ${msg.text()}`);
});

page.on('dialog', async (d) => { await d.accept(); });

const URL = process.env.GD_PROD ? 'http://localhost:4173/' : 'http://localhost:3000/';

// Freeze Date.now BEFORE page load — see _fixtures.mjs.
await freezeTime(page);

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('#mode', { timeout: 5000 });

// 6-player mode (matches demo)
await page.selectOption('#mode', '6');
await page.waitForTimeout(150);

await page.click('#generatePlayers');
await page.waitForTimeout(400);

const shuffleBtn = await page.$('#shuffleTeams');
if (shuffleBtn) await shuffleBtn.click();
await page.waitForTimeout(300);

// Override emojis + team assignment to deterministic state.
await setDeterministicPlayers(page, 6);

// Disable auto-apply so random-ranking sticks
await page.evaluate(() => {
  const cb = document.getElementById('autoApply');
  if (cb && cb.checked) cb.click();
});
await page.waitForTimeout(150);

// Seed history with 8 completed rounds + a partial ranking for round 9.
// 8 rounds clears the >=5 games threshold for all honor categories.
// Mutates state singleton directly (works only on dev/3000 — bundled prod
// modules aren't reachable).
await page.evaluate(async () => {
  const stateMod = await import('/src/core/state.js');
  const teamMod = await import('/src/ui/teamDisplay.js');
  const histMod = await import('/src/game/history.js');
  const honorsMod = await import('/src/stats/honors.js');
  const playerMgrMod = await import('/src/player/playerManager.js');
  const playerRendMod = await import('/src/player/playerRenderer.js');
  const rendererMod = await import('/src/ranking/rankingRenderer.js');
  const state = stateMod.default;

  // 8 historical rounds — varied outcomes to trigger different honors
  const fakeHistory = [
    { ts: '12:01', mode: '6', win: '红', winKey: 't2', combo: '1, 2, 5', up: 2, t1: '2', t2: '4', round: '2', aNote: '', prevT1Lvl: '2', prevT2Lvl: '2', prevT1A: 0, prevT2A: 0, prevRound: '2', prevRoundOwner: null },
    { ts: '12:14', mode: '6', win: '蓝', winKey: 't1', combo: '1, 3, 4', up: 1, t1: '3', t2: '4', round: '4', aNote: '', prevT1Lvl: '2', prevT2Lvl: '4', prevT1A: 0, prevT2A: 0, prevRound: '4', prevRoundOwner: 't2' },
    { ts: '12:28', mode: '6', win: '红', winKey: 't2', combo: '1, 2, 4', up: 0, t1: '3', t2: '4', round: '3', aNote: 'must1 未达', prevT1Lvl: '3', prevT2Lvl: '4', prevT1A: 0, prevT2A: 0, prevRound: '3', prevRoundOwner: 't1' },
    { ts: '12:41', mode: '6', win: '红', winKey: 't2', combo: '1, 3, 5', up: 0, t1: '3', t2: '4', round: '3', aNote: '差距 < 阈值', prevT1Lvl: '3', prevT2Lvl: '4', prevT1A: 0, prevT2A: 0, prevRound: '3', prevRoundOwner: 't2' },
    { ts: '12:55', mode: '6', win: '红', winKey: 't2', combo: '1, 2, 3', up: 3, t1: '3', t2: '7', round: '4', aNote: '', prevT1Lvl: '3', prevT2Lvl: '4', prevT1A: 0, prevT2A: 0, prevRound: '4', prevRoundOwner: 't2' },
    { ts: '13:08', mode: '6', win: '蓝', winKey: 't1', combo: '1, 4, 5', up: 1, t1: '4', t2: '7', round: '7', aNote: '', prevT1Lvl: '3', prevT2Lvl: '7', prevT1A: 0, prevT2A: 0, prevRound: '7', prevRoundOwner: 't2' },
    { ts: '13:22', mode: '6', win: '红', winKey: 't2', combo: '1, 3, 6', up: 1, t1: '4', t2: '8', round: '7', aNote: '', prevT1Lvl: '4', prevT2Lvl: '7', prevT1A: 0, prevT2A: 0, prevRound: '7', prevRoundOwner: 't1' },
    { ts: '13:36', mode: '6', win: '蓝', winKey: 't1', combo: '1, 2, 5', up: 2, t1: '6', t2: '8', round: '8', aNote: '', prevT1Lvl: '4', prevT2Lvl: '8', prevT1A: 0, prevT2A: 0, prevRound: '8', prevRoundOwner: 't2' }
  ];
  state.setHistory(fakeHistory);
  state.setTeamLevel('t1', '6');
  state.setTeamLevel('t2', '8');
  state.setRoundLevel('8');
  state.setRoundOwner('t2');

  // Per-player rankings across 8 rounds (varied so honors trigger)
  // Index → ranking pattern. Maps to player[i % 6].
  const rankPatterns = [
    [1, 2, 1, 1, 2, 4, 1, 2], // player 0: many firsts (吕布)
    [4, 5, 6, 6, 6, 5, 6, 5], // player 1: many lasts (阿斗)
    [3, 3, 3, 3, 3, 3, 3, 3], // player 2: stable middle (石佛)
    [2, 4, 1, 5, 2, 1, 4, 6], // player 3: volatile (波动王)
    [5, 6, 4, 4, 5, 2, 2, 1], // player 4: improving (奋斗王)
    [6, 1, 5, 2, 4, 6, 5, 4]  // player 5: chaotic (闪电侠)
  ];

  const players = playerMgrMod.getPlayers();
  const allStats = {};
  players.forEach((p, i) => {
    const rankings = rankPatterns[i % rankPatterns.length];
    allStats[p.id] = {
      games: rankings.length,
      rounds: rankings.length,
      rankings,
      totalRank: rankings.reduce((s, r) => s + r, 0),
      firstPlaceCount: rankings.filter(r => r === 1).length,
      lastPlaceCount: rankings.filter(r => r === 6).length,
      teamWins: 4,
      gamesAsTeam1: 4,
      gamesAsTeam2: 4
    };
  });
  state.setPlayerStats(allStats);

  // Place 3 of 6 ranks for the in-progress round 9
  const team1 = players.filter(p => p.team === 1);
  const team2 = players.filter(p => p.team === 2);
  const partial = {};
  if (team2[0]) partial[1] = team2[0].id; // 红 头游
  if (team1[0]) partial[2] = team1[0].id; // 蓝 二游
  if (team2[1]) partial[5] = team2[1].id; // 红 五游
  state.setCurrentRanking(partial);

  // Force re-render
  teamMod.renderTeams();
  histMod.renderHistory();
  honorsMod.renderHonors();
  playerRendMod.renderPlayers();
  rendererMod.renderRankingArea(6);

  // Trigger calcPreview re-render via mode-change event
  const evtMod = await import('/src/core/events.js');
  evtMod.emit('ui:modeChanged');
});

await page.waitForTimeout(800);

// Captures
await page.screenshot({
  path: path.join(REPORT_DIR, 'index-final.png'),
  fullPage: true
});

const sections = [
  { sel: '.ticker', name: 'ticker' },
  { sel: '.scorer', name: 'scoreboard' },
  { sel: '.activegame', name: 'activegame' },
  { sel: '.calcpreview', name: 'calcpreview' },
  { sel: '.controls', name: 'controls' },
  { sel: '.rules-drawer', name: 'rules-drawer' },
  { sel: '.history', name: 'history' },
  { sel: '.honors', name: 'honors' },
  // .profile selector removed — no longer present in DOM (the bottom-of-page
  // personal data card was retired). Old baseline `profile-snippet.png` files
  // were also deleted.
];

for (const s of sections) {
  const el = await page.$(s.sel);
  if (el) {
    await el.screenshot({ path: path.join(REPORT_DIR, `${s.name}.png`) });
  } else {
    console.log(`  (missing) ${s.sel}`);
  }
}

console.log('SAVED:', REPORT_DIR);
if (consoleErrors.length) {
  console.log('CONSOLE ISSUES:');
  for (const e of consoleErrors) console.log(' ', e);
}

await browser.close();
