// Visual baselines for the 2026-06-12 wxapp-style redesign (root DESIGN.md).
//
// Captures every page in both modes at mobile (390px) + desktop (1280px):
//   index    — setup state, ranking-in-progress, played session (history/
//              stats/honors populated), victory modal
//   players  — populated grid (API mocked)
//   rooms    — populated grid (API mocked)
//   profile  — full profile (API mocked; Chart.js waits for animation)
//
// Writes PNGs to docs/reports/redesign/ (or $VISUAL_REPORT_BASE/redesign/).
// Deterministic: freezeTime + setDeterministicPlayers + fixed history /
// stats / ranking fixtures + route-mocked APIs. No Math.random paths.
//
// NOTE on cross-OS pixel comparison: the design system uses the system font
// stack, so PNGs rendered on macOS and Linux are NOT pixel-comparable.
// Committed baselines are a LOCAL gate (npm run test:visual); CI runs this
// script as a structural smoke (full set produced, zero page errors).

import { chromium } from 'playwright';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { setDeterministicPlayers, freezeTime } from './_fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_BASE = process.env.VISUAL_REPORT_BASE || path.join(ROOT, 'docs/reports');
const REPORT_DIR = path.join(REPORT_BASE, 'redesign');
mkdirSync(REPORT_DIR, { recursive: true });

const BASE_URL = process.env.GD_BASE_URL || 'http://localhost:3000';

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 900 },
};

// ---------- API mocks (players / rooms / profile) ----------

const MOCK_PLAYERS = [
  { handle: 'fufu', displayName: '芙芙', emoji: '🐸', tagline: '稳坐头游，从不翻车', stats: { sessionsPlayed: 42, sessionsWon: 28, sessionWinRate: 0.667, avgRankingPerSession: 3.21 } },
  { handle: 'yichao', displayName: '超', emoji: '🐢', tagline: '', stats: { sessionsPlayed: 38, sessionsWon: 15, sessionWinRate: 0.395, avgRankingPerSession: 4.55 } },
  { handle: 'axax', displayName: '帆', emoji: '🐱', tagline: '夜场常驻', stats: { sessionsPlayed: 51, sessionsWon: 30, sessionWinRate: 0.588, avgRankingPerSession: 3.8 } },
  { handle: 'olivia', displayName: '姐', emoji: '😺', tagline: '', stats: { sessionsPlayed: 12, sessionsWon: 4, sessionWinRate: 0.333, avgRankingPerSession: 4.9 } },
];

const MOCK_PROFILE = {
  handle: 'fufu', displayName: '芙芙', emoji: '🐸', tagline: '稳坐头游，从不翻车', playStyle: 'steady',
  createdAt: '2025-12-01T00:00:00Z', lastActiveAt: '2026-06-01T00:00:00Z',
  achievements: ['first_win', 'streak_3'],
  recentGames: [
    { date: '2026-06-01T10:00:00Z', mode: '8P', ranking: '2.13', rounds: 12, duration: 4500, teamWon: true, roomCode: 'A1B2C3', honorsEarned: ['吕布', '石佛'] },
    { date: '2026-05-31T10:00:00Z', mode: '8P', ranking: '4.50', rounds: 9, duration: 3600, teamWon: false, roomCode: 'LOCAL', honorsEarned: [] },
  ],
  stats: {
    sessionsPlayed: 42, sessionsWon: 28, sessionWinRate: 0.667,
    avgRankingPerSession: 3.21, avgRoundsPerSession: 12, longestSessionRounds: 21,
    roundsPlayed: 504, avgRankingPerRound: 3.4,
    totalPlayTimeSeconds: 86400, longestSessionSeconds: 7200, avgSessionSeconds: 3600,
    currentWinStreak: 3, longestWinStreak: 7,
    mvpVotes: 12, burdenVotes: 2,
    recentRankings: [1, 2, 1, 3, 4, 1, 2],
    honors: { '吕布': 5, '石佛': 3, '大满贯': 1 },
    partners: { yichao: { games: 20, wins: 14, winRate: 0.7 }, axax: { games: 12, wins: 5, winRate: 0.42 } },
    opponents: { olivia: { games: 18, wins: 11, winRate: 0.61 }, znf: { games: 9, wins: 3, winRate: 0.33 } },
  },
};

const MOCK_ROOMS = [
  { roomCode: 'A1B2C3', isFinished: false, isFavorite: true, lastUpdated: '2026-06-01T12:00:00Z', teamNames: ['蓝队', '红队'], playerHandles: ['fufu', 'yichao', 'axax', 'znf'], playerCount: 8, currentRound: 5 },
  { roomCode: 'D4E5F6', isFinished: false, isFavorite: false, lastUpdated: '2026-06-01T11:00:00Z', teamNames: ['蓝队', '红队'], playerHandles: ['olivia', 'xiaoxiao'], playerCount: 4, currentRound: 2 },
  { roomCode: 'G7H8J9', isFinished: true, winnerName: '红队', isFavorite: false, lastUpdated: '2026-05-31T12:00:00Z', teamNames: ['蓝队', '红队'], playerHandles: ['fzy', 'jiaqicao', 'xufeng'], playerCount: 6, currentRound: 9 },
];

async function mockApis(context) {
  await context.route('**/api/players/list**', (route) =>
    route.fulfill({ json: { success: true, players: MOCK_PLAYERS, total: MOCK_PLAYERS.length } }));
  await context.route('**/api/players/fufu**', (route) =>
    route.fulfill({ json: { success: true, player: MOCK_PROFILE } }));
  await context.route('**/api/rooms/list**', (route) =>
    route.fulfill({ json: { success: true, rooms: MOCK_ROOMS, pagination: { total: MOCK_ROOMS.length, hasNext: false } } }));
}

// ---------- index-page fixtures ----------

/** Deterministic 6-round 8-player session (history + stats), then re-render. */
async function seedPlayedSession(page) {
  await page.evaluate(async () => {
    const state = (await import('/src/core/state.js')).default;
    const histMod = await import('/src/game/history.js');
    const teamMod = await import('/src/ui/teamDisplay.js');
    const statsMod = await import('/src/stats/statistics.js');
    const playerMgr = await import('/src/player/playerManager.js');

    const players = playerMgr.getPlayers();
    // Fixed per-round rankings (player.id by rank position, 8 players)
    const ROUNDS = [
      { ranks: [5, 1, 6, 2, 7, 3, 8, 4], win: '红队', winKey: 't2', up: 2, t1: '2', t2: '4', round: '2' },
      { ranks: [1, 5, 2, 6, 3, 7, 4, 8], win: '蓝队', winKey: 't1', up: 1, t1: '3', t2: '4', round: '4' },
      { ranks: [2, 6, 1, 5, 4, 8, 3, 7], win: '蓝队', winKey: 't1', up: 3, t1: '6', t2: '4', round: '3' },
      { ranks: [6, 2, 5, 1, 8, 4, 7, 3], win: '红队', winKey: 't2', up: 2, t1: '6', t2: '6', round: '6' },
      { ranks: [1, 2, 5, 6, 3, 4, 7, 8], win: '蓝队', winKey: 't1', up: 3, t1: '9', t2: '6', round: '6' },
      { ranks: [3, 7, 4, 8, 1, 5, 2, 6], win: '蓝队', winKey: 't1', up: 1, t1: '10', t2: '6', round: '9' },
    ];

    const history = ROUNDS.map((r, i) => {
      const playerRankings = {};
      r.ranks.forEach((pid, idx) => {
        const p = players.find(x => x.id === pid);
        playerRankings[idx + 1] = p ? { id: p.id, name: p.name, emoji: p.emoji, team: p.team } : null;
      });
      return {
        ts: `12:${String(i * 9 + 1).padStart(2, '0')}`,
        mode: '8', win: r.win, winKey: r.winKey,
        combo: '', up: r.up, t1: r.t1, t2: r.t2, round: r.round, aNote: '',
        playerRankings,
        prevT1Lvl: '2', prevT2Lvl: '2', prevT1A: 0, prevT2A: 0, prevRound: '2', prevRoundOwner: null,
      };
    });
    state.setHistory(history);
    state.setTeamLevel('t1', '10');
    state.setTeamLevel('t2', '6');
    state.setRoundLevel('9');
    state.setRoundOwner('t1');

    // Per-player stats derived from the fixed rankings
    const stats = {};
    players.forEach(p => { stats[p.id] = { games: 0, rounds: 0, rankings: [], totalRank: 0, firstPlaceCount: 0, lastPlaceCount: 0, teamWins: 0 }; });
    ROUNDS.forEach(r => {
      r.ranks.forEach((pid, idx) => {
        const s = stats[pid];
        const rank = idx + 1;
        s.games += 1; s.rounds += 1;
        s.rankings.push(rank);
        s.totalRank += rank;
        if (rank === 1) s.firstPlaceCount += 1;
        if (rank === r.ranks.length) s.lastPlaceCount += 1;
      });
    });
    state.setPlayerStats(stats);

    histMod.renderHistory();
    teamMod.renderTeams();
    statsMod.renderStatistics();
  });
  await page.waitForTimeout(300);
}

// ---------- harness ----------

const browser = await chromium.launch();
const consoleErrors = [];
let shot = 0;

async function openPage(pathname, theme, viewport) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[viewport] });
  // Every page mocks the API endpoints — index's player-search block also
  // calls /api/players/list on load, which has no backend under `vite dev`.
  await mockApis(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR ${pathname}: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`CONSOLE ${pathname}: ${msg.text()}`);
  });
  page.on('dialog', async (d) => { await d.accept(); });
  await freezeTime(page);
  await page.goto(`${BASE_URL}${pathname}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    Object.keys(localStorage).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('gd_v9_theme', t);
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { ctx, page };
}

async function snap(page, name, { fullPage = true } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(REPORT_DIR, `${name}.png`), fullPage });
  shot += 1;
  console.log(`SAVED ${name}.png`);
}

/** Generate the deterministic 8-player roster (no ranking yet). */
async function seedPlayers(page) {
  // These captures represent in-game states, which in real usage only exist
  // inside a room (where the room gate is off). On a blank dev load the gate is
  // on and hides #generatePlayers, so lift it before driving the setup UI.
  await page.evaluate(() => {
    document.querySelector('main.wrap')?.classList.remove('wrap--gated');
    document.body.classList.remove('app-gated');
  });
  await page.click('#generatePlayers');
  await page.waitForTimeout(200);
  await setDeterministicPlayers(page, 8);
}

/** Place a fixed partial ranking (3 of 8) via the state layer. */
async function seedPartialRanking(page) {
  await page.evaluate(async () => {
    const state = (await import('/src/core/state.js')).default;
    const evt = await import('/src/core/events.js');
    state.setCurrentRanking({ 1: 1, 2: 5, 3: 2 });
    evt.emit('ranking:updated');
  });
  await page.waitForTimeout(300);
}

// ---------- index: room gate (the blank-load entry screen, 2026-06-12) ----------
for (const [theme, viewport] of [['light', 'mobile'], ['dark', 'mobile'], ['light', 'desktop']]) {
  const { ctx, page } = await openPage('/', theme, viewport);
  await snap(page, `index-gate-${theme}-${viewport}`);
  await ctx.close();
}

// ---------- index: ranking in progress ----------
for (const [theme, viewport] of [['light', 'mobile'], ['dark', 'mobile'], ['light', 'desktop']]) {
  const { ctx, page } = await openPage('/', theme, viewport);
  await seedPlayers(page);
  await seedPartialRanking(page);
  await snap(page, `index-ranking-${theme}-${viewport}`);
  await ctx.close();
}

// ---------- index: played session (history / stats / honors) ----------
for (const [theme, viewport] of [['light', 'mobile'], ['dark', 'mobile']]) {
  const { ctx, page } = await openPage('/', theme, viewport);
  await seedPlayers(page);
  await seedPlayedSession(page);
  await snap(page, `index-session-${theme}-${viewport}`);
  await ctx.close();
}

// ---------- index: victory modal ----------
for (const [theme, viewport] of [['light', 'mobile'], ['dark', 'mobile'], ['light', 'desktop']]) {
  const { ctx, page } = await openPage('/', theme, viewport);
  await seedPlayers(page);
  await seedPlayedSession(page);
  await page.evaluate(async () => {
    const state = (await import('/src/core/state.js')).default;
    const modal = await import('/src/ui/victoryModal.js');
    state.setGameStatus({ ended: true, winnerKey: 't1', winnerName: '蓝队', reason: 'A_LEVEL_CLEARED' });
    await modal.showVictoryModal('蓝队');
  });
  await page.waitForTimeout(400);
  await snap(page, `victory-${theme}-${viewport}`, { fullPage: false });
  await ctx.close();
}

// ---------- players / rooms (mocked) ----------
for (const [pathname, label] of [['/players.html', 'players'], ['/rooms.html', 'rooms']]) {
  for (const [theme, viewport] of [['light', 'mobile'], ['dark', 'mobile'], ['light', 'desktop']]) {
    const { ctx, page } = await openPage(pathname, theme, viewport);
    await page.waitForTimeout(500);
    await snap(page, `${label}-${theme}-${viewport}`);
    await ctx.close();
  }
}

// ---------- profile (mocked; Chart.js animation settle) ----------
for (const [theme, viewport] of [['light', 'mobile'], ['dark', 'mobile']]) {
  const { ctx, page } = await openPage('/player-profile.html?handle=fufu', theme, viewport);
  await page.waitForTimeout(1800); // Chart.js entry animations finish < 1.2s
  await snap(page, `profile-${theme}-${viewport}`);
  await ctx.close();
}

await browser.close();

if (consoleErrors.length) {
  console.error('CONSOLE/PAGE ERRORS:');
  consoleErrors.forEach(e => console.error('  ' + e));
  process.exit(1);
}
console.log(`SAVED ${shot} captures → ${REPORT_DIR}`);
