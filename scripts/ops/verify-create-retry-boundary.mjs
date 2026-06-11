import assert from 'node:assert/strict';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';

const originalFetch = globalThis.fetch;

function normalizeCommands(body) {
  const parsed = JSON.parse(body || '[]');
  return Array.isArray(parsed?.[0]) ? parsed : [parsed];
}

function jsonResult(value) {
  return { result: value === null ? null : JSON.stringify(value) };
}

let playerIdLookups = 0;
let playerCreateRecord = null;
let playerReverseLookup = null;

globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).endsWith('/pipeline'),
    `create retry boundary test should only hit mocked KV pipeline endpoint, got ${url}`
  );

  const commands = normalizeCommands(options.body);
  const results = commands.map(([operation, key, ...args]) => {
    const normalizedOperation = String(operation).toLowerCase();

    if (normalizedOperation === 'get') {
      if (key === 'player:newbie') return { result: null };
      if (String(key).startsWith('player_id:')) {
        playerIdLookups += 1;
        return playerIdLookups < 10
          ? { result: 'existing-handle' }
          : { result: null };
      }
      return { result: null };
    }

    if (normalizedOperation === 'set') {
      if (key === 'player:newbie') {
        playerCreateRecord = JSON.parse(args[0]);
      } else if (String(key).startsWith('player_id:')) {
        playerReverseLookup = { key, value: args[0] };
      }
      return { result: 'OK' };
    }

    throw new Error(`Unexpected player-create KV operation: ${normalizedOperation}`);
  });

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { default: createPlayerHandler } = await import('../../api/players/create.js');

  const response = await createPlayerHandler(new Request('https://example.test/api/players/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle: 'newbie',
      displayName: 'New Player',
      emoji: 'N',
      playStyle: 'steady',
      tagline: 'ready'
    })
  }));
  const body = await response.json();

  assert.equal(
    response.status,
    200,
    `player create should accept a unique ID found on the 10th retry, got ${response.status}: ${JSON.stringify(body)}`
  );
  assert.equal(body.success, true);
  assert.equal(playerIdLookups, 10);
  assert.equal(playerCreateRecord?.handle, 'newbie');
  assert.equal(playerReverseLookup?.value, 'newbie');
  assert.equal(playerReverseLookup?.key, `player_id:${playerCreateRecord.id}`);
} finally {
  globalThis.fetch = originalFetch;
}

let roomLookups = 0;
let savedRoom = null;
let roomIndexWrite = null;

globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).endsWith('/pipeline'),
    `room create retry boundary test should only hit mocked KV pipeline endpoint, got ${url}`
  );

  const commands = normalizeCommands(options.body);
  const results = commands.map(([operation, key, ...args]) => {
    const normalizedOperation = String(operation).toLowerCase();

    if (normalizedOperation === 'get') {
      if (String(key).startsWith('room:')) {
        roomLookups += 1;
        return roomLookups < 10
          ? jsonResult({ roomCode: 'TAKEN1' })
          : { result: null };
      }
      if (key === 'rooms:index') return { result: JSON.stringify([]) };
      return { result: null };
    }

    if (normalizedOperation === 'setex') {
      assert.ok(String(key).startsWith('room:'));
      savedRoom = JSON.parse(args[1]);
      return { result: 'OK' };
    }

    if (normalizedOperation === 'set') {
      if (key === 'rooms:index') {
        roomIndexWrite = JSON.parse(args[0]);
      }
      return { result: 'OK' };
    }

    throw new Error(`Unexpected room-create KV operation: ${normalizedOperation}`);
  });

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { default: createRoomHandler } = await import('../../api/rooms/create.js');

  const response = await createRoomHandler(new Request('https://example.test/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      settings: {},
      state: {
        teams: {
          t1: { lvl: '2', aFail: 0 },
          t2: { lvl: '2', aFail: 0 }
        },
        roundLevel: '2',
        roundOwner: null,
        nextRoundBase: null,
        gameStatus: {
          ended: false,
          winnerKey: null,
          winnerName: null,
          reason: null
        },
        history: [],
        winner: 't1'
      },
      players: []
    })
  }));
  const body = await response.json();

  assert.equal(
    response.status,
    200,
    `room create should accept a unique code found on the 10th retry, got ${response.status}: ${JSON.stringify(body)}`
  );
  assert.equal(body.success, true);
  assert.equal(roomLookups, 10);
  assert.equal(savedRoom?.roomCode, body.roomCode);
  assert.ok(savedRoom?.authToken);
  assert.deepEqual(roomIndexWrite, [{ roomCode: savedRoom.roomCode, createdAt: savedRoom.createdAt }]);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('create retry boundary checks passed');
