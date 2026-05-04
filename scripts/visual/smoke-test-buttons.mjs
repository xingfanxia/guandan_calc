// Quick smoke test — try every primary button and report which ones fail.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}\n  at: ${e.stack?.split('\n').slice(1, 3).join(' | ')}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`);
});
page.on('dialog', async (d) => { console.log('  dialog:', d.message()); await d.accept(); });

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForSelector('#mode', { timeout: 5000 });

console.log('--- INITIAL LOAD ---');
console.log(`  errors so far: ${errors.length}`);

// Test 1: select mode
console.log('\n[T1] selectOption #mode = 6');
await page.selectOption('#mode', '6');
await page.waitForTimeout(150);

// Test 2: generate players
console.log('[T2] click #generatePlayers');
const beforeGen = errors.length;
await page.click('#generatePlayers');
await page.waitForTimeout(400);
const playersCount = await page.evaluate(() => document.querySelectorAll('#unassignedPlayers .player-tile').length);
console.log(`  result: ${playersCount} player tiles in #unassignedPlayers`);
if (errors.length > beforeGen) console.log(`  errors gained: ${errors.length - beforeGen}`);

// Test 3: shuffle teams
console.log('[T3] click #shuffleTeams');
const beforeShuffle = errors.length;
await page.click('#shuffleTeams');
await page.waitForTimeout(300);
const t1Count = await page.evaluate(() => document.querySelectorAll('#team1Zone .roster-row').length);
const t2Count = await page.evaluate(() => document.querySelectorAll('#team2Zone .roster-row').length);
console.log(`  result: t1=${t1Count} t2=${t2Count} roster rows`);

// Test 4: random ranking
console.log('[T4] click #randomRanking');
await page.click('#randomRanking');
await page.waitForTimeout(400);
const filledSlots = await page.evaluate(() => document.querySelectorAll('.rank-slot.slot--filled, .slot--filled').length);
console.log(`  result: ${filledSlots} filled slots`);

// Test 5: clear ranking
console.log('[T5] click #clearRanking');
await page.click('#clearRanking');
await page.waitForTimeout(300);
const filledAfterClear = await page.evaluate(() => document.querySelectorAll('.rank-slot.slot--filled, .slot--filled').length);
console.log(`  result after clear: ${filledAfterClear} filled slots`);

// Test 6: toggle autoApply checkbox
console.log('[T6] click #autoApply checkbox');
const before = await page.evaluate(() => document.getElementById('autoApply').checked);
await page.click('#autoApply');
const after = await page.evaluate(() => document.getElementById('autoApply').checked);
console.log(`  before=${before} after=${after}`);

// Test 7: toggle must1
console.log('[T7] click #must1');
const before2 = await page.evaluate(() => document.getElementById('must1').checked);
await page.click('#must1');
const after2 = await page.evaluate(() => document.getElementById('must1').checked);
console.log(`  before=${before2} after=${after2}`);

// Test 8: apply button
console.log('[T8] random ranking + click #apply');
await page.click('#randomRanking');
await page.waitForTimeout(300);
const beforeApply = errors.length;
await page.click('#apply');
await page.waitForTimeout(500);
const histRows = await page.evaluate(() => document.querySelectorAll('#histBody .history__row').length);
console.log(`  history rows after apply: ${histRows}`);
if (errors.length > beforeApply) console.log(`  errors gained: ${errors.length - beforeApply}`);

// Test 9: rules drawer - try opening details
console.log('[T9] click rules-drawer summary');
await page.click('#customRulesSection summary');
await page.waitForTimeout(200);
const rulesOpen = await page.evaluate(() => document.querySelector('#customRulesSection details')?.open);
console.log(`  details open: ${rulesOpen}`);

// Test 10: theme picker present?
console.log('[T10] check theme picker in DOM');
const pickerHasContent = await page.evaluate(() => {
  const m = document.getElementById('themePickerMount');
  return m ? m.children.length > 0 : false;
});
console.log(`  picker mount populated: ${pickerHasContent}`);

console.log('\n--- ALL ERRORS ---');
if (errors.length === 0) {
  console.log('  (none)');
} else {
  errors.forEach(e => console.log(' ', e));
}

await browser.close();
