// Verify the rebuilt theme picker — navbar dropdown trigger + opened panel
// at desktop AND mobile widths, all three themes.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const OUT = path.join(ROOT, 'docs/reports/picker-dropdown-2026-05-04');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

for (const viewport of [{ w: 1280, h: 900, label: 'desktop' }, { w: 390, h: 844, label: 'mobile' }]) {
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());

  for (const theme of ['broadcast', 'linear', 'trading']) {
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('gd_v9_theme', t); }, theme);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#themePicker', { timeout: 5000 });
    await page.waitForTimeout(200);

    // Closed state — capture the navbar
    await page.screenshot({
      path: path.join(OUT, `${theme}-${viewport.label}-closed.png`),
      clip: { x: 0, y: 0, width: viewport.w, height: 90 }
    });

    // Open the picker
    await page.click('#themePicker .theme-picker__trigger');
    await page.waitForTimeout(150);

    await page.screenshot({
      path: path.join(OUT, `${theme}-${viewport.label}-open.png`),
      clip: { x: 0, y: 0, width: viewport.w, height: 320 }
    });
    console.log(`captured ${theme} ${viewport.label}`);
  }
  await ctx.close();
}

console.log('SAVED:', OUT);
await browser.close();
