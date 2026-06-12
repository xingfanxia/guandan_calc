// Light/dark toggle smoke test — replaces the old 5-theme switch test.
//
// Asserts (against a running dev server):
//   1.  Fresh visit with no stored theme resolves to a valid mode
//   2.  Legacy 5-theme localStorage values fall back to system preference
//   3.  Toggle click flips data-theme and persists to gd_v9_theme
//   4.  Reload keeps the chosen mode (inline bootstrap path)
//   5.  TOKEN_SPEC tokens all resolve in BOTH modes (verifyTokensPresent)
//   6.  Board hero renders (level digits visible) in both modes
//   7.  Toggle exists on all four pages and works on each
//
// Usage:  node scripts/visual/test-theme-toggle.mjs
// Env:    GD_BASE_URL (default http://localhost:3000)

import { chromium } from 'playwright';

const BASE_URL = process.env.GD_BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('dialog', async (d) => { await d.accept(); });

// Route API calls to harmless empties so secondary pages don't error-dialog.
// Predicate (not a glob) so /src/api/*.js module loads are NOT intercepted.
await ctx.route(
  (url) => url.pathname.startsWith('/api/'),
  (route) => route.fulfill({ json: { success: true, players: [], rooms: [], total: 0, player: null, pagination: { total: 0, hasNext: false } } })
);

// --- 1. fresh visit resolves a valid mode ---
console.log('1. fresh visit');
await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
const freshTheme = await page.getAttribute('html', 'data-theme');
assert(freshTheme === 'light' || freshTheme === 'dark', `data-theme resolves (${freshTheme})`);

// --- 2. legacy theme value falls back ---
console.log('2. legacy 5-theme value falls back');
await page.evaluate(() => localStorage.setItem('gd_v9_theme', 'teatable'));
await page.reload({ waitUntil: 'networkidle' });
const legacyTheme = await page.getAttribute('html', 'data-theme');
assert(legacyTheme === 'light' || legacyTheme === 'dark', `legacy value → ${legacyTheme}`);

// --- 3 + 4. toggle flips, persists, survives reload ---
console.log('3. toggle + persistence');
await page.evaluate(() => localStorage.setItem('gd_v9_theme', 'light'));
await page.reload({ waitUntil: 'networkidle' });
await page.click('.theme-toggle');
assert(await page.getAttribute('html', 'data-theme') === 'dark', 'toggle light → dark');
assert(await page.evaluate(() => localStorage.getItem('gd_v9_theme')) === 'dark', 'persisted to gd_v9_theme');
await page.reload({ waitUntil: 'networkidle' });
assert(await page.getAttribute('html', 'data-theme') === 'dark', 'reload keeps dark');
await page.click('.theme-toggle');
assert(await page.getAttribute('html', 'data-theme') === 'light', 'toggle dark → light');

// --- 5. token contract resolves in both modes ---
console.log('4. TOKEN_SPEC resolution');
for (const mode of ['light', 'dark']) {
  await page.evaluate((m) => {
    document.documentElement.setAttribute('data-theme', m);
  }, mode);
  const check = await page.evaluate(async () => {
    const spec = await import('/src/styles/tokenSpec.js');
    return spec.verifyTokensPresent();
  });
  assert(check.ok, `all tokens resolve in ${mode}${check.ok ? '' : ' — missing: ' + check.missing.join(', ')}`);
}

// --- 6. board hero renders in both modes ---
console.log('5. board hero renders');
for (const mode of ['light', 'dark']) {
  await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), mode);
  const levelVisible = await page.evaluate(() => {
    const el = document.getElementById('t1Lvl');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.height > 40 && getComputedStyle(el).visibility !== 'hidden';
  });
  assert(levelVisible, `level digit visible in ${mode}`);
}

// --- 7. toggle present + functional on all four pages ---
console.log('6. toggle on all pages');
for (const pathname of ['/', '/players.html', '/rooms.html', '/player-profile.html?handle=fufu']) {
  await page.goto(`${BASE_URL}${pathname}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('gd_v9_theme', 'light'));
  await page.reload({ waitUntil: 'networkidle' });
  const ok = await page.evaluate(() => {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return false;
    btn.click();
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });
  assert(ok, `${pathname} toggle works`);
}

await browser.close();

console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
