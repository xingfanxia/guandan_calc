// Capture all 4 pages — index (game view), players, rooms, player-profile.
// Both desktop and mobile widths.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_DIR = path.join(ROOT, 'docs/reports/audit-pages');
await mkdir(REPORT_DIR, { recursive: true });

const browser = await chromium.launch();

const widths = [
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } }
];

const pages = [
  { name: 'index-empty', url: 'http://localhost:3000/' },
  { name: 'players', url: 'http://localhost:3000/players.html' },
  { name: 'rooms', url: 'http://localhost:3000/rooms.html' }
];

for (const w of widths) {
  for (const pg of pages) {
    const ctx = await browser.newContext({ viewport: w.viewport });
    const page = await ctx.newPage();
    page.on('dialog', async d => await d.accept());
    await page.goto(pg.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(REPORT_DIR, `${pg.name}-${w.name}.png`),
      fullPage: true
    });
    console.log('SAVED:', `${pg.name}-${w.name}.png`);
    await ctx.close();
  }
}

await browser.close();
