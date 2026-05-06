#!/usr/bin/env node
/**
 * Phase 2.5 smoke test — theme manager mount/unmount/state-persistence path.
 *
 * Verifies four invariants the architecture guarantees but VR can't catch:
 *
 *   1. Boot into Linear mounts the sidebar (`<aside class="linear-sidebar">`)
 *      with the live `<nav class="topnav">` moved inside, body padded by 240px,
 *      `linear-sidebar-active` class set on `<html>`, all 3 tabs visible.
 *   2. Switch from Linear to a CSS-only theme unmounts the sidebar cleanly —
 *      no orphan `<aside>`, topnav back at its original BODY parent, body
 *      padding cleared, `linear-sidebar-active` class removed.
 *   3. Switch back to Linear remounts the sidebar (idempotency).
 *   4. State (team levels, round level) survives a full broadcast →
 *      trading → atelier → linear theme cycle — proves the singleton
 *      survives DOM mutations.
 *
 * Requires `npm run dev` on :3000. Exits non-zero on any failed assertion.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:3000/';
const ASSERTIONS = [];
function assert(label, ok, detail) {
  ASSERTIONS.push({ label, ok, detail });
  if (!ok) console.error(`  ✗ ${label}: ${detail}`);
  else console.log(`  ✓ ${label}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Console errors from playerApi /api/* fetches are expected in the test env
// (no real backend); we only fail on actual page errors.
page.on('pageerror', (e) => {
  console.error('PAGEERROR:', e.message);
  ASSERTIONS.push({ label: 'no page errors', ok: false, detail: e.message });
});

// === Test 1: Boot into Linear ===
console.log('\n=== Test 1: Boot into Linear ===');
await page.goto(URL);
await page.evaluate(() => localStorage.setItem('gd_v9_theme', 'linear'));
await page.reload();
await page.waitForTimeout(1500);

let state = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  sidebar: !!document.querySelector('.linear-sidebar'),
  topnavInside: document.querySelector('.linear-sidebar .topnav') !== null,
  bodyPad: getComputedStyle(document.body).paddingLeft,
  htmlClass: document.documentElement.className,
  tabCount: document.querySelectorAll('.linear-sidebar .topnav__tab').length,
}));
assert('boot theme = linear', state.theme === 'linear', `got ${state.theme}`);
assert('sidebar mounted', state.sidebar, 'no .linear-sidebar element');
assert('topnav moved into sidebar', state.topnavInside, 'topnav not in sidebar');
assert('body padding = 240px', state.bodyPad === '240px', `got ${state.bodyPad}`);
assert('html has linear-sidebar-active', state.htmlClass.includes('linear-sidebar-active'), `class="${state.htmlClass}"`);
assert('all 3 tabs visible in sidebar', state.tabCount === 3, `got ${state.tabCount}`);

// === Test 2: Switch to Broadcast ===
console.log('\n=== Test 2: Switch to Broadcast (sidebar unmount) ===');
await page.evaluate(async () => {
  const tm = await import('/src/themes/_shared/themeManager.js');
  await tm.switchTo('broadcast');
});
await page.waitForTimeout(300);

state = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  sidebar: !!document.querySelector('.linear-sidebar'),
  topnavExists: !!document.querySelector('.topnav'),
  topnavParent: document.querySelector('.topnav')?.parentElement?.tagName,
  bodyPad: getComputedStyle(document.body).paddingLeft,
  htmlClass: document.documentElement.className,
}));
assert('theme switched to broadcast', state.theme === 'broadcast', `got ${state.theme}`);
assert('sidebar unmounted', !state.sidebar, 'sidebar element leaked');
assert('topnav still exists', state.topnavExists, 'topnav vanished on unmount');
assert('topnav restored to BODY', state.topnavParent === 'BODY', `parent=${state.topnavParent}`);
assert('body padding cleared', state.bodyPad === '0px', `got ${state.bodyPad}`);
assert('linear-sidebar-active class removed', !state.htmlClass.includes('linear-sidebar-active'), `class="${state.htmlClass}"`);

// === Test 3: Switch back to Linear ===
console.log('\n=== Test 3: Switch back to Linear (remount) ===');
await page.evaluate(async () => {
  const tm = await import('/src/themes/_shared/themeManager.js');
  await tm.switchTo('linear');
});
await page.waitForTimeout(300);

state = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  sidebar: !!document.querySelector('.linear-sidebar'),
  topnavInside: document.querySelector('.linear-sidebar .topnav') !== null,
  bodyPad: getComputedStyle(document.body).paddingLeft,
}));
assert('theme back to linear', state.theme === 'linear', `got ${state.theme}`);
assert('sidebar remounted', state.sidebar, 'sidebar did not remount');
assert('topnav back inside sidebar', state.topnavInside, 'topnav not in sidebar');
assert('body padding restored', state.bodyPad === '240px', `got ${state.bodyPad}`);

// === Test 4: State persistence through full theme cycle ===
console.log('\n=== Test 4: State persistence through 4-theme cycle ===');
await page.evaluate(async () => {
  const stateMod = await import('/src/core/state.js');
  const s = stateMod.default;
  s.setTeamLevel('t1', '7');
  s.setTeamLevel('t2', '3');
  s.setRoundLevel('A');
});
const expected = { t1: '7', t2: '3', round: 'A' };

for (const t of ['broadcast', 'trading', 'atelier', 'linear']) {
  await page.evaluate(async (theme) => {
    const tm = await import('/src/themes/_shared/themeManager.js');
    await tm.switchTo(theme);
  }, t);
  await page.waitForTimeout(150);
  const after = await page.evaluate(async () => {
    const stateMod = await import('/src/core/state.js');
    return {
      t1: stateMod.default.getTeamLevel('t1'),
      t2: stateMod.default.getTeamLevel('t2'),
      round: stateMod.default.getRoundLevel(),
    };
  });
  const ok = after.t1 === expected.t1 && after.t2 === expected.t2 && after.round === expected.round;
  assert(`state survives switch to ${t}`, ok, `got ${JSON.stringify(after)}`);
}

await browser.close();

const failed = ASSERTIONS.filter(a => !a.ok);
console.log(`\n${ASSERTIONS.length - failed.length}/${ASSERTIONS.length} assertions passed`);
process.exit(failed.length === 0 ? 0 : 1);
