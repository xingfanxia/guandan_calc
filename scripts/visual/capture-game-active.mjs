// Capture index.html with game in progress to verify setup-section hiding works.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_DIR = path.join(ROOT, 'docs/reports/audit-pages');
await mkdir(REPORT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

page.on('dialog', async d => await d.accept());
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.selectOption('#mode', '6');
await page.waitForTimeout(150);
await page.click('#generatePlayers');
await page.waitForTimeout(300);
await page.click('#shuffleTeams');
await page.waitForTimeout(300);

// Disable autoApply so the random ranking sticks visible
await page.evaluate(() => {
  const cb = document.getElementById('autoApply');
  if (cb && cb.checked) cb.click();
});
await page.waitForTimeout(150);

// Click random — this places ranking → triggers gameHasBegun → setupVisibility hides
await page.click('#randomRanking');
await page.waitForTimeout(500);

await page.screenshot({
  path: path.join(REPORT_DIR, 'index-active-desktop.png'),
  fullPage: true
});
console.log('SAVED: index-active-desktop.png');

// Mobile version
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageM = await ctxM.newPage();
pageM.on('dialog', async d => await d.accept());
await pageM.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await pageM.selectOption('#mode', '6');
await pageM.waitForTimeout(150);
await pageM.click('#generatePlayers');
await pageM.waitForTimeout(300);
await pageM.click('#shuffleTeams');
await pageM.waitForTimeout(300);
await pageM.evaluate(() => { const cb = document.getElementById('autoApply'); if (cb && cb.checked) cb.click(); });
await pageM.waitForTimeout(150);
await pageM.click('#randomRanking');
await pageM.waitForTimeout(500);
await pageM.screenshot({
  path: path.join(REPORT_DIR, 'index-active-mobile.png'),
  fullPage: true
});
console.log('SAVED: index-active-mobile.png');

await browser.close();
