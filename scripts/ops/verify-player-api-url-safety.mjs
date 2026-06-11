import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playerApiSource = readFileSync(resolve(repoRoot, 'src/api/playerApi.js'), 'utf8');

globalThis.window = { location: { origin: 'http://localhost' } };
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};
const {
  createPlayer,
  getPlayer,
  rotatePlayerToken,
  touchPlayer,
  updatePlayerStats,
  updatePlayerProfile,
  validateHandle
} = await import('../../src/api/playerApi.js');

assert.ok(
  playerApiSource.includes('function playerProfileUrl(handle)'),
  'player API client should centralize profile URL construction'
);
assert.ok(
  playerApiSource.includes('encodeURIComponent(handle)'),
  'player profile URLs should encode handle path segments before fetch'
);
assert.equal(
  playerApiSource.includes('`${API_BASE}/api/players/${handle}`'),
  false,
  'player API client should not interpolate raw handles into profile API paths'
);
assert.ok(
  playerApiSource.includes('fetch(playerProfileUrl(handle), {'),
  'player profile PUT requests should use the encoded profile URL helper'
);
assert.ok(
  playerApiSource.includes('fetch(playerProfileUrl(handle));'),
  'player profile GET requests should use the encoded profile URL helper'
);
assert.equal(validateHandle('__proto__').valid, false);
assert.equal(validateHandle('constructor').valid, false);
assert.equal(validateHandle('prototype').valid, false);
assert.equal(validateHandle('valid_handle').valid, true);
assert.ok(
  playerApiSource.includes('unsafeObjectKeys'),
  'client-side handle validation should reject object-prototype keys just like the server'
);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response('<html>edge error</html>', {
    status: 502,
    statusText: 'Bad Gateway',
    headers: { 'Content-Type': 'text/html' }
  });

  await assert.rejects(
    () => createPlayer({
      handle: 'edge_error',
      displayName: 'Edge Error',
      emoji: 'E',
      playStyle: 'steady',
      tagline: 'edge'
    }),
    /Create player failed: Bad Gateway/,
    'createPlayer should surface HTTP status instead of JSON parse errors for non-JSON error bodies'
  );

  await assert.rejects(
    () => updatePlayerProfile('edge_error', {
      displayName: 'Edge Error',
      emoji: 'E',
      playStyle: 'steady',
      tagline: 'edge'
    }),
    /Update profile failed: Bad Gateway/,
    'updatePlayerProfile should surface HTTP status instead of JSON parse errors for non-JSON error bodies'
  );

  await assert.rejects(
    () => rotatePlayerToken('edge_error'),
    /Rotate token failed: Bad Gateway/,
    'rotatePlayerToken should surface HTTP status instead of JSON parse errors for non-JSON error bodies'
  );

  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  await assert.rejects(
    () => getPlayer('edge_error'),
    /Invalid player response/,
    'getPlayer should reject successful responses that do not include a player object'
  );

  const consoleErrors = [];
  const originalConsoleError = console.error;
  try {
    console.error = (...args) => {
      consoleErrors.push(args);
    };
    globalThis.fetch = async () => new Response(null, {
      status: 204,
      statusText: 'No Content'
    });

    assert.equal(
      (await touchPlayer('edge_empty')).success,
      true,
      'touchPlayer should treat empty successful responses as successful writes'
    );

    assert.equal(
      (await updatePlayerStats('edge_empty', {
        roomCode: 'LOCAL',
        ranking: 1,
        team: 1,
        mode: '4P'
      })).success,
      true,
      'updatePlayerStats should treat empty successful responses as successful writes'
    );

    assert.equal(
      consoleErrors.length,
      0,
      'empty successful player mutation responses should not trigger JSON parse errors'
    );
  } finally {
    console.error = originalConsoleError;
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log('player API URL safety checks passed');
