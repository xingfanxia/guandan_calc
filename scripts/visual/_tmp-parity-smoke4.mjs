import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('dialog', (d) => d.accept());
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.click('#quickStart');
await page.waitForTimeout(300);
await page.click('#randomRanking');
await page.waitForTimeout(400);
const before = await page.evaluate(() => document.querySelectorAll('.history__row').length);
await page.click('#undo');
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({
  hist: document.querySelectorAll('.history__row').length,
  modeselectVisible: getComputedStyle(document.querySelector('.modeselect')).display !== 'none',
}));
console.log('undo (confirm accepted):', JSON.stringify({ before, ...after }));

// MOBILE 390px: are the key controls still visible/tappable?
const ids = ['quickStart','generatePlayers','shuffleTeams','randomRanking','clearRanking','manualCalc','apply','advance','undo','resetMatch','exportTxt','exportMobilePng','shareGame','createRoom'];
for (const id of ids) {
  const r = await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return 'missing';
    const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
    return (cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0) ? 'visible' : `hidden(${cs.display},${b.width}x${b.height})`;
  }, id);
  if (r !== 'visible') console.log(`MOBILE ${id}: ${r}`);
}
console.log('mobile visibility sweep done');
console.log('pageErrors:', pageErrors.length ? pageErrors.slice(0,5) : 'none');
await browser.close();
