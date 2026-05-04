// Comprehensive mobile QC for HANDOFF-2026-05-04 fixes.
// Seeds an 8-player session, plays a few rounds (so honors + history populate),
// then captures: scoreboard, rank-placement, history+stats, honors, team-honors.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const OUT = path.join(ROOT, 'docs/reports/mobile-qc-2026-05-04');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
page.on('console', msg => {
  if (msg.type() === 'error') console.log('  [page error]', msg.text());
});

async function captureSection(theme, name, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -10);
  }, selector);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${theme}-${name}.png`), fullPage: false });
}

async function setupGameWithHistory(page) {
  // Mode 8 via chip
  await page.waitForSelector('.modeselect__opt[data-mode="8"]', { timeout: 5000 });
  await page.click('.modeselect__opt[data-mode="8"]');
  await page.waitForTimeout(150);

  // Generate + shuffle
  await page.click('#generatePlayers');
  await page.waitForTimeout(300);
  await page.click('#shuffleTeams');
  await page.waitForTimeout(200);

  // Play a few rounds — apply ranking via the "随机排名" + "应用结果" flow.
  // 5 rounds is enough to populate history + stats + honors.
  for (let i = 0; i < 5; i++) {
    await page.click('#randomRanking');
    await page.waitForTimeout(150);
    await page.click('#manualCalc');
    await page.waitForTimeout(150);
    const applyBtn = await page.$('#apply');
    if (applyBtn) {
      await applyBtn.click();
      await page.waitForTimeout(200);
    }
    // Advance round
    const advBtn = await page.$('#advance');
    if (advBtn) {
      await advBtn.click();
      await page.waitForTimeout(150);
    }
  }
}

for (const theme of ['broadcast', 'linear', 'trading']) {
  console.log(`\n=== ${theme} ===`);
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('gd_v9_theme', t);
    localStorage.removeItem('gd_v9_state');
    localStorage.removeItem('gd_players');
    localStorage.removeItem('gd_player_stats');
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });

  await setupGameWithHistory(page);

  // 1. Scoreboard
  await captureSection(theme, 'scoreboard', '.scorer');
  // 2. Setup section (post-shuffle: shows team rosters in 2-col grid)
  await captureSection(theme, 'setup-roster', '#playerSetupSection');
  // 3. Rank placement (after random ranking + apply, the ranking area shows)
  await captureSection(theme, 'rank-placement', '#rankingSection');
  // 4. History
  await captureSection(theme, 'history', '.history');
  // 5. Stats table
  await captureSection(theme, 'stats', '.stats-card');
  // 6. Team awards
  await captureSection(theme, 'team-honors', '.team-honors');
  // 7. Honors gallery
  await captureSection(theme, 'honors', '.honors');

  console.log(`captured ${theme}: 7 sections`);
}

console.log('\nSAVED:', OUT);
await browser.close();
