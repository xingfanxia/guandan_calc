import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mainSource = readFileSync(resolve(repoRoot, 'src/main.js'), 'utf8');
const gameControlsSource = readFileSync(resolve(repoRoot, 'src/controllers/gameControls.js'), 'utf8');
const playerControlsSource = readFileSync(resolve(repoRoot, 'src/controllers/playerControls.js'), 'utf8');

assert.equal(
  gameControlsSource.includes('calculateFromRanking(parseInt(mode))'),
  false,
  'gameControls should pass raw mode into calculateFromRanking so invalid modes fail closed'
);
assert.equal(
  gameControlsSource.includes('updatePlayerStats(parseInt(mode))'),
  false,
  'gameControls should pass raw mode into updatePlayerStats so stats mutation validates it'
);

const rankingUpdatedStart = mainSource.indexOf("onEvent('ranking:updated'");
const rankingUpdatedEnd = mainSource.indexOf("onEvent('ranking:cleared'", rankingUpdatedStart);
assert.notEqual(rankingUpdatedStart, -1, 'main ranking:updated handler should exist');
assert.notEqual(rankingUpdatedEnd, -1, 'main ranking:cleared handler should follow ranking:updated');

const rankingUpdatedSource = mainSource.slice(rankingUpdatedStart, rankingUpdatedEnd);
assert.equal(
  rankingUpdatedSource.includes("parseInt($('mode').value)"),
  false,
  'main ranking:updated handler should not partially parse mode before ranking calculation'
);
assert.equal(
  rankingUpdatedSource.includes('updatePlayerStats(parseInt(mode))'),
  false,
  'main ranking:updated handler should pass raw mode into stats mutation'
);

assert.equal(
  /const\s+mode\s*=\s*parseInt\(\$\('mode'\)\.value\)[\s\S]{0,300}randomizeRanking\(playerIds,\s*mode\)/.test(playerControlsSource),
  false,
  'player controls should pass raw mode into randomizeRanking so invalid modes fail closed'
);

console.log('mode callsite validation checks passed');
