import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playerControlsSource = readFileSync(resolve(repoRoot, 'src/controllers/playerControls.js'), 'utf8');
const settingsControlsSource = readFileSync(resolve(repoRoot, 'src/controllers/settingsControls.js'), 'utf8');
const mainSource = readFileSync(resolve(repoRoot, 'src/main.js'), 'utf8');

assert.equal(
  /const\s+mode\s*=\s*parseInt\(\$\('mode'\)\.value\)[\s\S]{0,700}(?:generatePlayers|shuffleTeams)\(mode/.test(playerControlsSource),
  false,
  'player controls should not partially parse mode before generating or shuffling players'
);
assert.ok(
  (playerControlsSource.match(/const\s+recentPlayers\s*=/g) || []).length <= 1,
  'player controls should not redeclare recentPlayers in quick start'
);
assert.equal(
  /generatePlayers\(newModeInt,\s*false\)/.test(settingsControlsSource),
  false,
  'settings controls should pass raw mode into player generation'
);
assert.equal(
  /const\s+mode\s*=\s*parseInt\(\$\('mode'\)\.value\)[\s\S]{0,500}generatePlayers\(mode,\s*false\)/.test(mainSource),
  false,
  'initial render should not partially parse mode before generating players'
);

globalThis.localStorage = {
  _data: new Map(),
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  },
  setItem(key, value) {
    this._data.set(key, String(value));
  },
  removeItem(key) {
    this._data.delete(key);
  },
  clear() {
    this._data.clear();
  }
};

globalThis.window = {
  location: {
    origin: 'http://localhost'
  },
  localStorage: globalThis.localStorage
};

const { default: state } = await import('../../src/core/state.js');
const {
  areAllPlayersAssigned,
  assignPlayerToTeam,
  generatePlayers,
  getPlayersByTeam,
  getTeamSizeLimit,
  isTeamFull,
  normalizeTeamNumber,
  shuffleTeams
} = await import('../../src/player/playerManager.js');

function resetPlayers(players) {
  localStorage.clear();
  state.resetAll();
  state.setPlayers(players);
}

const existingPlayers = [
  { id: 1, name: 'A', emoji: 'A', team: 1 },
  { id: 2, name: 'B', emoji: 'B', team: 1 },
  { id: 3, name: 'C', emoji: 'C', team: 2 },
  { id: 4, name: 'D', emoji: 'D', team: 2 }
];

assert.equal(normalizeTeamNumber(1), 1);
assert.equal(normalizeTeamNumber('1'), 1);
assert.equal(normalizeTeamNumber(' 1 '), 1);
assert.equal(normalizeTeamNumber(2), 2);
assert.equal(normalizeTeamNumber('2'), 2);
assert.equal(normalizeTeamNumber(' 2 '), 2);
assert.equal(normalizeTeamNumber(null), null);
assert.equal(normalizeTeamNumber(undefined), null);
assert.equal(normalizeTeamNumber('A'), null);

resetPlayers(existingPlayers);
state.setCurrentRanking({ 1: 1 });

const invalidGenerated = generatePlayers('4abc', true);
assert.deepEqual(
  invalidGenerated,
  existingPlayers,
  'invalid generated mode should return the existing players'
);
assert.deepEqual(
  state.getPlayers(),
  existingPlayers,
  'invalid generated mode should not overwrite player state'
);
assert.deepEqual(
  state.getCurrentRanking(),
  { 1: 1 },
  'invalid generated mode should not clear current ranking'
);

const beforeShuffle = state.getPlayers();
shuffleTeams('4abc');
assert.deepEqual(
  state.getPlayers(),
  beforeShuffle,
  'invalid shuffle mode should not mutate player teams or order'
);

assert.equal(getTeamSizeLimit('4abc'), null);
assert.equal(isTeamFull(1, '4abc'), false);

const generated = generatePlayers('4', true);
assert.equal(generated.length, 4);
assert.deepEqual(generated.map(player => player.team), [null, null, null, null]);

resetPlayers(existingPlayers.map(player => ({ ...player, team: null })));
shuffleTeams('4');
const teamCounts = state.getPlayers().reduce((counts, player) => {
  counts[player.team] = (counts[player.team] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(teamCounts, { 1: 2, 2: 2 });
assert.equal(getTeamSizeLimit('4'), 2);
assert.equal(isTeamFull(1, '4'), true);

resetPlayers([
  { id: 1, name: 'A', emoji: 'A', team: '1' },
  { id: 2, name: 'B', emoji: 'B', team: 1 },
  { id: 3, name: 'C', emoji: 'C', team: '2' },
  { id: 4, name: 'D', emoji: 'D', team: 2 }
]);
assert.deepEqual(
  getPlayersByTeam(1).map(player => player.id),
  [1, 2],
  'team helpers should treat string team values from room snapshots as their numeric teams'
);
assert.deepEqual(
  getPlayersByTeam(2).map(player => player.id),
  [3, 4],
  'team helpers should normalize red-team string values from room snapshots'
);
assert.equal(
  isTeamFull(1, '4'),
  true,
  'team capacity checks should count normalized string team values'
);
assert.equal(
  areAllPlayersAssigned(),
  true,
  'assignment checks should treat normalized string teams as assigned'
);

resetPlayers([]);
assert.equal(
  areAllPlayersAssigned(),
  false,
  'assignment checks should not treat an empty player list as fully assigned'
);

resetPlayers([
  { id: 1, name: 'A', emoji: 'A', team: 1 },
  { id: 2, name: 'B', emoji: 'B', team: undefined },
  { id: 3, name: 'C', emoji: 'C', team: 2 },
  { id: 4, name: 'D', emoji: 'D', team: 2 }
]);
assert.equal(
  areAllPlayersAssigned(),
  false,
  'assignment checks should not treat undefined or malformed team values as assigned'
);

resetPlayers(existingPlayers.map(player => ({ ...player, team: null })));
assignPlayerToTeam(1, ' 2 ');
assert.equal(
  state.getPlayers()[0].team,
  2,
  'assignPlayerToTeam should normalize string team values before writing state'
);

console.log('player manager mode validation checks passed');
