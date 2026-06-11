import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { extractBearerToken } = await import('../../api/rooms/_auth.js');

const roomPayload = {
  settings: {},
  state: {},
  players: []
};

const cases = [
  {
    name: 'room update',
    modulePath: '../../api/rooms/[code].js',
    request: new Request('https://example.test/api/rooms/ABC123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomPayload)
    })
  },
  {
    name: 'reset vote',
    modulePath: '../../api/rooms/reset-vote/[code].js',
    request: new Request('https://example.test/api/rooms/reset-vote/ABC123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundNumber: 1 })
    })
  },
  {
    name: 'favorite room',
    modulePath: '../../api/rooms/favorite/[code].js',
    request: new Request('https://example.test/api/rooms/favorite/ABC123', {
      method: 'POST'
    })
  },
  {
    name: 'unfavorite room',
    modulePath: '../../api/rooms/favorite/[code].js',
    request: new Request('https://example.test/api/rooms/favorite/ABC123', {
      method: 'DELETE'
    })
  }
];

let failures = 0;

for (const testCase of cases) {
  const { default: handler } = await import(testCase.modulePath);
  const response = await handler(testCase.request);
  if (response.status !== 403) {
    failures++;
    const text = await response.text();
    console.error(`FAIL ${testCase.name}: expected 403, got ${response.status}; body=${text}`);
  } else {
    console.log(`PASS ${testCase.name}`);
  }
}

if (failures > 0) {
  console.error(`${failures} room auth gate checks failed`);
  process.exit(1);
}

const mockRequest = headers => ({
  headers: { get: name => headers[name.toLowerCase()] ?? null }
});
assert.equal(
  extractBearerToken(mockRequest({ authorization: 'Bearer room-token' })),
  'room-token',
  'room auth should parse standard Bearer tokens'
);
assert.equal(
  extractBearerToken(mockRequest({ authorization: 'bearer room-token' })),
  'room-token',
  'room auth should parse Bearer scheme case-insensitively'
);
assert.equal(
  extractBearerToken(mockRequest({ authorization: '  Bearer   room-token  ' })),
  'room-token',
  'room auth should trim extra whitespace around Bearer tokens'
);
assert.equal(
  extractBearerToken(mockRequest({ authorization: 'Basic room-token' })),
  null,
  'room auth should reject non-Bearer authorization headers'
);

const roomDetailSource = readFileSync(resolve(repoRoot, 'api/rooms/[code].js'), 'utf8');
const resetVoteSource = readFileSync(resolve(repoRoot, 'api/rooms/reset-vote/[code].js'), 'utf8');
const voteRouteSource = readFileSync(resolve(repoRoot, 'api/rooms/vote/[code].js'), 'utf8');
assert.ok(
  roomDetailSource.includes('hostVerified'),
  'room detail GET should report whether an Authorization token was verified for host mode'
);
assert.ok(
  roomDetailSource.includes('Unauthorized — invalid host token for this room'),
  'room detail GET should reject invalid host Authorization instead of silently returning viewer data'
);
assert.ok(
  roomDetailSource.includes('hostVerified: true'),
  'room detail GET should explicitly mark valid host auth as verified'
);
assert.equal(
  roomDetailSource.includes('...(providedToken ? { hostVerified: true } : {})'),
  false,
  'room detail GET must not mark arbitrary Bearer tokens as verified host auth for legacy no-token rooms'
);
assert.ok(
  roomDetailSource.includes('const hostVerified = Boolean(storedToken && providedToken && constantTimeEqual(providedToken, storedToken));'),
  'room detail GET should derive hostVerified from a stored token match'
);
assert.equal(
  roomDetailSource.includes('function constantTimeEqual'),
  false,
  'room detail API should reuse the shared room auth constantTimeEqual helper instead of duplicating it'
);
assert.equal(
  roomDetailSource.includes("from './vote/[code].js'"),
  false,
  'room detail API should not import the vote route module just to reuse vote helpers'
);
assert.equal(
  resetVoteSource.includes("from '../vote/[code].js'"),
  false,
  'reset-vote API should not import the vote route module just to reuse vote helpers'
);
assert.ok(
  roomDetailSource.includes("from './_votes.js'"),
  'room detail API should reuse shared vote helpers from api/rooms/_votes.js'
);
assert.ok(
  resetVoteSource.includes("from '../_votes.js'"),
  'reset-vote API should reuse shared vote helpers from api/rooms/_votes.js'
);
assert.ok(
  voteRouteSource.includes("from '../_votes.js'"),
  'vote route should also reuse the shared vote helper module'
);
assert.equal(
  voteRouteSource.includes('const FINGERPRINT_CAP = 1000'),
  false,
  'vote route should not duplicate the shared fingerprint cap constant'
);
assert.ok(
  voteRouteSource.includes('VOTE_FINGERPRINT_CAP'),
  'vote route should use the shared fingerprint cap constant'
);

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';

const roomsByKey = new Map([
  ['room:BADJSN', 'not-json'],
  ['room:LEGACY', {
    roomCode: 'LEGACY',
    settings: {},
    state: {},
    players: [],
    createdAt: '2026-06-10T10:00:00.000Z'
  }],
  ['room:HOSTOK', {
    roomCode: 'HOSTOK',
    authToken: 'stored-host-token',
    settings: {},
    state: {
      gameStatus: {
        ended: true,
        winnerKey: 't1',
        winnerName: 'Blue Team',
        reason: 'A_LEVEL_CLEARED'
      },
      history: []
    },
    players: [],
    endGameVotes: {
      mvp: { 1: 2 },
      burden: { 2: 1 },
      fingerprints: ['current-fingerprint']
    },
    endGameVotesHistory: [
      {
        mvp: { 1: 1 },
        burden: { 2: 1 },
        fingerprints: ['archived-fingerprint'],
        completedAt: '2026-06-10T20:16:00.000Z'
      }
    ],
    createdAt: '2026-06-10T10:00:00.000Z'
  }],
  ['room:STALE1', {
    roomCode: 'STALE1',
    settings: {},
    state: {
      gameStatus: {
        ended: false,
        winnerKey: null,
        winnerName: null,
        reason: null
      },
      history: [
        {
          ts: '2026-06-10 20:15:00',
          win: '蓝队',
          winKey: 't1',
          aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
        }
      ]
    },
    players: [],
    createdAt: '2026-06-10T10:00:00.000Z'
  }],
  ['room:REOPN1', {
    roomCode: 'REOPN1',
    settings: {},
    state: {
      gameStatus: {
        ended: false,
        winnerKey: null,
        winnerName: null,
        reason: null
      },
      history: []
    },
    players: [],
    endGameVotes: {
      mvp: { 1: 2 },
      burden: { 2: 1 },
      fingerprints: ['stale-current-fingerprint']
    },
    createdAt: '2026-06-10T10:00:00.000Z'
  }],
  ['room:NOWIN1', {
    roomCode: 'NOWIN1',
    settings: {},
    state: {
      gameStatus: {
        ended: true,
        winnerKey: null,
        winnerName: null,
        reason: 'A_LEVEL_CLEARED'
      },
      history: []
    },
    players: [],
    createdAt: '2026-06-10T10:00:00.000Z'
  }]
]);

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).endsWith('/pipeline'),
    'room detail GET test should only hit the mocked KV pipeline endpoint'
  );
  const commands = JSON.parse(options.body || '[]');
  return new Response(JSON.stringify(commands.map(([command, key]) => {
    assert.equal(String(command).toLowerCase(), 'get');
    const room = roomsByKey.get(key);
    return {
      result: typeof room === 'string'
        ? room
        : room
          ? JSON.stringify(room)
          : null
    };
  })), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { default: roomDetailHandler } = await import('../../api/rooms/[code].js');

  const corruptResponse = await roomDetailHandler(new Request('https://example.test/api/rooms/BADJSN'));
  assert.equal(
    corruptResponse.status,
    404,
    'room detail GET should treat corrupt KV room payloads as unavailable instead of throwing a 500'
  );

  const legacyResponse = await roomDetailHandler(new Request('https://example.test/api/rooms/LEGACY', {
    headers: { Authorization: 'Bearer arbitrary-token' }
  }));
  assert.equal(legacyResponse.status, 200);
  const legacyBody = await legacyResponse.json();
  assert.equal(
    legacyBody.hostVerified,
    undefined,
    'legacy no-token room GET must not verify an arbitrary Bearer token as host auth'
  );
  assert.equal(
    Object.hasOwn(legacyBody.data, 'authToken'),
    false,
    'legacy no-token room GET should still keep authToken out of the response'
  );

  const staleResponse = await roomDetailHandler(new Request('https://example.test/api/rooms/STALE1'));
  assert.equal(staleResponse.status, 200);
  const staleBody = await staleResponse.json();
  assert.deepEqual(
    staleBody.data.state.gameStatus,
    {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    },
    'room detail GET should return reconciled gameStatus for stale-open completed rooms'
  );

  const noWinnerResponse = await roomDetailHandler(new Request('https://example.test/api/rooms/NOWIN1'));
  assert.equal(noWinnerResponse.status, 200);
  const noWinnerBody = await noWinnerResponse.json();
  assert.deepEqual(
    noWinnerBody.data.state.gameStatus,
    {
      ended: true,
      winnerKey: null,
      winnerName: null,
      reason: 'A_LEVEL_CLEARED'
    },
    'room detail GET should not launder invalid completed room statuses into open games'
  );

  const reopenedResponse = await roomDetailHandler(new Request('https://example.test/api/rooms/REOPN1'));
  assert.equal(reopenedResponse.status, 200);
  const reopenedBody = await reopenedResponse.json();
  assert.deepEqual(
    reopenedBody.data.endGameVotes,
    {
      mvp: {},
      burden: {}
    },
    'room detail GET should hide stale vote totals when a completed room is reopened'
  );

  const hostResponse = await roomDetailHandler(new Request('https://example.test/api/rooms/HOSTOK', {
    headers: { Authorization: 'Bearer stored-host-token' }
  }));
  assert.equal(hostResponse.status, 200);
  const hostBody = await hostResponse.json();
  assert.equal(hostBody.hostVerified, true, 'matching stored host token should verify host mode');
  assert.equal(
    Object.hasOwn(hostBody.data, 'authToken'),
    false,
    'verified host room GET should still strip authToken from the response data'
  );
  assert.deepEqual(
    hostBody.data.endGameVotes,
    {
      mvp: { 1: 2 },
      burden: { 2: 1 }
    },
    'room detail GET should expose vote totals without current vote fingerprints'
  );
  assert.deepEqual(
    hostBody.data.endGameVotesHistory,
    [
      {
        mvp: { 1: 1 },
        burden: { 2: 1 },
        completedAt: '2026-06-10T20:16:00.000Z'
      }
    ],
    'room detail GET should expose archived vote epochs without archived fingerprints'
  );

  const wrongHostResponse = await roomDetailHandler(new Request('https://example.test/api/rooms/HOSTOK', {
    headers: { Authorization: 'Bearer wrong-token' }
  }));
  assert.equal(wrongHostResponse.status, 403, 'wrong host token should be rejected before viewer data is returned');
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`${cases.length} room auth gate checks passed`);
