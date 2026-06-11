import assert from 'node:assert/strict';

import { initializePlayerStats } from '../../api/players/_utils.js';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';
process.env.ADMIN_TOKEN = 'profile-update-secret';

const storedPlayer = {
  id: 'PLR_TEST01',
  handle: 'tester',
  displayName: 'Tester',
  emoji: 'T',
  playStyle: 'steady',
  tagline: 'ready',
  photoBase64: 'data:image/png;base64,ZmFrZQ==',
  stats: initializePlayerStats(),
  recentGames: [],
  achievements: [],
  createdAt: '2026-06-10T10:00:00.000Z',
  lastActiveAt: '2026-06-10T10:00:00.000Z'
};

let savedPlayer = null;
let setCalls = 0;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).endsWith('/pipeline'),
    'profile update validation test should only hit the mocked KV pipeline endpoint'
  );

  const commands = JSON.parse(options.body || '[]');
  return new Response(JSON.stringify(commands.map(command => {
    const [operation, key, ...args] = command;
    const normalizedOperation = String(operation).toLowerCase();

    assert.equal(key, 'player:tester');

    if (normalizedOperation === 'get') {
      return { result: JSON.stringify(savedPlayer || storedPlayer) };
    }

    if (normalizedOperation === 'set') {
      savedPlayer = JSON.parse(args[0]);
      setCalls++;
      return { result: 'OK' };
    }

    throw new Error(`Unexpected KV operation: ${normalizedOperation}`);
  })), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { default: handler } = await import('../../api/players/[handle].js');

  for (const [field, value] of [
    ['displayName', ''],
    ['displayName', 42],
    ['emoji', ''],
    ['playStyle', ''],
    ['tagline', '']
  ]) {
    savedPlayer = null;
    setCalls = 0;
    const response = await handler(new Request('https://example.test/api/players/tester', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'PROFILE_UPDATE',
        adminToken: 'profile-update-secret',
        [field]: value
      })
    }));

    assert.equal(
      response.status,
      400,
      `PROFILE_UPDATE should reject invalid ${field} instead of falling back during validation`
    );
    assert.equal(setCalls, 0, `invalid ${field} update should not write to KV`);
  }

  const removePhotoResponse = await handler(new Request('https://example.test/api/players/tester', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'PROFILE_UPDATE',
      adminToken: 'profile-update-secret',
      photoBase64: null
    })
  }));

  assert.equal(removePhotoResponse.status, 200, await removePhotoResponse.text());
  assert.equal(savedPlayer.photoBase64, null, 'PROFILE_UPDATE should still allow explicit photo removal');
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.ADMIN_TOKEN;
}

console.log('profile update validation checks passed');
