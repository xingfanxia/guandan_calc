// Cross-theme victory modal verification — captures the championship state
// for all 4 registered themes after the 2026-05-05 victoryModal class
// refactor. Outputs to docs/reports/victory-cross-theme/.
//
// Per the discipline "Port fixes across themes" — we changed shared
// markup (index.html) and shared JS (victoryModal.js), so each theme
// needs visual verification, not just Atelier.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import { setDeterministicPlayers, freezeTime } from './_fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const REPORT_BASE = process.env.VISUAL_REPORT_BASE || path.join(ROOT, 'docs/reports');
const REPORT_DIR = path.join(REPORT_BASE, 'victory-cross-theme');

await mkdir(REPORT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const URL = process.env.GD_PROD ? 'http://localhost:4173/' : 'http://localhost:3000/';
const THEMES = ['broadcast', 'linear', 'trading', 'atelier', 'teatable'];

// Freeze Date.now BEFORE page load — see _fixtures.mjs.
await freezeTime(page);

await page.goto(URL, { waitUntil: 'domcontentloaded' });

for (const theme of THEMES) {
  await page.evaluate((t) => { localStorage.setItem('gd_v9_theme', t); }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#mode', { timeout: 5000 });

  // Set up a minimal fixture so the MVP-tagline path doesn't blow up
  await page.selectOption('#mode', '6');
  await page.waitForTimeout(150);
  await page.click('#generatePlayers');
  await page.waitForTimeout(300);
  const shuffleBtn = await page.$('#shuffleTeams');
  if (shuffleBtn) await shuffleBtn.click();
  await page.waitForTimeout(200);

  // Override emojis + team assignment to deterministic state.
  await setDeterministicPlayers(page, 6);

  // Trigger victory modal
  await page.evaluate(async () => {
    const modal = await import('/src/ui/victoryModal.js');
    await modal.showVictoryModal('红队');
  });
  await page.waitForTimeout(500);

  const dataTheme = await page.getAttribute('html', 'data-theme');
  console.log(`[${theme}] data-theme=${dataTheme}`);

  const victoryEl = await page.$('#victoryModal');
  if (victoryEl) {
    await victoryEl.screenshot({
      path: path.join(REPORT_DIR, `victory-${theme}.png`),
    });
  }

  // Mobile pass too
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const victoryMobileEl = await page.$('#victoryModal');
  if (victoryMobileEl) {
    await victoryMobileEl.screenshot({
      path: path.join(REPORT_DIR, `victory-${theme}-mobile.png`),
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Close the modal before next theme so reload doesn't carry state
  await page.evaluate(() => {
    const modal = document.getElementById('victoryModal');
    if (modal) modal.style.display = 'none';
  });
}

console.log('SAVED:', REPORT_DIR);
await browser.close();
