// Final mobile QC — verify rank-placement (pool LEFT, slots RIGHT both
// aligned compact) AND scoreboard (RED LEFT, BLUE RIGHT side-by-side) for
// all three themes.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const OUT = path.join(ROOT, 'docs/reports/mobile-final-2026-05-04');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());

for (const theme of ['broadcast', 'linear', 'trading']) {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => { localStorage.setItem('gd_v9_theme', t); localStorage.removeItem('gd_v9_state'); }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  // The native <select id="mode"> is now SR-only across all themes; click
  // the visible chip button instead. The inline sync script in index.html
  // mirrors the chip click into the native select.
  await page.waitForSelector('.modeselect__opt[data-mode="8"]', { timeout: 5000 });
  await page.click('.modeselect__opt[data-mode="8"]');
  await page.waitForTimeout(200);
  await page.click('#generatePlayers');
  await page.waitForTimeout(400);
  const shuffleBtn = await page.$('#shuffleTeams');
  if (shuffleBtn) await shuffleBtn.click();
  await page.waitForTimeout(300);

  // Scoreboard view (RED LEFT, BLUE RIGHT)
  await page.evaluate(() => {
    const sb = document.querySelector('.scorer');
    if (sb) sb.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -10);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${theme}-scoreboard.png`), fullPage: false });

  // Rank placement view (pool LEFT, slots RIGHT)
  await page.evaluate(() => {
    const ag = document.querySelector('.activegame, #rankingSection');
    if (ag) ag.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -10);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${theme}-rank-placement.png`), fullPage: false });

  console.log(`captured ${theme}`);
}

console.log('SAVED:', OUT);
await browser.close();
