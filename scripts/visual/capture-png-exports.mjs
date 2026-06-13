// Capture light/dark PNG export baselines.
//
// Verifies that `src/export/exportMobile.js` reads the active mode's tokens
// (via src/styles/themePalette.js) when drawing the canvas. Runs the export
// in-page (monkey-patches `<a>.click()` to capture the dataURL instead of
// triggering a download), then writes one PNG per mode to
// docs/reports/png-export/.
//
// Failure mode this catches: regressions to hardcoded-hex canvas colors —
// the light export must show off-white paper + felt-green accent, the dark
// export green-tinted near-black.

import { chromium } from 'playwright';
import path from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { setDeterministicPlayers, freezeTime } from './_fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_BASE = process.env.VISUAL_REPORT_BASE || path.join(ROOT, 'docs/reports');
const REPORT_DIR = path.join(REPORT_BASE, 'png-export');
mkdirSync(REPORT_DIR, { recursive: true });

const URL = (process.env.GD_BASE_URL || 'http://localhost:3000') + '/';
const THEMES = ['light', 'dark'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// Index's player-search block calls /api/players/list on load — no backend
// under `vite dev`, so fulfill with an empty set (predicate, not glob, so
// /src/api/*.js module loads are untouched).
await ctx.route(
  (url) => url.pathname.startsWith('/api/'),
  (route) => route.fulfill({ json: { success: true, players: [], rooms: [], total: 0, pagination: { total: 0, hasNext: false } } })
);
const page = await ctx.newPage();

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`CONSOLE: ${msg.text()}`);
});
page.on('dialog', async (d) => { await d.accept(); });

// Freeze Date.now BEFORE page load — see _fixtures.mjs.
await freezeTime(page);

for (const theme of THEMES) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // Clear ALL persisted state (history lives under gd_v7_5_1_*, players
  // under gd_players) but set the new theme — without this, the second
  // iteration's mode selector is disabled because the prior fixture set
  // history.length > 0.
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('gd_v9_theme', t);
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  // A blank load shows the room gate, which hides the setup UI. This capture
  // drives the local setup directly, so lift the gate first.
  await page.evaluate(() => {
    document.querySelector('main.wrap')?.classList.remove('wrap--gated');
    document.body.classList.remove('app-gated');
  });
  // The native #mode select is visually hidden (the seg control drives it),
  // so wait for attachment and drive it via the DOM instead of selectOption.
  await page.waitForSelector('#mode:not([disabled])', { timeout: 5000, state: 'attached' });

  await page.evaluate(() => {
    const sel = document.getElementById('mode');
    sel.value = '6';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  await page.click('#generatePlayers');
  await page.waitForTimeout(300);

  // Override emojis + team assignment to deterministic state.
  await setDeterministicPlayers(page, 6);

  // Seed minimal fixture — needs at least 1 history entry plus team levels
  // for the export to render meaningful content (header, MVP block, honors).
  await page.evaluate(async () => {
    const stateMod = await import('/src/core/state.js');
    const histMod = await import('/src/game/history.js');
    const teamMod = await import('/src/ui/teamDisplay.js');
    const playerMgrMod = await import('/src/player/playerManager.js');
    const state = stateMod.default;

    const fakeHistory = [
      { ts: '12:01', mode: '6', win: '红', winKey: 't2', combo: '1, 2, 5', up: 2, t1: '2', t2: '4', round: '2', aNote: '', prevT1Lvl: '2', prevT2Lvl: '2', prevT1A: 0, prevT2A: 0, prevRound: '2', prevRoundOwner: null },
      { ts: '12:30', mode: '6', win: '红', winKey: 't2', combo: '1, 2, 3', up: 3, t1: '2', t2: '7', round: '4', aNote: '', prevT1Lvl: '2', prevT2Lvl: '4', prevT1A: 0, prevT2A: 0, prevRound: '4', prevRoundOwner: 't2' },
      { ts: '13:00', mode: '6', win: '红', winKey: 't2', combo: '1, 3, 4', up: 0, t1: '2', t2: 'A', round: 'A', aNote: '红队 A级通关（胜方无末游，在自己的A级）', gameStatus: { ended: true, winnerKey: 't2', winnerName: '红队', reason: 'A_LEVEL_CLEARED' }, prevT1Lvl: '2', prevT2Lvl: '7', prevT1A: 0, prevT2A: 0, prevRound: '7', prevRoundOwner: 't2' },
    ];
    state.setHistory(fakeHistory);
    state.setTeamLevel('t1', '2');
    state.setTeamLevel('t2', 'A');
    state.setRoundLevel('A');

    // Seed minimal stats so the honors loop has data to render
    const players = playerMgrMod.getPlayers();
    const stats = {};
    players.forEach((p, i) => {
      stats[p.id] = {
        games: 3, rounds: 3,
        rankings: [1, 2, i % 6 + 1],
        totalRank: 4 + i,
        firstPlaceCount: i < 3 ? 1 : 0,
        lastPlaceCount: i >= 3 ? 1 : 0,
        teamWins: i < 3 ? 3 : 0,
      };
    });
    state.setPlayerStats(stats);

    histMod.renderHistory();
    teamMod.renderTeams();
  });

  await page.waitForTimeout(300);

  // Run the export, intercept the auto-download `<a>.click()`, capture dataURL
  const dataUrl = await page.evaluate(async () => {
    const exportMod = await import('/src/export/exportMobile.js');
    let captured = null;
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.href && this.href.startsWith('data:image/')) {
        captured = this.href;
      } else if (origClick) {
        origClick.call(this);
      }
    };
    try {
      await exportMod.exportMobilePNG();
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
    return captured;
  });

  if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
    const base64 = dataUrl.split(',')[1];
    const outPath = path.join(REPORT_DIR, `export-${theme}.png`);
    writeFileSync(outPath, Buffer.from(base64, 'base64'));
    console.log(`SAVED export-${theme}.png`);
  } else {
    console.error(`FAILED to capture dataURL for ${theme}`);
  }
}

await browser.close();

if (consoleErrors.length) {
  console.error('CONSOLE/PAGE ERRORS:');
  consoleErrors.forEach(e => console.error('  ' + e));
  process.exit(1);
}
console.log('SAVED:', REPORT_DIR);
