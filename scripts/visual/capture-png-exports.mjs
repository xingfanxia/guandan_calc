// Capture cross-theme PNG export baselines.
//
// Verifies that `src/export/exportMobile.js` actually produces different
// looking exports under each theme after the 2026-05-05 palette-aware
// refactor. Runs the export in-page (monkey-patches `<a>.click()` to
// capture the dataURL instead of triggering a download), then writes
// 4 PNGs to docs/reports/png-export-themes/ — one per registered theme.
//
// Failure mode this catches: regressions to the hardcoded-hex pre-refactor
// state. Visual diff between the four outputs should be obvious — Atelier
// shows clay accent + warm graphite bg, Linear shows purple accent on
// cool graphite, Trading shows amber on near-black, Broadcast shows the
// editorial orange-on-deep-black baseline.

import { chromium } from 'playwright';
import path from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { setDeterministicPlayers, freezeTime } from './_fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_BASE = process.env.VISUAL_REPORT_BASE || path.join(ROOT, 'docs/reports');
const REPORT_DIR = path.join(REPORT_BASE, 'png-export-themes');
mkdirSync(REPORT_DIR, { recursive: true });

const URL = process.env.GD_PROD ? 'http://localhost:4173/' : 'http://localhost:3000/';
const THEMES = ['broadcast', 'linear', 'trading', 'atelier'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
  // Clear all gd_v9_* state (history, ranking, players) but set the new
  // theme — without this, the second iteration's mode selector is disabled
  // because the prior fixture set history.length > 0.
  await page.evaluate((t) => {
    Object.keys(localStorage).filter(k => k.startsWith('gd_v9_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('gd_v9_theme', t);
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#mode:not([disabled])', { timeout: 5000 });

  await page.selectOption('#mode', '6');
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

if (consoleErrors.length) {
  console.log('CONSOLE/PAGE ERRORS:', consoleErrors);
}
console.log('SAVED:', REPORT_DIR);
await browser.close();
