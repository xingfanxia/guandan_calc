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
const { randomizeRanking } = await import('../../src/ranking/rankingManager.js');

function resetRanking() {
  localStorage.clear();
  state.resetAll();
  state.setPlayers([
    { id: 1, name: '甲', team: 1 },
    { id: 2, name: '乙', team: 2 },
    { id: 3, name: '丙', team: 1 },
    { id: 4, name: '丁', team: 2 }
  ]);
  state.setCurrentRanking({ 1: 1 });
}

resetRanking();
assert.doesNotThrow(
  () => {
    const result = randomizeRanking([1, 2, 3], '4');
    assert.equal(result, false);
  },
  'random ranking should fail closed instead of letting state validation throw for missing players'
);
assert.deepEqual(
  state.getCurrentRanking(),
  { 1: 1 },
  'failed random ranking should not mutate the current ranking'
);

resetRanking();
assert.equal(randomizeRanking([1, 2, 2, 4], '4'), false);
assert.deepEqual(
  state.getCurrentRanking(),
  { 1: 1 },
  'duplicate random-ranking player ids should not mutate current ranking'
);

resetRanking();
assert.equal(randomizeRanking([1, 2, 3, 4], '4'), true);
const validRanking = state.getCurrentRanking();
assert.equal(Object.keys(validRanking).length, 4);
assert.deepEqual(
  new Set(Object.values(validRanking)),
  new Set([1, 2, 3, 4])
);

console.log('random ranking validation checks passed');
