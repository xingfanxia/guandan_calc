// Verify cross-page theme bootstrap: a saved theme must apply on first paint
// (not after a flash) on every page that has the inline bootstrap.

import { chromium } from 'playwright';

const URL_BASE = process.env.APP_URL || 'http://localhost:3000';
const PAGES = ['/', '/players.html', '/player-profile.html', '/rooms.html'];
const THEMES_TO_TEST = ['trading', 'linear', 'atelier'];

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

let failures = 0;

for (const theme of THEMES_TO_TEST) {
  // Seed localStorage by visiting index first.
  await page.goto(URL_BASE + '/');
  await page.evaluate((t) => localStorage.setItem('gd_v9_theme', t), theme);

  for (const pagePath of PAGES) {
    await page.goto(URL_BASE + pagePath);
    // Read the data-theme attribute IMMEDIATELY after navigation completes.
    // The inline bootstrap should have set it before any paint.
    const dataTheme = await page.evaluate(
      () => document.documentElement.getAttribute('data-theme'),
    );
    const ok = dataTheme === theme;
    console.log(`  ${ok ? '✓' : '✗'}  ${pagePath} with saved=${theme} → data-theme="${dataTheme}"`);
    if (!ok) failures += 1;
  }
}

// Clear and verify default fallback also works.
await page.goto(URL_BASE + '/');
await page.evaluate(() => localStorage.removeItem('gd_v9_theme'));
for (const pagePath of PAGES) {
  await page.goto(URL_BASE + pagePath);
  const dataTheme = await page.evaluate(
    () => document.documentElement.getAttribute('data-theme'),
  );
  const ok = dataTheme === 'linear';
  console.log(`  ${ok ? '✓' : '✗'}  ${pagePath} no saved → data-theme="${dataTheme}" (expect linear)`);
  if (!ok) failures += 1;
}

// Verify invalid saved value falls back to the static <html> default.
await page.goto(URL_BASE + '/');
await page.evaluate(() => localStorage.setItem('gd_v9_theme', 'evil-payload'));
await page.goto(URL_BASE + '/players.html');
const dataTheme = await page.evaluate(
  () => document.documentElement.getAttribute('data-theme'),
);
const ok = dataTheme === 'linear';
console.log(`  ${ok ? '✓' : '✗'}  /players.html with saved="evil-payload" → data-theme="${dataTheme}" (expect linear)`);
if (!ok) failures += 1;

await browser.close();

console.log(`\n${failures === 0 ? '✓ ALL PASS' : `✗ ${failures} FAILURES`}`);
process.exit(failures === 0 ? 0 : 1);
