// Phase 3.5 verification — capture stats-card section (now with sparklines
// under Trading) across all 3 themes at desktop + mobile viewports.
//
// Expected outcome:
//  - broadcast/* + linear/*: 6-column stats table, NO 近况 column
//  - trading/*: 7-column stats table WITH 近况 column showing per-player
//    rank trajectory sparklines

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const OUT = path.join(ROOT, 'docs/reports/phase3-5-sparklines');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

async function setupGameWithHistory(page) {
  await page.waitForSelector('.modeselect__opt[data-mode="8"]', { timeout: 5000 });
  await page.click('.modeselect__opt[data-mode="8"]');
  await page.waitForTimeout(150);
  await page.click('#generatePlayers');
  await page.waitForTimeout(300);
  await page.click('#shuffleTeams');
  await page.waitForTimeout(200);
  for (let i = 0; i < 5; i++) {
    await page.click('#randomRanking');
    await page.waitForTimeout(150);
    await page.click('#manualCalc');
    await page.waitForTimeout(150);
    const apply = await page.$('#apply');
    if (apply) {
      await apply.click();
      await page.waitForTimeout(200);
    }
    const adv = await page.$('#advance');
    if (adv) {
      await adv.click();
      await page.waitForTimeout(150);
    }
  }
}

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

    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('gd_v9_theme', t);
      localStorage.removeItem('gd_v9_state');
      localStorage.removeItem('gd_players');
      localStorage.removeItem('gd_player_stats');
    }, theme);
    await page.reload({ waitUntil: 'networkidle' });

    await setupGameWithHistory(page);

    await captureSection(page, `${vpName}-${theme}-stats`, '.stats-card');

    await ctx.close();
  }
}

await browser.close();
console.log(`\nCaptures written to: ${OUT}`);
