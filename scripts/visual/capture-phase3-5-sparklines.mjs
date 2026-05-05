// Phase 3.5 verification — capture stats-card section (now with sparklines
// under Trading) across all 3 themes at desktop + mobile viewports.
//
// Expected outcome:
//  - broadcast/* + linear/*: 6-column stats table, NO 近况 column
//  - trading/*: 7-column stats table WITH 近况 column showing per-player
//    rank trajectory sparklines
//
// Determinism: uses freezeTime + setDeterministicPlayers + the new
// setDeterministicPlayerStats fixture (FIXED_RANKINGS_8) — replaces the
// 2025 vintage of this script which clicked #randomRanking 5 times in
// the live UI (Math.random unseedable).

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import { freezeTime, setDeterministicPlayers, setDeterministicPlayerStats } from './_fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_BASE = process.env.VISUAL_REPORT_BASE || path.join(ROOT, 'docs/reports');
const OUT = path.join(REPORT_BASE, 'phase3-5-sparklines');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

async function captureSection(page, name, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -10);
  }, selector);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const theme of ['broadcast', 'linear', 'trading']) {
    console.log(`\n=== ${vpName} · ${theme} ===`);
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('  [page error]', msg.text());
    });

    await freezeTime(page);

    // Pre-seed theme + clear stale state BEFORE first navigation. The inline
    // theme bootstrap reads localStorage on every page load, so seeding here
    // means first paint already lands on the right theme.
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('gd_v9_theme', t);
      localStorage.removeItem('gd_v9_state');
      localStorage.removeItem('gd_players');
      localStorage.removeItem('gd_player_stats');
    }, theme);
    await page.reload({ waitUntil: 'networkidle' });

    // 8-player mode + deterministic player roster (fixed emojis + teams).
    await page.waitForSelector('.modeselect__opt[data-mode="8"]', { timeout: 5000 });
    await page.click('.modeselect__opt[data-mode="8"]');
    await page.waitForTimeout(150);
    await page.click('#generatePlayers');
    await page.waitForTimeout(300);
    await page.click('#shuffleTeams');
    await page.waitForTimeout(200);
    await setDeterministicPlayers(page, 8);

    // Inject 5-round ranking history directly into state — replaces the old
    // loop of #randomRanking + #manualCalc + #apply + #advance × 5.
    await setDeterministicPlayerStats(page, 8);

    // Force the stats card to repaint with the new state. The renderer
    // listens to stats:updated, but explicitly invoking it post-injection
    // guards against ordering races.
    await page.evaluate(async () => {
      const statsMod = await import('/src/stats/statistics.js');
      statsMod.renderStatistics();
    });
    await page.waitForTimeout(200);

    await captureSection(page, `${vpName}-${theme}-stats`, '.stats-card');

    await ctx.close();
  }
}

await browser.close();
console.log(`\nSAVED: ${OUT}`);
