import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const pageUrl = process.env.PLAYERS_PAGE_URL || 'http://127.0.0.1:4173/players.html';
const maliciousHandle = "bad' onclick='alert(1)";
const playersPayload = {
  players: [
    {
      id: '1',
      handle: maliciousHandle,
      displayName: '<img src=x onerror=alert(1)>',
      emoji: '🧪',
      playStyle: 'steady',
      tagline: '<svg onload=alert(1)>',
      stats: {
        sessionsPlayed: '<img data-testid="stat-xss" src=x>',
        sessionsWon: 1,
        sessionWinRate: 1 / 3,
        avgRankingPerSession: '<img data-testid="avg-xss" src=x>'
      }
    }
  ],
  total: 1,
  hasMore: false
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let resetBody = null;
let resolveReset;
const resetSeen = new Promise(resolve => {
  resolveReset = resolve;
});

page.on('dialog', async dialog => {
  try {
    await dialog.accept();
  } catch {
    // The success alert can race with browser teardown after assertions pass.
  }
});

await page.route('**/api/players/list?**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(playersPayload)
  });
});

await page.route('**/api/players/reset-stats', async route => {
  resetBody = JSON.parse(route.request().postData() || '{}');
  resolveReset();
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true })
  });
});

await page.goto(pageUrl);
await page.waitForSelector('.player-card');

assert.equal(await page.locator('[data-testid="stat-xss"]').count(), 0);
assert.equal(await page.locator('[data-testid="avg-xss"]').count(), 0);
assert.match(await page.locator('.player-card__stats').textContent(), /🎮 0 场/);
assert.equal(await page.locator('.player-card').first().getAttribute('onclick'), null);
assert.equal(await page.locator('[data-profile-handle]').first().getAttribute('data-profile-handle'), maliciousHandle);

await page.locator('.player-card').first().click();
await page.waitForURL(url => url.pathname === '/player-profile.html');
assert.equal(new URL(page.url()).searchParams.get('handle'), maliciousHandle);

await page.goto(pageUrl);
await page.waitForSelector('.player-card');
await page.locator('#adminModeButton').click();
await page.locator('#adminTokenInput').fill('secret');
await page.waitForSelector('[data-admin-action="reset"]');
await page.locator('[data-admin-action="reset"]').click();
await resetSeen;

assert.equal(resetBody.handle, maliciousHandle);
assert.equal(resetBody.adminToken, 'secret');
assert.equal(new URL(page.url()).pathname, '/players.html');

await browser.close();
console.log('players page interaction checks passed');
