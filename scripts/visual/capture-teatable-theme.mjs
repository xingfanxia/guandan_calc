// Capture Tea-Table theme — same populated fixture as Broadcast/Linear/
// Trading/Atelier, but boots into data-theme="teatable" before screenshotting.
//
// Outputs full-page + per-section captures to docs/reports/phase5-teatable/.
// Tea-Table's distinguishing surface is the honors gallery — real ink-brush
// portrait JPGs from public/themes/teatable/honors/ are injected by
// renderHonors() when the active manifest's honorPortraits === 'photo'.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import { setDeterministicPlayers, freezeTime } from './_fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_BASE = process.env.VISUAL_REPORT_BASE || path.join(ROOT, 'docs/reports');
const REPORT_DIR = path.join(REPORT_BASE, 'phase5-teatable');

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

await freezeTime(page);

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { localStorage.setItem('gd_v9_theme', 'teatable'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#mode', { timeout: 5000 });

await page.selectOption('#mode', '6');
await page.waitForTimeout(200);

await page.click('#generatePlayers');
await page.waitForTimeout(400);

const shuffleBtn = await page.$('#shuffleTeams');
if (shuffleBtn) await shuffleBtn.click();
await page.waitForTimeout(300);

await setDeterministicPlayers(page, 6);

await page.evaluate(() => {
  const cb = document.getElementById('autoApply');
  if (cb && cb.checked) cb.click();
});
await page.waitForTimeout(150);

// Same fixture used for Broadcast / Linear / Trading / Atelier so per-theme
// captures stay diff-comparable against the same content.
await page.evaluate(async () => {
  const stateMod = await import('/src/core/state.js');
  const teamMod = await import('/src/ui/teamDisplay.js');
  const histMod = await import('/src/game/history.js');
  const statsMod = await import('/src/stats/statistics.js');
  const playerMgrMod = await import('/src/player/playerManager.js');
  const playerRendMod = await import('/src/player/playerRenderer.js');
  const rendererMod = await import('/src/ranking/rankingRenderer.js');
  const state = stateMod.default;

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

  const rankPatterns = [
    [1, 2, 1, 1, 2, 4, 1, 2],
    [4, 5, 6, 6, 6, 5, 6, 5],
    [3, 3, 3, 3, 3, 3, 3, 3],
    [2, 4, 1, 5, 2, 1, 4, 6],
    [5, 6, 4, 4, 5, 2, 2, 1],
    [6, 1, 5, 2, 4, 6, 5, 4]
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

  const team1 = players.filter(p => p.team === 1);
  const team2 = players.filter(p => p.team === 2);
  const partial = {};
  if (team2[0]) partial[1] = team2[0].id;
  if (team1[0]) partial[2] = team1[0].id;
  if (team2[1]) partial[5] = team2[1].id;
  state.setCurrentRanking(partial);

  teamMod.renderTeams();
  histMod.renderHistory();
  statsMod.renderStatistics();
  playerRendMod.renderPlayers();
  rendererMod.renderRankingArea(6);

  const evtMod = await import('/src/core/events.js');
  evtMod.emit('ui:modeChanged');
});

// Wait for honor portraits to load (real <img> assets unique to this theme)
await page.waitForTimeout(1500);

const dataTheme = await page.getAttribute('html', 'data-theme');
console.log('data-theme:', dataTheme);

await page.screenshot({
  path: path.join(REPORT_DIR, 'index-teatable.png'),
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
];

for (const s of sections) {
  const el = await page.$(s.sel);
  if (el) await el.screenshot({ path: path.join(REPORT_DIR, `${s.name}.png`) });
}

// Mobile viewport pass
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({
  path: path.join(REPORT_DIR, 'index-teatable-mobile.png'),
  fullPage: true
});
{
  const scorer = await page.$('.scorer');
  if (scorer) await scorer.screenshot({ path: path.join(REPORT_DIR, 'scoreboard-mobile.png') });
  const ag = await page.$('.activegame');
  if (ag) await ag.screenshot({ path: path.join(REPORT_DIR, 'activegame-mobile.png') });
  const honors = await page.$('.honors');
  if (honors) await honors.screenshot({ path: path.join(REPORT_DIR, 'honors-mobile.png') });
  const calc = await page.$('.calcpreview');
  if (calc) await calc.screenshot({ path: path.join(REPORT_DIR, 'calcpreview-mobile.png') });
}

// Desktop victory modal capture
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(200);

await page.evaluate(async () => {
  const modal = await import('/src/ui/victoryModal.js');
  await modal.showVictoryModal('红队');
});
await page.waitForTimeout(700);

const victoryEl = await page.$('#victoryModal');
if (victoryEl) {
  await victoryEl.screenshot({
    path: path.join(REPORT_DIR, 'victory-modal.png'),
    omitBackground: false,
  });
}

// Mobile victory modal
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
const victoryMobileEl = await page.$('#victoryModal');
if (victoryMobileEl) {
  await victoryMobileEl.screenshot({
    path: path.join(REPORT_DIR, 'victory-modal-mobile.png'),
  });
}

if (consoleErrors.length) {
  console.log('CONSOLE/PAGE ERRORS:', consoleErrors);
}
console.log('SAVED:', REPORT_DIR);
await browser.close();
