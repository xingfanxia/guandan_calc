import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { CURRENT_HONOR_TITLES } from '../../shared/honorCatalog.js';

const pageUrl = process.env.PROFILE_PAGE_URL || 'http://127.0.0.1:4173/player-profile.html?handle=viewer';
const maliciousHandle = "partner' onclick='alert(1)";
const maliciousRoomCode = "ROOM' onclick='alert(2)";
const nineCurrentHonors = Object.fromEntries(CURRENT_HONOR_TITLES.slice(0, 9).map(title => [title, 1]));

const profilePayload = {
  success: true,
  player: {
    id: 'viewer',
    handle: 'viewer',
    displayName: '<img src=x onerror=alert(1)>',
    emoji: '🧪',
    playStyle: 'steady',
    tagline: '<svg onload=alert(1)>',
    achievements: [],
    stats: {
      sessionsPlayed: 1,
      sessionsWon: 1,
      sessionWinRate: 1,
      avgRankingPerSession: 1,
      avgRoundsPerSession: 3,
      longestSessionRounds: 3,
      currentWinStreak: 1,
      longestWinStreak: 1,
      roundsPlayed: 3,
      avgRankingPerRound: 1,
      totalPlayTimeSeconds: 300,
      longestSessionSeconds: 300,
      avgSessionSeconds: 300,
      mvpVotes: 0,
      burdenVotes: 0,
      recentRankings: [],
      honors: nineCurrentHonors,
      partners: {
        [maliciousHandle]: { games: 2, wins: 1, winRate: 0.5 },
        dirty_partner: { games: 'bad', wins: 'bad', winRate: 'Infinity' }
      },
      opponents: {}
    },
    recentGames: [
      {
        roomCode: maliciousRoomCode,
        date: '2026-06-10T12:00:00.000Z',
        mode: '8P',
        ranking: 1,
        rounds: 3,
        duration: 300,
        teamWon: true,
        honorsEarned: ['<script>alert(1)</script>']
      }
    ]
  }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.route('**/api/players/*', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(profilePayload)
  });
});

await page.goto(pageUrl);
await page.waitForSelector('.rels-row');
await page.waitForSelector('.recent-game-row');
await page.waitForSelector('.profile-honor-card');

const honorsTotalText = await page
  .locator('.section-rule')
  .filter({ hasText: '荣誉收藏' })
  .locator('.section-rule__meta')
  .first()
  .textContent();
assert.equal(honorsTotalText?.trim(), '9 TOTAL');

const relRow = page.locator('.rels-row').first();
const recentGameRow = page.locator('.recent-game-row').first();

const relationshipText = await page.locator('.rels-grid').textContent();
assert.doesNotMatch(
  relationshipText || '',
  /NaN|Infinity/,
  'dirty relationship stats should not leak NaN/Infinity into profile UI'
);
const relationshipWidths = await page.locator('.rels-row-bar-fill').evaluateAll(elements =>
  elements.map(element => element.style.width)
);
for (const width of relationshipWidths) {
  const value = Number.parseFloat(width);
  assert.ok(Number.isFinite(value), `relationship bar width should be finite, got ${width}`);
  assert.ok(value >= 0 && value <= 100, `relationship bar width should stay within 0-100%, got ${width}`);
}

assert.equal(await relRow.getAttribute('onclick'), null);
assert.equal(await recentGameRow.getAttribute('onclick'), null);
assert.equal(await relRow.getAttribute('data-profile-handle'), maliciousHandle);
assert.equal(await recentGameRow.getAttribute('data-room-code'), maliciousRoomCode);

await relRow.click();
await page.waitForURL(url => url.pathname === '/player-profile.html');
assert.equal(new URL(page.url()).searchParams.get('handle'), maliciousHandle);

await page.goto(pageUrl);
await page.waitForSelector('.recent-game-row');
await page.locator('.recent-game-row').first().click();
await page.waitForURL(url => url.pathname === '/');
assert.equal(new URL(page.url()).searchParams.get('room'), maliciousRoomCode);

await browser.close();
console.log('profile page interaction checks passed');
