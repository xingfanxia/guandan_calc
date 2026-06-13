import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**/api/players/list*', (r) => r.fulfill({ json: { players: [{ handle: 'fufu', displayName: '芙芙', emoji: '🐸', stats: { sessionsPlayed: 2, sessionsWon: 1, sessionWinRate: 0.5, avgRankingPerSession: 3.2 } }], total: 1 } }));
await ctx.route('**/api/players/fufu*', (r) => r.fulfill({ json: { handle: 'fufu', displayName: '芙芙', emoji: '🐸', tagline: '', createdAt: '2025-12-01T00:00:00Z', lastActiveAt: '2026-06-01T00:00:00Z', achievements: [], recentGames: [], stats: { sessionsPlayed: 2, sessionsWon: 1, sessionWinRate: 0.5, avgRankingPerSession: 3.2, partners: {}, opponents: {}, recentRankings: [], honors: {} } } }));
await ctx.route('**/api/rooms/list*', (r) => r.fulfill({ json: { rooms: [] } }));

for (const [path, mustHave] of [
  ['/players.html', ['searchInput', 'playersGrid']],
  ['/rooms.html', ['roomsGrid']],
  ['/player-profile.html?handle=fufu', []],
]) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const present = await page.evaluate((ids) => ids.map((id) => [id, !!document.getElementById(id)]), mustHave);
  const toggle = await page.evaluate(() => !!document.querySelector('#themeToggleMount .theme-toggle'));
  console.log(path, '| ids:', JSON.stringify(present), '| themeToggle:', toggle, '| errors:', errs.length ? errs.slice(0, 3) : 'none');
  await page.close();
}
await browser.close();
