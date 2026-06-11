import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const appUrl = process.env.APP_URL || 'http://127.0.0.1:4173';

const roomsHtml = await readFile(new URL('../../rooms.html', import.meta.url), 'utf8');
const roomManagerSource = await readFile(new URL('../../src/share/roomManager.js', import.meta.url), 'utf8');

assert.match(
  roomsHtml,
  /function normalizeRoomCode/,
  'rooms.html should normalize room codes before rendering or navigation'
);

assert.match(
  roomsHtml,
  /encodeURIComponent\(normalizedRoomCode\)/,
  'rooms.html navigation should URL-encode room codes'
);

assert.match(
  roomsHtml,
  /function normalizeStringList/,
  'rooms.html should normalize API-controlled room string arrays before rendering'
);

assert.match(
  roomsHtml,
  /const rooms = Array\.isArray\(result\.rooms\) \? result\.rooms : \[\]/,
  'rooms.html should tolerate non-array rooms responses'
);

assert.match(
  roomsHtml,
  /const teamNames = normalizeStringList\(room\.teamNames\)/,
  'rooms.html should not call array methods on raw teamNames'
);

assert.match(
  roomsHtml,
  /const playerHandles = normalizeStringList\(room\.playerHandles\)/,
  'rooms.html should not call array methods on raw playerHandles'
);

assert.match(
  roomManagerSource,
  /export function normalizeRoomCode/,
  'roomManager should export shared room-code normalization'
);

assert.doesNotMatch(
  roomManagerSource,
  /fetch\(`\/api\/rooms\/\$\{roomCode\}`\)/,
  'roomManager should not interpolate raw roomCode into fetch paths'
);

assert.doesNotMatch(
  roomManagerSource,
  /fetch\(`\/api\/rooms\/\$\{currentRoomCode\}`/,
  'roomManager should encode currentRoomCode before fetch paths'
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();

await page.route('**/api/rooms/list**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      rooms: [
        {
          roomCode: 'BAD123&viewer=evil',
          createdAt: '2026-06-10T12:00:00.000Z',
          lastUpdated: '2026-06-10T12:00:00.000Z',
          currentRound: 1,
          playerCount: 4,
          playerHandles: ['bad'],
          teamNames: ['Blue', 'Red'],
          isFinished: false
        },
        {
          roomCode: 'ZXCVBN',
          createdAt: '2026-06-10T12:00:00.000Z',
          lastUpdated: '2026-06-10T12:00:00.000Z',
          currentRound: 2,
          playerCount: 4,
          playerHandles: ['safe'],
          teamNames: ['Blue', 'Red'],
          isFinished: false
        },
        {
          roomCode: 'MALFRM',
          createdAt: '2026-06-10T12:00:00.000Z',
          lastUpdated: '2026-06-10T12:00:00.000Z',
          currentRound: 3,
          playerCount: '<img data-testid="room-count-xss" src=x>',
          playerHandles: '<img data-testid="room-handle-xss" src=x>',
          teamNames: '<img data-testid="room-team-xss" src=x>',
          isFinished: false
        }
      ],
      pagination: {
        total: 3,
        hasNext: false
      }
    })
  });
});

await page.goto(`${appUrl}/rooms.html`);
await page.waitForSelector('.room-card');
assert.equal(await page.locator('.room-card').count(), 2);
assert.equal((await page.locator('.room-card__code').first().textContent())?.trim(), 'ZXCVBN');
assert.equal(await page.locator('[data-testid="room-count-xss"]').count(), 0);
assert.equal(await page.locator('[data-testid="room-handle-xss"]').count(), 0);
assert.equal(await page.locator('[data-testid="room-team-xss"]').count(), 0);

await page.locator('.room-card button').first().click();
await page.waitForURL(url => url.pathname === '/');
const roomUrl = new URL(page.url());
assert.equal(roomUrl.searchParams.get('room'), 'ZXCVBN');
assert.equal(roomUrl.searchParams.has('viewer'), false);

const invalidPage = await browser.newPage();
let unsafeRequestCount = 0;
invalidPage.on('request', request => {
  const url = new URL(request.url());
  if (url.pathname === '/players/list' || url.pathname.includes('..')) {
    unsafeRequestCount++;
  }
});

invalidPage.on('dialog', async dialog => {
  try {
    await dialog.accept();
  } catch {}
});

await invalidPage.goto(`${appUrl}/?room=../../players/list`);
await invalidPage.waitForTimeout(500);
assert.equal(unsafeRequestCount, 0);

await browser.close();
console.log('room code URL safety checks passed');
