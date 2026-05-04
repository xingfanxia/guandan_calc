// Inspect actual slot DOM after random ranking.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.selectOption('#mode', '6');
await page.waitForTimeout(150);
await page.click('#generatePlayers');
await page.waitForTimeout(300);
await page.click('#shuffleTeams');
await page.waitForTimeout(300);
await page.click('#randomRanking');
await page.waitForTimeout(500);

const ranking = await page.evaluate(async () => {
  const stateMod = await import('/src/core/state.js');
  return stateMod.default.getCurrentRanking();
});
console.log('state.currentRanking:', JSON.stringify(ranking));

const slots = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('#rankingArea > *')).map(el => ({
    tag: el.tagName,
    classes: el.className,
    rank: el.dataset.rank,
    text: (el.textContent || '').trim().slice(0, 40)
  }));
});
console.log('rankingArea children:');
slots.forEach(s => console.log('  ', JSON.stringify(s)));

await browser.close();
