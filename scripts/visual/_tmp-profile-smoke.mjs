import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**/api/players/fufu*', (r) => r.fulfill({ json: { player: { handle: 'fufu', displayName: '芙芙', emoji: '🐸', tagline: '稳', playStyle: 'steady', createdAt: '2025-12-01T00:00:00Z', lastActiveAt: '2026-06-01T00:00:00Z', achievements: [], recentGames: [{ date: '2026-06-01T10:00:00Z', mode: '8P', ranking: '2.13', rounds: 12, duration: 4500, teamWon: true, roomCode: 'A1B2C3', honorsEarned: [] }], stats: { sessionsPlayed: 2, sessionsWon: 1, sessionWinRate: 0.5, avgRankingPerSession: 3.2, avgRoundsPerSession: 10, longestSessionRounds: 12, roundsPlayed: 20, avgRankingPerRound: 3.4, totalPlayTimeSeconds: 7200, longestSessionSeconds: 3600, avgSessionSeconds: 3600, currentWinStreak: 1, longestWinStreak: 1, mvpVotes: 0, burdenVotes: 0, partners: {}, opponents: {}, recentRankings: [1,2,3], honors: {} } } } }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:3000/player-profile.html?handle=fufu', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const pr = await page.evaluate(() => ({
  heroName: document.getElementById('heroName')?.textContent,
  heroVisible: document.getElementById('profileHero')?.style.display,
  charts: document.querySelectorAll('canvas').length,
  hasRecent: !!document.getElementById('recentRankingsChart'),
}));
console.log('profile:', JSON.stringify(pr), '| errors:', errs.length ? errs.slice(0,3) : 'none');
// theme toggle triggers reload of profile (new wiring) — verify no error
await page.evaluate(() => document.querySelector('#themeToggleMount .theme-toggle')?.click());
await page.waitForTimeout(1500);
const pr2 = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, heroName: document.getElementById('heroName')?.textContent }));
console.log('after toggle:', JSON.stringify(pr2), '| errors:', errs.length ? errs.slice(0,3) : 'none');
await browser.close();
