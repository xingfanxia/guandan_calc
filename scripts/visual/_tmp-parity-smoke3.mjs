import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// Pre-game: mode radio buttons drive hidden select + re-render slots
await page.click('#quickStart');
await page.waitForTimeout(300);
await page.click('.modeselect__opt[data-mode="4"]');
await page.waitForTimeout(400);
const m4 = await page.evaluate(() => ({
  select: document.getElementById('mode')?.value,
  active: document.querySelector('.modeselect__opt--active')?.dataset.mode,
  slots: document.querySelectorAll('#rankingArea .rank-slot').length,
}));
console.log('mode->4:', JSON.stringify(m4));
await page.click('.modeselect__opt[data-mode="8"]');
await page.waitForTimeout(400);

// Record a round, then undo restores setup sections + removes history row
await page.click('#quickStart');
await page.waitForTimeout(300);
await page.click('#randomRanking'); // autoApply ON -> records round
await page.waitForTimeout(400);
const afterApply = await page.evaluate(() => ({
  hist: document.querySelectorAll('.history__row').length,
  modeselectVisible: getComputedStyle(document.querySelector('.modeselect')).display !== 'none',
}));
console.log('after auto-apply:', JSON.stringify(afterApply));
await page.click('#undo');
await page.waitForTimeout(400);
const afterUndo = await page.evaluate(() => ({
  hist: document.querySelectorAll('.history__row').length,
  modeselectVisible: getComputedStyle(document.querySelector('.modeselect')).display !== 'none',
}));
console.log('after undo:', JSON.stringify(afterUndo));

// resetMatch (accept confirm dialog if any)
page.on('dialog', (d) => d.accept());
await page.click('#resetMatch');
await page.waitForTimeout(400);
const afterReset = await page.evaluate(() => ({
  hist: document.querySelectorAll('.history__row').length,
  t1: document.getElementById('t1Lvl')?.textContent,
  t2: document.getElementById('t2Lvl')?.textContent,
}));
console.log('after resetMatch:', JSON.stringify(afterReset));

// exportTxt triggers a download (no crash)
const dl = page.waitForEvent('download', { timeout: 5000 }).then(() => 'download-ok').catch(() => 'no-download');
await page.click('#exportTxt');
console.log('exportTxt:', await dl);

console.log('pageErrors:', pageErrors.length ? pageErrors.slice(0, 5) : 'none');
await browser.close();
