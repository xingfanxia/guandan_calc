import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**/api/players/list*', (r) => r.fulfill({ json: { players: [{ handle: 'fufu', displayName: '芙芙', emoji: '🐸', stats: { sessionsPlayed: 2, sessionsWon: 1, sessionWinRate: 0.5, avgRankingPerSession: 3.2 } }], total: 1 } }));
await ctx.route('**/api/players/fufu*', (r) => r.fulfill({ json: { handle: 'fufu', displayName: '芙芙', emoji: '🐸', tagline: '', createdAt: '2025-12-01T00:00:00Z', lastActiveAt: '2026-06-01T00:00:00Z', achievements: [], recentGames: [], stats: { sessionsPlayed: 2, sessionsWon: 1, sessionWinRate: 0.5, avgRankingPerSession: 3.2, partners: {}, opponents: {}, recentRankings: [], honors: {}, mvpVotes: 0, burdenVotes: 0 } } }));
await ctx.route('**/api/rooms/list*', (r) => r.fulfill({ json: { rooms: [{ code: 'A1B2C3', mode: 8, lastUpdated: Date.now(), createdAt: Date.now() - 3600e3, players: [], favorited: true }] } }));

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:3000/players.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const p = await page.evaluate(() => ({
  listChildren: document.getElementById('playersList')?.children.length,
  count: document.getElementById('playerCount')?.textContent,
  searchVisible: !!document.getElementById('searchInput') && getComputedStyle(document.getElementById('searchInput')).display !== 'none',
  createBtn: !!document.getElementById('createPlayerButton'),
  adminBtn: !!document.getElementById('adminModeButton'),
}));
console.log('players.html:', JSON.stringify(p), '| errors:', errs.length ? errs.slice(0,3) : 'none');

const errs2 = [];
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errs2.push(String(e)));
await page2.goto('http://localhost:3000/rooms.html', { waitUntil: 'networkidle' });
await page2.waitForTimeout(1500);
const r = await page2.evaluate(() => ({
  listChildren: document.getElementById('roomsList')?.children.length,
  filterBtn: !!document.getElementById('filterButton'),
  clearBtn: !!document.getElementById('clearFilterButton'),
  pagination: !!document.getElementById('pagination'),
}));
console.log('rooms.html:', JSON.stringify(r), '| errors:', errs2.length ? errs2.slice(0,3) : 'none');

const errs3 = [];
const page3 = await ctx.newPage();
page3.on('pageerror', (e) => errs3.push(String(e)));
await page3.goto('http://localhost:3000/player-profile.html?handle=fufu', { waitUntil: 'networkidle' });
await page3.waitForTimeout(2000);
const pr = await page3.evaluate(() => ({
  name: document.body.textContent.includes('芙芙'),
  hasEditBtn: !!document.getElementById('editProfileButton') || !!document.querySelector('[id*="edit" i]'),
}));
console.log('profile:', JSON.stringify(pr), '| errors:', errs3.length ? errs3.slice(0,3) : 'none');
await browser.close();
