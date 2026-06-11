import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

globalThis.window = {
  location: {
    origin: 'http://localhost'
  },
  addEventListener() {},
  removeEventListener() {}
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mainSource = readFileSync(resolve(repoRoot, 'src/main.js'), 'utf8');
const gameControlsSource = readFileSync(resolve(repoRoot, 'src/controllers/gameControls.js'), 'utf8');
const finalWinSource = readFileSync(resolve(repoRoot, 'src/controllers/finalWinSideEffects.js'), 'utf8');
const roomManagerSource = readFileSync(resolve(repoRoot, 'src/share/roomManager.js'), 'utf8');
const historySource = readFileSync(resolve(repoRoot, 'src/game/history.js'), 'utf8');
const victoryModalSource = readFileSync(resolve(repoRoot, 'src/ui/victoryModal.js'), 'utf8');

assert.ok(
  finalWinSource.includes('export async function handleFinalWinSideEffects'),
  'final-win profile/voting sync should live in a shared controller helper'
);
const { resolveFinalSessionDuration } = await import('../../src/controllers/finalWinSideEffects.js');
assert.equal(
  resolveFinalSessionDuration(120, {
    createdAt: '2026-06-10T10:00:00.000Z',
    finishedAt: '2026-06-10T10:05:30.000Z'
  }),
  330,
  'final-win helper should prefer valid authoritative room duration'
);
assert.equal(
  resolveFinalSessionDuration(120, {
    createdAt: '2026-06-10T10:05:30.000Z',
    finishedAt: '2026-06-10T10:00:00.000Z'
  }),
  120,
  'final-win helper should not let negative room durations poison profile sync'
);
assert.equal(
  resolveFinalSessionDuration(120, {
    createdAt: 'bad',
    finishedAt: '2026-06-10T10:00:00.000Z'
  }),
  120,
  'final-win helper should ignore malformed room timestamps'
);
assert.equal(
  resolveFinalSessionDuration(-5, {}),
  0,
  'final-win helper should clamp malformed history durations to zero'
);
assert.ok(
  finalWinSource.includes('showVictoryModal'),
  'shared final-win helper should show the victory modal'
);
assert.ok(
  finalWinSource.includes('scheduleAutoVotingSync'),
  'shared final-win helper should schedule vote-to-profile sync'
);
assert.ok(
  finalWinSource.includes('syncProfileStats'),
  'shared final-win helper should sync complete session stats'
);
assert.ok(
  finalWinSource.includes('calculateHonorsFromData'),
  'shared final-win helper should calculate profile honors from captured players/stats'
);
assert.ok(
  finalWinSource.includes('resolvePlayerCountMode'),
  'final-win helper should validate the captured mode before calculating profile honors'
);
assert.equal(
  finalWinSource.includes('parseInt(mode)'),
  false,
  'final-win helper should not partially parse malformed mode strings'
);
assert.ok(
  finalWinSource.indexOf('const capturedHistoryEntry') < finalWinSource.indexOf('await showVictoryModal'),
  'final-win helper should snapshot session data before awaiting victory modal/profile fetches'
);

assert.ok(
  mainSource.includes('applyCalculatedRankingResult'),
  'ranking auto-apply path should use the shared apply workflow'
);
assert.ok(
  gameControlsSource.includes('export async function applyCalculatedRankingResult'),
  'shared apply workflow should own final-win room/profile ordering'
);

const helperCalls = (gameControlsSource.match(/handleFinalWinSideEffects/g) || []).length;
assert.equal(
  helperCalls,
  2,
  'gameControls should import and call shared final-win helper only inside the shared apply workflow'
);
assert.ok(
  (gameControlsSource.match(/const roomSync = syncNow\(\);/g) || []).length >= 1,
  'shared apply workflow should keep the room sync promise for final-win ordering'
);
assert.ok(
  (gameControlsSource.match(/await roomSync;/g) || []).length >= 1,
  'shared apply workflow should wait for room sync before profile side effects snapshot room metadata'
);

const manualCalcIndex = gameControlsSource.indexOf("const manualCalcBtn = $('manualCalc')");
assert.notEqual(manualCalcIndex, -1, 'manualCalc handler should exist');
const manualCalcSource = gameControlsSource.slice(manualCalcIndex);
assert.ok(
  manualCalcSource.includes('await applyCalculatedRankingResult'),
  'manualCalc auto-apply path should use the shared apply workflow'
);
assert.ok(
  gameControlsSource.includes('const applyResult = applyGameResult'),
  'shared apply workflow should preserve applyResult'
);
assert.ok(
  gameControlsSource.includes('if (!applyResult?.applied)'),
  'manualCalc auto-apply path should not run stats/ranking/sync side effects when applyGameResult rejects the round'
);
assert.ok(
  manualCalcSource.includes('if (manualCalcBtn.disabled) return;'),
  'manualCalc async auto-apply path should guard against fast double-submits'
);
assert.ok(
  manualCalcSource.includes('manualCalcBtn.disabled = true;'),
  'manualCalc should disable itself while applying async final-win side effects'
);

assert.equal(
  mainSource.includes('scheduleAutoVotingSync()'),
  false,
  'main should not duplicate final-win vote sync scheduling inline'
);
assert.equal(
  gameControlsSource.includes('scheduleAutoVotingSync()'),
  false,
  'gameControls should not duplicate final-win vote sync scheduling inline'
);

const timeoutIndex = finalWinSource.indexOf('setTimeout(');
assert.notEqual(timeoutIndex, -1, 'final-win helper should still delay profile sync for late local vote state');
const timeoutSource = finalWinSource.slice(timeoutIndex);
assert.equal(
  timeoutSource.includes('calculateHonors('),
  false,
  'delayed profile sync must not recalculate honors from live global state'
);
assert.ok(
  victoryModalSource.includes('return { mvp: null, burden: null };'),
  'victory modal should make local voting results explicit when room voting owns final votes'
);
assert.ok(
  victoryModalSource.includes('normalizeTeamNumber'),
  'victory modal should normalize player team values before selecting the winning-team MVP'
);
assert.equal(
  /p\.team\s*===\s*winningTeamNum/.test(victoryModalSource),
  false,
  'victory modal should not use strict numeric team comparisons on raw player.team'
);
assert.equal(
  victoryModalSource.includes('function renderVotingInterface'),
  false,
  'victory modal should not keep the old unmounted local voting UI'
);
assert.equal(
  victoryModalSource.includes('function renderVoteLeaderboard'),
  false,
  'victory modal should not keep the old unmounted host vote leaderboard'
);
assert.equal(
  victoryModalSource.includes('TODO: Actually record'),
  false,
  'victory modal should not carry stale voting TODOs after host vote confirmation moved to votingManager'
);
const taglineConditionIndex = victoryModalSource.indexOf('if (mvpPlayer && mvpPlayer.tagline)');
const taglineRemovalIndex = victoryModalSource.indexOf("modal.querySelector('.mvp-tagline')");
assert.ok(
  taglineRemovalIndex !== -1 && taglineRemovalIndex < taglineConditionIndex,
  'victory modal should clear stale MVP tagline before deciding whether the next winner has one'
);

const honorsSource = readFileSync(resolve(repoRoot, 'src/stats/honors.js'), 'utf8');
assert.ok(
  honorsSource.includes('export function calculateHonorsFromData'),
  'honors module should expose a pure data-based calculation for snapshots'
);
assert.ok(
  honorsSource.includes('return calculateHonorsFromData(players, allStats, totalPlayers);'),
  'calculateHonors should delegate to the pure data-based calculation'
);

const syncNowStart = roomManagerSource.indexOf('export function syncNow');
const syncNowSource = roomManagerSource.slice(syncNowStart, roomManagerSource.indexOf('// Export room state getters', syncNowStart));
assert.ok(
  syncNowSource.includes('return syncToRoom();'),
  'syncNow should return the host room sync promise so final-win callers can wait for finishedAt'
);
assert.ok(
  syncNowSource.includes('return false;'),
  'syncNow should return a stable false value when not hosting'
);

const resetAllStart = historySource.indexOf('export function resetAll');
const resetAllSource = historySource.slice(resetAllStart);
assert.ok(
  resetAllSource.includes('state.setSessionStartTime(Date.now());'),
  'resetAll should restart the session timer so the next final-win duration is session-scoped'
);

console.log('final-win side effect checks passed');
