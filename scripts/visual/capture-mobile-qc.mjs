// Mobile QC — verifies the actual user-facing problems:
//   (a) Navbar fits in 390px without overflow / wrapping / piling up
//   (b) Pool and rank-slots both fit one viewport during gameplay
// Per theme, capture: navbar-only crop, then gameplay-state with active
// game scrolled into view (pool + slots both visible).
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

for (const theme of ['broadcast', 'linear', 'trading']) {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => { localStorage.setItem('gd_v9_theme', t); localStorage.removeItem('gd_v9_state'); }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#mode', { timeout: 5000 });
  await page.selectOption('#mode', '6');
  await page.waitForTimeout(200);
  await page.click('#generatePlayers');
  await page.waitForTimeout(400);
  const shuffleBtn = await page.$('#shuffleTeams');
  if (shuffleBtn) await shuffleBtn.click();
  await page.waitForTimeout(300);

  // === Navbar QC: top 90px crop
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({
    path: path.join(OUT, `${theme}-navbar.png`),
    clip: { x: 0, y: 0, width: 390, height: 90 }
  });

  // === Gameplay rank-placement QC: scroll active game into view, capture
  // a 700px-tall viewport so pool + slots are both visible.
  await page.evaluate(() => {
    const ag = document.querySelector('.activegame, #rankingSection');
    if (ag) ag.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -10);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${theme}-rank-placement.png`), fullPage: false });

  console.log(`captured ${theme}`);
}

console.log('SAVED:', OUT);
await browser.close();
