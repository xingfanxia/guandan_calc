import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = path => readFileSync(resolve(repoRoot, path), 'utf8');

const mainSource = readSource('src/main.js');
const gameControlsSource = readSource('src/controllers/gameControls.js');

const rankingUpdatedStart = mainSource.indexOf("onEvent('ranking:updated'");
const rankingUpdatedEnd = mainSource.indexOf("onEvent('ranking:cleared'", rankingUpdatedStart);
assert.notEqual(rankingUpdatedStart, -1, 'main ranking:updated handler should exist');
assert.notEqual(rankingUpdatedEnd, -1, 'main ranking:cleared handler should follow ranking:updated');

const rankingUpdatedSource = mainSource.slice(rankingUpdatedStart, rankingUpdatedEnd);

assert.match(
  gameControlsSource,
  /export async function applyCalculatedRankingResult\(/,
  'gameControls should expose one shared workflow for applying a calculated ranking result'
);
assert.equal(
  (gameControlsSource.match(/applyGameResult\(/g) || []).length,
  1,
  'applyGameResult should be called only inside the shared apply workflow'
);
assert.equal(
  (gameControlsSource.match(/handleFinalWinSideEffects/g) || []).length,
  2,
  'final-win side effects should be imported and invoked only by the shared apply workflow'
);
assert.ok(
  rankingUpdatedSource.includes('await applyCalculatedRankingResult(result, mode)'),
  'ranking auto-apply path should use the shared apply workflow'
);
assert.equal(
  rankingUpdatedSource.includes('applyGameResult('),
  false,
  'ranking auto-apply path should not duplicate raw applyGameResult logic'
);
assert.equal(
  rankingUpdatedSource.includes('handleFinalWinSideEffects'),
  false,
  'ranking auto-apply path should not duplicate final-win side effects'
);

const applyHandlerStart = gameControlsSource.indexOf("if (applyBtn) {");
const advanceHandlerStart = gameControlsSource.indexOf("if (advanceBtn) {");
assert.notEqual(applyHandlerStart, -1, 'apply button handler should exist');
assert.notEqual(advanceHandlerStart, -1, 'advance button handler should follow apply handler');
const applyHandlerSource = gameControlsSource.slice(applyHandlerStart, advanceHandlerStart);
assert.ok(
  applyHandlerSource.includes('await applyCalculatedRankingResult(result, mode)'),
  'manual Apply button should use the shared apply workflow'
);
assert.equal(
  applyHandlerSource.includes('applyGameResult('),
  false,
  'manual Apply button should not duplicate raw applyGameResult logic'
);

const manualCalcStart = gameControlsSource.indexOf("const manualCalcBtn = $('manualCalc')");
assert.notEqual(manualCalcStart, -1, 'manual calc handler should exist');
const manualCalcSource = gameControlsSource.slice(manualCalcStart);
assert.ok(
  manualCalcSource.includes('await applyCalculatedRankingResult(result, mode)'),
  'manual calc auto-apply should use the shared apply workflow'
);
assert.equal(
  manualCalcSource.includes('applyGameResult('),
  false,
  'manual calc auto-apply should not duplicate raw applyGameResult logic'
);

console.log('apply result workflow checks passed');
