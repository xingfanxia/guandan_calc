// Follow-up: randomRanking with autoApply ON should auto-apply (history grows),
// with autoApply OFF should leave slots filled; apply button then records.
// Also: mode radio-group buttons drive the hidden native select.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);

await page.click('#quickStart');
await page.waitForTimeout(300);

// autoApply ON (default): randomRanking should auto-apply → history rows +1, slots reset
const histBefore = await page.evaluate(() => document.querySelectorAll('#history .history__row, #historyBody .history__row, .history__row').length);
await page.click('#randomRanking');
await page.waitForTimeout(400);
const r1 = await page.evaluate(() => ({
  hist: document.querySelectorAll('.history__row').length,
  filled: document.querySelectorAll('#rankingArea .rank-slot.slot--filled').length,
  tip: document.getElementById('applyTip')?.textContent,
}));
console.log('autoApply ON randomRanking:', JSON.stringify({ histBefore, ...r1 }));

// turn autoApply OFF
await page.evaluate(() => { const cb = document.getElementById('autoApply'); if (cb.checked) cb.click(); });
await page.waitForTimeout(200);
await page.click('#randomRanking');
await page.waitForTimeout(400);
const r2 = await page.evaluate(() => ({
  filled: document.querySelectorAll('#rankingArea .rank-slot.slot--filled').length,
  slots: document.querySelectorAll('#rankingArea .rank-slot').length,
  tip: document.getElementById('applyTip')?.textContent,
}));
console.log('autoApply OFF randomRanking:', JSON.stringify(r2));

// apply button records the round
const histBefore2 = await page.evaluate(() => document.querySelectorAll('.history__row').length);
await page.click('#apply');
await page.waitForTimeout(400);
const r3 = await page.evaluate(() => ({
  hist: document.querySelectorAll('.history__row').length,
  filled: document.querySelectorAll('#rankingArea .rank-slot.slot--filled').length,
  firstRoundLabel: document.querySelector('.history__round')?.textContent,
}));
console.log('after #apply:', JSON.stringify({ histBefore2, ...r3 }));

// mode radio buttons drive hidden select + slot count
await page.click('.modeselect__opt[data-mode="4"]');
await page.waitForTimeout(400);
const r4 = await page.evaluate(() => ({
  select: document.getElementById('mode')?.value,
  active: document.querySelector('.modeselect__opt--active')?.dataset.mode,
}));
console.log('mode switch to 4:', JSON.stringify(r4));

// undo button
await page.click('#undo');
await page.waitForTimeout(300);
const r5 = await page.evaluate(() => document.querySelectorAll('.history__row').length);
console.log('history rows after undo:', r5);

console.log('pageErrors:', pageErrors.length ? pageErrors.slice(0, 5) : 'none');
await browser.close();
