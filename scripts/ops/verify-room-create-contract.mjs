import assert from 'node:assert/strict';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';

let savedRoomKey = null;
let savedRoom = null;
let savedIndex = null;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).endsWith('/pipeline'),
    'room create contract test should only hit the mocked KV pipeline endpoint'
  );

  const commands = JSON.parse(options.body || '[]');
  return new Response(JSON.stringify(commands.map(command => {
    const [operation, key, ...args] = command;
    const normalizedOperation = String(operation).toLowerCase();

    if (normalizedOperation === 'get') {
      assert.ok(
        key === 'rooms:index' || /^room:[A-Z0-9]{6}$/.test(key),
        `unexpected get key: ${key}`
      );
      return { result: null };
    }

    if (normalizedOperation === 'setex') {
      savedRoomKey = key;
      const value = args.length >= 2 ? args[1] : args[0];
      savedRoom = JSON.parse(value);
      return { result: 'OK' };
    }

    if (normalizedOperation === 'set') {
      assert.equal(key, 'rooms:index');
      savedIndex = typeof args[0] === 'string' ? JSON.parse(args[0]) : args[0];
      return { result: 'OK' };
    }

    throw new Error(`Unexpected KV operation: ${normalizedOperation}`);
  })), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { default: handler } = await import('../../api/rooms/create.js');

  const response = await handler(new Request('https://example.test/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'CLIENT',
      authToken: 'client-token',
      isFavorite: true,
      favoritedAt: '2026-06-10T09:00:00.000Z',
      unfavoritedAt: '2026-06-10T09:30:00.000Z',
      endGameVotes: {
        mvp: { 1: 100 },
        burden: { 2: 99 },
        fingerprints: ['client-fingerprint']
      },
      endGameVotesHistory: [
        {
          mvp: { 1: 1 },
          burden: { 2: 1 },
          fingerprints: ['archived-client-fingerprint'],
          completedAt: '2026-06-10T09:45:00.000Z'
        }
      ],
      settings: {},
      state: {
        nextRoundBase: 'K',
        gameStatus: {
          ended: false,
          winnerKey: null,
          winnerName: null,
          reason: null
        },
        winner: 't2',
        history: [
          {
            ts: '2026-06-10 20:15:00',
            win: '蓝队',
            winKey: 't1',
            aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
          }
        ]
      },
      players: [
        { id: 1, name: 'Legacy Blue Team', emoji: 'B', team: 'A' },
        { id: 2, name: 'Legacy Red Team', emoji: 'R', team: 'B' }
      ]
    })
  }));

  const responseText = await response.text();
  assert.equal(response.status, 200, responseText);
  const body = JSON.parse(responseText);

  assert.equal(body.success, true);
  assert.match(body.roomCode, /^[A-Z0-9]{6}$/);
  assert.match(body.authToken, /^[a-f0-9]{64}$/);
  assert.notEqual(body.roomCode, 'CLIENT');
  assert.notEqual(body.authToken, 'client-token');
  assert.equal(
    body.createdAt,
    savedRoom.createdAt,
    'room create response should return the server-owned createdAt used for the stored room'
  );
  assert.equal(
    body.finishedAt,
    savedRoom.finishedAt,
    'room create response should return the server-owned finishedAt used for completed rooms'
  );

  assert.equal(savedRoomKey, `room:${body.roomCode}`);
  assert.equal(savedRoom.roomCode, body.roomCode);
  assert.equal(savedRoom.authToken, body.authToken);
  assert.equal(savedRoom.isFavorite, false, 'new rooms should not trust client-supplied favorite state');
  assert.equal(Object.hasOwn(savedRoom, 'favoritedAt'), false);
  assert.equal(Object.hasOwn(savedRoom, 'unfavoritedAt'), false);
  assert.deepEqual(
    savedRoom.endGameVotes,
    { mvp: {}, burden: {}, fingerprints: [] },
    'room create should initialize active vote state server-side'
  );
  assert.deepEqual(
    savedRoom.endGameVotesHistory,
    [],
    'room create should initialize archived vote epochs server-side'
  );
  assert.deepEqual(
    savedRoom.state.gameStatus,
    {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    },
    'room create should persist canonical completed gameStatus when history proves the game ended'
  );
  assert.equal(
    savedRoom.finishedAt,
    savedRoom.createdAt,
    'room create should initialize finishedAt when the canonical room state is already completed'
  );
  assert.equal(
    savedRoom.state.winner,
    't1',
    'room create should align legacy winner with canonical completed gameStatus'
  );
  assert.equal(
    savedRoom.state.nextRoundBase,
    null,
    'room create should clear stale pending next-round state when canonical gameStatus is completed'
  );
  assert.deepEqual(
    savedRoom.players.map(player => player.team),
    [1, 2],
    'room create should canonicalize legacy A/B player teams before persisting the room snapshot'
  );
  assert.deepEqual(
    savedIndex,
    [{ roomCode: body.roomCode, createdAt: savedRoom.createdAt }],
    'room create should add the generated room code to the browse index'
  );

  console.log('PASS room create initializes server-owned room fields');
} finally {
  globalThis.fetch = originalFetch;
}
