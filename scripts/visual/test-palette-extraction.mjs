import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const URL = 'http://localhost:3000/';

for (const theme of ['broadcast', 'linear', 'trading', 'atelier']) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    Object.keys(localStorage).filter(k => k.startsWith('gd_v9_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('gd_v9_theme', t);
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#mode:not([disabled])', { timeout: 5000 });
  await page.waitForTimeout(300);

  const result = await page.evaluate(async () => {
    const dataTheme = document.documentElement.getAttribute('data-theme');
    const pm = await import('/src/themes/_shared/themePalette.js');
    const palette = pm.getActiveThemePalette();
    return { dataTheme, palette };
  });
  console.log(`${theme}: data-theme=${result.dataTheme}`);
  console.log(`  bg=${result.palette.bg}`);
  console.log(`  ink=${result.palette.ink}`);
  console.log(`  accent=${result.palette.accent}`);
}
await browser.close();
