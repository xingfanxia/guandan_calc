// Functional-parity smoke for redesign branch — run against http://localhost:3000
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. Visibility of key interactive controls
const visIds = ['manualCalc','shareGame','exportTxt','exportCsv','exportLongPng','exportMobilePng',
  'undo','resetMatch','clearRanking','randomRanking','apply','advance',
  'createRoom','joinRoom','browseRooms','generatePlayers','shuffleTeams','quickStart','mode'];
for (const id of visIds) {
  const r = await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return { exists: false };
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    // mode is a hidden native select driven by radio group — special-case
    return { exists: true, display: cs.display, visibility: cs.visibility, w: rect.width, h: rect.height };
  }, id);
  if (id === 'mode') {
    ok(`#mode native select exists`, r.exists, JSON.stringify(r));
    continue;
  }
  ok(`#${id} visible`, r.exists && r.display !== 'none' && r.visibility !== 'hidden' && r.w > 0 && r.h > 0, JSON.stringify(r));
}

// intentionally hidden controls still in DOM
for (const id of ['bulkNames','applyBulkNames','leaveRoom','favoriteRoom','favoriteRoomTop','votingSection']) {
  const r = await page.evaluate((id) => !!document.getElementById(id), id);
  ok(`#${id} present in DOM (hidden ok)`, r);
}

// theme toggle mounted + toggles data-theme
const toggleWorks = await page.evaluate(() => {
  const btn = document.querySelector('#themeToggleMount .theme-toggle');
  if (!btn) return 'no button';
  const before = document.documentElement.getAttribute('data-theme');
  btn.click();
  const after = document.documentElement.getAttribute('data-theme');
  btn.click();
  return before !== after ? 'ok' : `no change (${before} -> ${after})`;
});
ok('theme toggle mounted + switches data-theme', toggleWorks === 'ok', toggleWorks);

// mode radio group drives hidden native select
const radioWorks = await page.evaluate(() => {
  const radios = document.querySelectorAll('.modeselect input[type="radio"], input[name="modeRadio"], .modeselect__group input');
  return radios.length;
});
ok('mode radio group present', radioWorks > 0, `radios=${radioWorks}`);

// 2. Generate players, then tap-to-rank
await page.click('#quickStart').catch(() => {});
await page.waitForTimeout(300);
let poolCount = await page.evaluate(() => document.querySelectorAll('#playerPool .pool-tile').length);
if (poolCount === 0) {
  await page.click('#generatePlayers').catch(() => {});
  await page.waitForTimeout(300);
  poolCount = await page.evaluate(() => document.querySelectorAll('#playerPool .pool-tile').length);
}
ok('player pool populated after quickStart/generatePlayers', poolCount > 0, `tiles=${poolCount}`);

const slotCount = await page.evaluate(() => document.querySelectorAll('#rankingArea .rank-slot').length);
ok('ranking slots rendered', slotCount > 0, `slots=${slotCount}`);

// Tap first pool tile → fills rank 1
const firstName = await page.evaluate(() => document.querySelector('#playerPool .pool-tile .pool-tile__name')?.textContent);
await page.click('#playerPool .pool-tile');
await page.waitForTimeout(200);
let filled1 = await page.evaluate(() => {
  const s = document.querySelector('#rankingArea .rank-slot[data-rank="1"]');
  return { filled: s?.classList.contains('slot--filled'), name: s?.querySelector('.slot__name')?.textContent };
});
ok('tap pool tile fills rank 1', filled1.filled === true && filled1.name === firstName, JSON.stringify(filled1));

// Tap second tile → fills rank 2 (lowest open)
await page.click('#playerPool .pool-tile');
await page.waitForTimeout(200);
const filled2 = await page.evaluate(() => !!document.querySelector('#rankingArea .rank-slot[data-rank="2"].slot--filled'));
ok('tap second tile fills rank 2', filled2);

// Tap filled slot 1 → clears it, player returns to pool
const poolBefore = await page.evaluate(() => document.querySelectorAll('#playerPool .pool-tile').length);
await page.click('#rankingArea .rank-slot[data-rank="1"]');
await page.waitForTimeout(200);
const afterUnrank = await page.evaluate(() => ({
  rank1Filled: !!document.querySelector('#rankingArea .rank-slot[data-rank="1"].slot--filled'),
  pool: document.querySelectorAll('#playerPool .pool-tile').length,
}));
ok('tap filled slot clears rank + returns player to pool',
  afterUnrank.rank1Filled === false && afterUnrank.pool === poolBefore + 1, JSON.stringify(afterUnrank));

// 3. Desktop drag-drop still works (pool tile → rank-1 slot)
await page.dragAndDrop('#playerPool .pool-tile', '#rankingArea .rank-slot[data-rank="1"]');
await page.waitForTimeout(250);
const dragFilled = await page.evaluate(() => !!document.querySelector('#rankingArea .rank-slot[data-rank="1"].slot--filled'));
ok('drag-drop pool→slot fills rank 1', dragFilled);

// Verify drag did NOT also fire tap (rank 3 should still be empty if only 2 ranked + 1 dragged)
const rankedCount = await page.evaluate(() => document.querySelectorAll('#rankingArea .rank-slot.slot--filled').length);
ok('drag did not double-place (exactly 2 filled)', rankedCount === 2, `filled=${rankedCount}`);

// Drag a filled slot back to the pool (handlePoolDrop path)
const poolBeforeReturn = await page.evaluate(() => document.querySelectorAll('#playerPool .pool-tile').length);
await page.dragAndDrop('#rankingArea .rank-slot[data-rank="1"]', '#playerPool');
await page.waitForTimeout(250);
const afterReturn = await page.evaluate(() => ({
  rank1Filled: !!document.querySelector('#rankingArea .rank-slot[data-rank="1"].slot--filled'),
  pool: document.querySelectorAll('#playerPool .pool-tile').length,
}));
ok('drag filled slot→pool unranks (handlePoolDrop wired)',
  afterReturn.rank1Filled === false && afterReturn.pool === poolBeforeReturn + 1, JSON.stringify(afterReturn));

// 4. randomRanking / clearRanking
await page.click('#randomRanking');
await page.waitForTimeout(250);
const allFilled = await page.evaluate(() => ({
  filled: document.querySelectorAll('#rankingArea .rank-slot.slot--filled').length,
  slots: document.querySelectorAll('#rankingArea .rank-slot').length,
}));
ok('randomRanking fills all slots', allFilled.filled === allFilled.slots && allFilled.slots > 0, JSON.stringify(allFilled));

await page.click('#clearRanking');
await page.waitForTimeout(250);
const cleared = await page.evaluate(() => document.querySelectorAll('#rankingArea .rank-slot.slot--filled').length);
ok('clearRanking empties all slots', cleared === 0, `filled=${cleared}`);

// 5. apply (with full random ranking) — manualCalc preview also exercised
await page.click('#randomRanking');
await page.waitForTimeout(250);
await page.click('#manualCalc');
await page.waitForTimeout(200);
const headline = await page.evaluate(() => document.getElementById('headline')?.textContent);
ok('manualCalc updates hidden headline mirror', typeof headline === 'string', `headline=${headline}`);

// page errors
ok('no page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
