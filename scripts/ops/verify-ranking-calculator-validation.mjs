import assert from 'node:assert/strict';

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
const { calculateFromRanking, checkAutoCalculate } = await import('../../src/ranking/rankingCalculator.js');

function resetWithPlayers(players, ranking) {
  localStorage.clear();
  state.resetAll();
  state.setPlayers(players);
  state.setCurrentRanking(ranking);
}

resetWithPlayers([
  { id: 1, name: '未分队头游', emoji: 'A', team: null },
  { id: 2, name: '蓝二', emoji: 'B', team: 1 },
  { id: 3, name: '红三', emoji: 'C', team: 2 },
  { id: 4, name: '红末', emoji: 'D', team: 2 }
], { 1: 1, 2: 2, 3: 3, 4: 4 });

const unassignedWinner = calculateFromRanking(4);
assert.equal(unassignedWinner.ok, false);
assert.match(
  unassignedWinner.message,
  /未分队|队伍/,
  'unassigned first-place player should not silently become the red team winner'
);
assert.equal(
  state.getWinner(),
  't1',
  'failed ranking calculation should not mutate the legacy winner'
);

resetWithPlayers([
  { id: 1, name: '蓝头', emoji: 'A', team: '1' },
  { id: 2, name: '未分队二游', emoji: 'B', team: null },
  { id: 3, name: '红三', emoji: 'C', team: 2 },
  { id: 4, name: '红末', emoji: 'D', team: 2 }
], { 1: 1, 2: 2, 3: 3, 4: 4 });

const unassignedRankedPlayer = calculateFromRanking(4);
assert.equal(unassignedRankedPlayer.ok, false);
assert.match(
  unassignedRankedPlayer.message,
  /第2名|队伍/,
  'any ranked player without a team should fail closed before scoring'
);
assert.equal(state.getWinner(), 't1');

resetWithPlayers([
  { id: 1, name: '蓝头', emoji: 'A', team: '1' },
  { id: 2, name: '蓝二', emoji: 'B', team: 1 },
  { id: 3, name: '红三', emoji: 'C', team: '2' },
  { id: 4, name: '红末', emoji: 'D', team: 2 }
], { 1: 1, 2: 2, 3: 3, 4: 4 });

const validStringTeams = calculateFromRanking(4);
assert.equal(validStringTeams.ok, true);
assert.equal(validStringTeams.winner, 't1');
assert.deepEqual(validStringTeams.ranks, [1, 2]);

const invalidModeCheck = checkAutoCalculate('4abc');
assert.equal(
  invalidModeCheck.shouldCalculate,
  false,
  'invalid mode strings should not be treated as complete rankings'
);
assert.deepEqual(invalidModeCheck.progress, { filled: 0, total: 0 });

const invalidModeResult = calculateFromRanking('4abc');
assert.equal(invalidModeResult.ok, false);
assert.match(
  invalidModeResult.message,
  /模式|人数/,
  'invalid mode strings should fail before scoring'
);

console.log('ranking calculator validation checks passed');
