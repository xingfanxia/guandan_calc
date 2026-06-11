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

globalThis.confirm = () => true;

const { default: state } = await import('../../src/core/state.js');
const { resetAll } = await import('../../src/game/history.js');

const originalNow = Date.now;

try {
  Date.now = () => 987654321000;

  state.setSessionStartTime(123);
  const preserveResult = resetAll(true);
  assert.equal(preserveResult.success, true);
  assert.equal(
    state.getSessionStartTime(),
    987654321000,
    'resetting a match while preserving players should restart the session timer'
  );

  Date.now = () => 987654322000;

  state.setSessionStartTime(456);
  const fullResult = resetAll(false);
  assert.equal(fullResult.success, true);
  assert.equal(
    state.getSessionStartTime(),
    987654322000,
    'resetting all game data should restart the session timer even outside the browser event loop'
  );
} finally {
  Date.now = originalNow;
}

console.log('session timer reset checks passed');
