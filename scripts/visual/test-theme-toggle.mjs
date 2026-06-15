// Tri-state theme toggle smoke test (auto / light / dark) — ported alongside
// the wxapp 外观开关 (2026-06-15). Replaces the binary light/dark test.
//
// Asserts (against a running dev server):
//   1.  Fresh visit with no stored pref → 'auto' → resolves to a valid mode
//   2.  Legacy 5-theme localStorage values fall back to system preference
//   3.  'auto' tracks the OS: emulate dark/light → data-theme follows
//   4.  Toggle cycles 跟随系统 → 浅色 → 深色 → 跟随系统 and persists the pref
//   5.  Reload keeps the chosen pref (inline bootstrap path)
//   6.  TOKEN_SPEC tokens all resolve in BOTH modes (verifyTokensPresent)
//   7.  Board hero renders (level digits visible) in both modes
//   8.  Toggle exists on all four pages and works on each
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

const dataTheme = () => page.getAttribute('html', 'data-theme');
const storedPref = () => page.evaluate(() => localStorage.getItem('gd_v9_theme'));

// --- 1. fresh visit → auto → valid mode ---
console.log('1. fresh visit (no pref → auto)');
await page.emulateMedia({ colorScheme: 'light' });
await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
const freshTheme = await dataTheme();
assert(freshTheme === 'light' || freshTheme === 'dark', `data-theme resolves (${freshTheme})`);
assert((await storedPref()) === null, 'no pref persisted until the user picks one');

// --- 2. legacy theme value falls back to system ---
console.log('2. legacy 5-theme value falls back');
await page.evaluate(() => localStorage.setItem('gd_v9_theme', 'teatable'));
await page.reload({ waitUntil: 'networkidle' });
const legacyTheme = await dataTheme();
assert(legacyTheme === 'light' || legacyTheme === 'dark', `legacy value → ${legacyTheme}`);

// --- 3. 'auto' tracks the OS ---
console.log('3. auto follows system');
await page.evaluate(() => localStorage.setItem('gd_v9_theme', 'auto'));
await page.emulateMedia({ colorScheme: 'dark' });
await page.reload({ waitUntil: 'networkidle' });
assert(await dataTheme() === 'dark', 'auto + OS dark → data-theme dark (bootstrap)');
// Live change without reload (matchMedia listener path).
await page.emulateMedia({ colorScheme: 'light' });
await page.waitForTimeout(50);
assert(await dataTheme() === 'light', 'auto + OS flips light → data-theme tracks live');
await page.emulateMedia({ colorScheme: 'light' });

// --- 4 + 5. toggle cycles auto → light → dark → auto, persists, survives reload ---
console.log('4. toggle cycle + persistence');
await page.evaluate(() => localStorage.setItem('gd_v9_theme', 'auto'));
await page.reload({ waitUntil: 'networkidle' });
await page.click('.theme-toggle');                 // auto → light
assert(await storedPref() === 'light', 'auto → light (pref)');
assert(await dataTheme() === 'light', 'auto → light (data-theme)');
await page.click('.theme-toggle');                 // light → dark
assert(await storedPref() === 'dark', 'light → dark (pref)');
assert(await dataTheme() === 'dark', 'light → dark (data-theme)');
await page.reload({ waitUntil: 'networkidle' });
assert(await dataTheme() === 'dark', 'reload keeps dark');
await page.click('.theme-toggle');                 // dark → auto
assert(await storedPref() === 'auto', 'dark → auto (pref)');
const afterAuto = await dataTheme();
assert(afterAuto === 'light' || afterAuto === 'dark', `auto resolves to system (${afterAuto})`);

// --- 6. token contract resolves in both modes ---
console.log('5. TOKEN_SPEC resolution');
for (const mode of ['light', 'dark']) {
  await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), mode);
  const check = await page.evaluate(async () => {
    const spec = await import('/src/styles/tokenSpec.js');
    return spec.verifyTokensPresent();
  });
  assert(check.ok, `all tokens resolve in ${mode}${check.ok ? '' : ' — missing: ' + check.missing.join(', ')}`);
}

// --- 7. board hero renders in both modes ---
// A blank load shows the room gate (which hides the board), so lift it — the
// board renders inside a room/game, which is what we're checking here.
console.log('6. board hero renders');
await page.evaluate(() => {
  document.querySelector('main.wrap')?.classList.remove('wrap--gated');
  document.body.classList.remove('app-gated');
});
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

// --- 8. toggle present + functional on all four pages ---
console.log('7. toggle on all pages');
for (const pathname of ['/', '/players.html', '/rooms.html', '/player-profile.html?handle=fufu']) {
  await page.goto(`${BASE_URL}${pathname}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('gd_v9_theme', 'light'));
  await page.reload({ waitUntil: 'networkidle' });
  const ok = await page.evaluate(() => {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return false;
    btn.click();  // light → dark
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });
  assert(ok, `${pathname} toggle cycles`);
}

await browser.close();

console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
