import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const statisticsSource = readFileSync(resolve(repoRoot, 'src/stats/statistics.js'), 'utf8');

assert.ok(
  !/const\s+mode\s*=\s*players\.length\s*\|\|\s*8/.test(statisticsSource),
  'stats sparklines should use the active game mode, not the player pool length'
);
assert.match(
  statisticsSource,
  /resolveStatsSparklinePlayerCount/,
  'renderPlayerStatsTable should resolve a validated sparkline player count'
);
assert.match(
  statisticsSource,
  /normalizeTeamNumber/,
  'stats table should normalize player team values before sorting and coloring rows'
);
assert.equal(
  /player\.team\s*===\s*[12]/.test(statisticsSource),
  false,
  'stats table should not use strict numeric team comparisons on player.team'
);

const { resolveStatsSparklinePlayerCount } = await import('../../src/stats/statsMode.js');
const { resolvePlayerCountMode } = await import('../../src/core/playerCountMode.js');

assert.equal(resolveStatsSparklinePlayerCount('4', 8), 4);
assert.equal(resolveStatsSparklinePlayerCount(6, 4), 6);
assert.equal(resolveStatsSparklinePlayerCount('8', 4), 8);
assert.equal(
  resolveStatsSparklinePlayerCount('', 6),
  6,
  'missing mode should fall back to a valid current player count'
);
assert.equal(
  resolveStatsSparklinePlayerCount('4abc', 8),
  8,
  'partial mode strings should not be accepted'
);
assert.equal(
  resolveStatsSparklinePlayerCount('5', 5),
  8,
  'invalid mode and invalid pool size should fall back to the default 8-player range'
);

assert.equal(resolvePlayerCountMode('6', 8), 6);
assert.equal(resolvePlayerCountMode('6P', 4), 4);
assert.equal(resolvePlayerCountMode(null, '8'), 8);

console.log('stats sparkline mode checks passed');
