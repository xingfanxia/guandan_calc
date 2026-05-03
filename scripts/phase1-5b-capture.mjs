// Capture populated state of the Broadcast theme.
// Boots Chromium, generates 8 players, shuffles teams, places only 3 of 8 to
// produce filled + target + empty slot states, then captures both full-page and
// activegame-section screenshots.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const REPORT_DIR = path.join(ROOT, 'docs/reports/phase1-5b-populated');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`CONSOLE: ${msg.text()}`);
});

// Auto-accept any confirmation dialogs (e.g. "regenerate players?")
page.on('dialog', async (d) => { await d.accept(); });

// Default to dev (3000) for state-singleton access. Pass GD_PROD=1 to run against
// the production preview (4173) — but partial-state mutation won't work there
// because /src/ paths are bundled.
const URL = process.env.GD_PROD ? 'http://localhost:4173/' : 'http://localhost:3000/';
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('#mode', { timeout: 5000 });

// 8-player mode
await page.selectOption('#mode', '8');
await page.waitForTimeout(150);

// Generate default players
await page.click('#generatePlayers');
await page.waitForTimeout(400);

// Shuffle teams
const shuffleBtn = await page.$('#shuffleTeams');
if (shuffleBtn) await shuffleBtn.click();
await page.waitForTimeout(300);

// Disable auto-apply so random-ranking doesn't immediately settle and reset.
// `#autoApply` checkbox controls this. If unchecked, slots stay filled.
await page.evaluate(() => {
  const cb = document.getElementById('autoApply');
  if (cb && cb.checked) cb.click();
});
await page.waitForTimeout(150);

// Random ranking populates all 8 slots
const randomBtn = await page.$('#randomRanking');
if (randomBtn) await randomBtn.click();
await page.waitForTimeout(400);

// `currentRanking` lives in the state singleton (NOT persisted to localStorage).
// Approach: simulate manual drag of slots 4-8 back to pool — the existing
// `clearRanking` button clears ALL, so we drag-back individual ones via the
// elementFromPoint trick. Easiest: read the active player IDs from the
// rendered DOM and re-build a partial ranking by clicking pool tiles' counter
// — but there's no UI for that.
//
// Cleaner: synthesise drag events on rank-slots 4-8 to drop their player back
// onto the pool. We do this by directly invoking the existing `handlePoolDrop`
// path via a helper that the renderer exposes. Easier still: walk through the
// current rank-slots, read the player ID from each, and re-trigger the same
// pool-drop event by dispatching a programmatic drag.
//
// Path of least resistance: extract the current ranking via the state singleton
// (it's importable as default export from /src/core/state.js but not on window
// by default). We'll inject a one-shot `script` that imports state.js as an
// ES module and exposes the in-flight ranking through a window hook.
await page.evaluate(async () => {
  // Dynamic import of the live state singleton + ranking renderer
  const stateMod = await import('/src/core/state.js');
  const rendererMod = await import('/src/ranking/rankingRenderer.js');
  const state = stateMod.default;
  const ranking = state.getCurrentRanking();
  // Keep only ranks 1, 2, 3
  const trimmed = {};
  for (const k of ['1', '2', '3']) {
    if (ranking[k] != null) trimmed[k] = ranking[k];
  }
  state.setCurrentRanking(trimmed);
  // Re-render the slots to reflect the new state
  rendererMod.renderRankingArea(8);
});

await page.waitForTimeout(500);

// Captures
await page.screenshot({
  path: path.join(REPORT_DIR, 'index-populated.png'),
  fullPage: true,
});

const activegame = await page.$('.activegame');
if (activegame) {
  await activegame.screenshot({ path: path.join(REPORT_DIR, 'activegame-section.png') });
}
const pool = await page.$('#playerPool');
if (pool) {
  await pool.screenshot({ path: path.join(REPORT_DIR, 'pool-tiles.png') });
}
const slotsArea = await page.$('#rankingArea');
if (slotsArea) {
  await slotsArea.screenshot({ path: path.join(REPORT_DIR, 'slots-mixed-states.png') });
}

console.log('SAVED:', REPORT_DIR);
if (consoleErrors.length) {
  console.log('CONSOLE ISSUES (network 404s expected in preview):');
  for (const e of consoleErrors) console.log(' ', e);
}

await browser.close();
