import assert from 'node:assert/strict';

globalThis.window = {
  location: {
    origin: 'http://localhost'
  }
};

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

let fetchCalls = [];
globalThis.fetch = async url => {
  fetchCalls.push(String(url));
  return new Response(JSON.stringify({
    success: true,
    player: {
      handle: 'demo',
      displayName: 'Demo',
      emoji: 'D',
      photoBase64: 'data:image/png;base64,full'
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

const { resolveFullPlayerProfile } = await import('../../src/api/playerApi.js');

const full = await resolveFullPlayerProfile({
  handle: 'demo',
  displayName: 'Demo',
  emoji: 'D'
});
assert.equal(full.photoBase64, 'data:image/png;base64,full');
assert.deepEqual(fetchCalls, ['http://localhost/api/players/demo']);

fetchCalls = [];
const alreadyFull = await resolveFullPlayerProfile({
  handle: 'demo',
  displayName: 'Demo',
  emoji: 'D',
  photoBase64: 'data:image/png;base64,existing'
});
assert.equal(alreadyFull.photoBase64, 'data:image/png;base64,existing');
assert.deepEqual(fetchCalls, []);

const noHandle = { displayName: 'Local', emoji: 'L' };
assert.equal(await resolveFullPlayerProfile(noHandle), noHandle);

console.log('player list client resolution checks passed');
