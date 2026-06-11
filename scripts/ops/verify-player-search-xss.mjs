import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(resolve(repoRoot, 'src/player/playerSearch.js'), 'utf8');
const pageUrl = process.env.PLAYER_SEARCH_PAGE_URL || 'http://127.0.0.1:4173/';

assert.ok(
  source.includes('搜索失败: ${escapeHtml(error.message)}'),
  'player search error rendering should escape error.message before assigning innerHTML'
);

assert.ok(
  source.includes('const playerStats = player.stats || {};'),
  'player search results should tolerate missing stats objects'
);

assert.ok(
  source.includes('formatInteger(playerStats.sessionsPlayed || playerStats.gamesPlayed, 0)'),
  'player search games-played display should route through numeric formatting'
);

assert.doesNotMatch(
  source,
  /\$\{escapeHtml\(player\.stats\.gamesPlayed\)\}/,
  'player search should not directly interpolate player.stats.gamesPlayed'
);

const clearSearchStart = source.indexOf('export function clearSearchResults');
const clearSearchSource = source.slice(clearSearchStart);
assert.ok(
  clearSearchSource.includes('latestSearchRequestId++'),
  'clearing player search results should invalidate in-flight search responses'
);
assert.ok(
  clearSearchSource.includes('clearTimeout(searchTimeout)'),
  'clearing player search results should cancel pending debounced searches'
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();
const consoleErrors = [];

page.on('console', msg => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  if (text.includes('Service Worker registration failed')) return;
  consoleErrors.push(text);
});

page.on('pageerror', error => {
  consoleErrors.push(error.message);
});

await page.route('**/api/players/list**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      players: [
        {
          id: '1',
          handle: 'missing-stats',
          displayName: 'Missing Stats',
          emoji: 'A',
          playStyle: 'steady'
        },
        {
          id: '2',
          handle: 'malicious-stats',
          displayName: 'Malicious Stats',
          emoji: 'B',
          playStyle: 'aggressive',
          stats: {
            gamesPlayed: '<img data-testid="search-stat-xss" src=x>'
          }
        }
      ],
      total: 2,
      hasMore: false
    })
  });
});

await page.goto(pageUrl);
await page.locator('#playerSearchInput').fill('stats');
await page.locator('#playerSearchButton').click();
await page.waitForSelector('.player-search-item');

assert.equal(await page.locator('.player-search-item').count(), 2);
assert.equal(await page.locator('[data-testid="search-stat-xss"]').count(), 0);
assert.equal((await page.locator('.player-search-item', { hasText: '0 场游戏' }).count()), 2);
assert.deepEqual(consoleErrors, []);

await page.unroute('**/api/players/list**');
await page.route('**/api/players/list**', async route => {
  const url = new URL(route.request().url());
  const query = url.searchParams.get('q') || '';
  if (query === 'slow') {
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      players: [
        {
          id: query || 'empty',
          handle: `${query || 'empty'}-handle`,
          displayName: `${query || 'empty'} Result`,
          emoji: query === 'slow' ? 'S' : 'F',
          playStyle: 'steady',
          stats: { gamesPlayed: 1 }
        }
      ],
      total: 1,
      hasMore: false
    })
  });
});

await page.locator('#playerSearchInput').fill('slow');
await page.locator('#playerSearchButton').click();
await page.locator('#playerSearchInput').fill('fast');
await page.locator('#playerSearchButton').click();
await page.waitForSelector('.player-search-item:has-text("fast Result")');
await page.waitForTimeout(850);

assert.equal(
  await page.locator('.player-search-item:has-text("fast Result")').count(),
  1,
  'player search should keep the latest query result visible'
);
assert.equal(
  await page.locator('.player-search-item:has-text("slow Result")').count(),
  0,
  'player search should ignore stale slower responses from older queries'
);

await page.unroute('**/api/players/list**');
await page.route('**/api/players/list**', async route => {
  const url = new URL(route.request().url());
  const query = url.searchParams.get('q') || '';
  if (!query) {
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      players: [
        {
          id: query || 'initial',
          handle: `${query || 'initial'}-handle`,
          displayName: query ? `${query} Result` : 'Initial Result',
          emoji: query ? 'F' : 'I',
          playStyle: 'steady',
          stats: { gamesPlayed: 1 }
        }
      ],
      total: 1,
      hasMore: false
    })
  });
});

await page.goto(pageUrl);
await page.locator('#playerSearchInput').fill('fast');
await page.locator('#playerSearchButton').click();
await page.waitForSelector('.player-search-item:has-text("fast Result")');
await page.waitForTimeout(850);

assert.equal(
  await page.locator('.player-search-item:has-text("fast Result")').count(),
  1,
  'player search should keep explicit search results after a slower initial list returns'
);
assert.equal(
  await page.locator('.player-search-item:has-text("Initial Result")').count(),
  0,
  'initial player list should not overwrite newer explicit search results'
);

await page.unroute('**/api/players/list**');
await page.route('**/api/players/list**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true })
  });
});

await page.goto(pageUrl);
await page.waitForSelector('#playerSearchResults', { state: 'attached' });
await page.waitForTimeout(100);

assert.equal(
  await page.locator('#playerSearchResults', { hasText: '暂无玩家，点击"创建玩家"开始' }).count(),
  1,
  'initial player list should treat malformed player-list responses as empty results'
);

await page.locator('#playerSearchInput').fill('malformed');
await page.locator('#playerSearchButton').click();
await page.waitForSelector('#playerSearchResults:has-text("未找到匹配")');

assert.equal(
  consoleErrors.length,
  0,
  'malformed player-list responses should not surface as console errors'
);

consoleErrors.length = 0;

await page.unroute('**/api/players/list**');
await page.route('**/api/players/list**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<html><body>edge cache error</body></html>'
  });
});

await page.goto(pageUrl);
await page.waitForSelector('#playerSearchResults', { state: 'attached' });
await page.waitForTimeout(100);

assert.equal(
  await page.locator('#playerSearchResults', { hasText: '暂无玩家，点击"创建玩家"开始' }).count(),
  1,
  'initial player list should treat non-JSON success responses as empty results'
);

await page.locator('#playerSearchInput').fill('html');
await page.locator('#playerSearchButton').click();
await page.waitForSelector('#playerSearchResults:has-text("未找到匹配")');

assert.equal(
  consoleErrors.length,
  0,
  'non-JSON player-list success responses should not surface as console errors'
);

await browser.close();

console.log('player search XSS checks passed');
