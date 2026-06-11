import assert from 'node:assert/strict';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';

function jsonRoomPayload(overrides = {}) {
  return {
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
    ...overrides
  };
}

const completedHistoryEntry = {
  ts: '2026-06-10 10:30:00',
  gameEndedAt: '2026-06-10T10:30:00.000Z',
  win: '蓝队',
  winKey: 't1',
  aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
};

function createRoomStore(initialRoom) {
  let savedRoom = null;

  const fetchMock = async (url, options = {}) => {
    assert.ok(
      String(url).endsWith('/pipeline'),
      'room update vote privacy test should only hit the mocked KV pipeline endpoint'
    );

    const commands = JSON.parse(options.body || '[]');
    return new Response(JSON.stringify(commands.map(command => {
      const [operation, key, ...args] = command;
      const normalizedOperation = String(operation).toLowerCase();

      assert.equal(key, 'room:HOSTOK');

      if (normalizedOperation === 'get') {
        return { result: JSON.stringify(savedRoom || initialRoom) };
      }

      if (normalizedOperation === 'set') {
        savedRoom = JSON.parse(args[0]);
        return { result: 'OK' };
      }

      if (normalizedOperation === 'setex') {
        const value = args.length >= 2 ? args[1] : args[0];
        savedRoom = JSON.parse(value);
        return { result: 'OK' };
      }

      throw new Error(`Unexpected KV operation: ${normalizedOperation}`);
    })), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  return {
    fetchMock,
    get savedRoom() {
      return savedRoom;
    }
  };
}

const existingRoom = {
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
    history: [completedHistoryEntry]
  },
  players: [],
  endGameVotes: {
    mvp: { 1: 2 },
    burden: { 2: 1 },
    fingerprints: ['fp-a', 'fp-b']
  },
  endGameVotesHistory: [
    {
      mvp: { 3: 4 },
      burden: { 4: 1 },
      fingerprints: ['archived-fp'],
      completedAt: '2026-06-10T10:30:00.000Z'
    }
  ],
  createdAt: '2026-06-10T10:00:00.000Z',
  finishedAt: '2026-06-10T10:30:00.000Z'
};

const originalFetch = globalThis.fetch;
const roomStore = createRoomStore(existingRoom);

try {
  const { default: handler } = await import('../../api/rooms/[code].js');

  const histOnlyRoomStore = createRoomStore({
    ...existingRoom,
    state: {
      gameStatus: {
        ended: false,
        winnerKey: null,
        winnerName: null,
        reason: null
      },
      hist: [
        {
          ts: '2026-06-10 20:15:00',
          win: '蓝队',
          winKey: 't1',
          aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
        }
      ]
    }
  });
  globalThis.fetch = histOnlyRoomStore.fetchMock;

  const histOnlyGetResponse = await handler(new Request('https://example.test/api/rooms/HOSTOK', {
    method: 'GET'
  }));
  assert.equal(histOnlyGetResponse.status, 200);
  const histOnlyGetBody = await histOnlyGetResponse.json();
  assert.deepEqual(
    histOnlyGetBody.data.state.gameStatus,
    {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    },
    'room GET should reconcile legacy state.hist completion into public gameStatus for viewers'
  );

  const legacyCompletedHistoryEntry = {
    ts: '2026-06-10 10:30:00',
    win: '蓝队',
    winKey: 't1',
    aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
  };
  const legacyCompletedRoom = {
    ...existingRoom,
    state: {
      gameStatus: {
        ended: true,
        winnerKey: 't1',
        winnerName: 'Blue Team',
        reason: 'A_LEVEL_CLEARED'
      },
      history: [legacyCompletedHistoryEntry]
    }
  };
  const legacySameGameStore = createRoomStore(legacyCompletedRoom);
  globalThis.fetch = legacySameGameStore.fetchMock;

  const legacySameGameUpdateResponse = await handler(new Request('https://example.test/api/rooms/HOSTOK', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer stored-host-token'
    },
    body: JSON.stringify(jsonRoomPayload({
      state: {
        gameStatus: {
          ended: false,
          winnerKey: null,
          winnerName: null,
          reason: null
        },
        history: [legacyCompletedHistoryEntry]
      }
    }))
  }));

  assert.equal(legacySameGameUpdateResponse.status, 200, await legacySameGameUpdateResponse.text());
  assert.deepEqual(
    legacySameGameStore.savedRoom.endGameVotes,
    legacyCompletedRoom.endGameVotes,
    'same legacy completed game PUT should preserve votes even when the client omits room-level finishedAt'
  );
  assert.equal(
    legacySameGameStore.savedRoom.finishedAt,
    legacyCompletedRoom.finishedAt,
    'same legacy completed game PUT should preserve server-owned finishedAt even when client omits it'
  );

  const conflictingStatusStore = createRoomStore({
    ...existingRoom,
    state: {
      gameStatus: {
        ended: true,
        winnerKey: 't2',
        winnerName: '红队',
        reason: 'A_LEVEL_CLEARED'
      },
      history: [
        {
          ts: '2026-06-10 20:15:00',
          win: '蓝队',
          winKey: 't1',
          aNote: '蓝队 A级通关（胜方无末游，在自己的A级）',
          gameStatus: {
            ended: true,
            winnerKey: 't1',
            winnerName: '蓝队',
            reason: 'A_LEVEL_CLEARED'
          }
        }
      ]
    }
  });
  globalThis.fetch = conflictingStatusStore.fetchMock;

  const conflictingStatusGetResponse = await handler(new Request('https://example.test/api/rooms/HOSTOK', {
    method: 'GET'
  }));
  assert.equal(conflictingStatusGetResponse.status, 200);
  const conflictingStatusGetBody = await conflictingStatusGetResponse.json();
  assert.deepEqual(
    conflictingStatusGetBody.data.state.gameStatus,
    {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    },
    'room GET should reconcile conflicting top-level status from latest structured history for viewers'
  );

  const malformedHistoryStore = createRoomStore({
    ...existingRoom,
    endGameVotesHistory: {
      mvp: { 1: 1 },
      burden: {},
      fingerprints: ['leaked-fp'],
      completedAt: '2026-06-10T10:45:00.000Z'
    }
  });
  globalThis.fetch = malformedHistoryStore.fetchMock;

  const malformedHistoryGetResponse = await handler(new Request('https://example.test/api/rooms/HOSTOK', {
    method: 'GET'
  }));
  assert.equal(malformedHistoryGetResponse.status, 200);
  const malformedHistoryGetBody = await malformedHistoryGetResponse.json();
  assert.deepEqual(
    malformedHistoryGetBody.data.endGameVotesHistory,
    [],
    'room GET should not expose malformed non-array vote history objects'
  );
  assert.equal(
    JSON.stringify(malformedHistoryGetBody.data).includes('leaked-fp'),
    false,
    'room GET should never expose archived vote fingerprints from malformed room records'
  );

  const mixedHistoryStore = createRoomStore({
    ...existingRoom,
    endGameVotesHistory: [
      'leaked-array-fingerprint',
      {
        mvp: { 1: 1 },
        burden: {},
        fingerprints: ['archived-fp'],
        completedAt: '2026-06-10T10:45:00.000Z'
      }
    ]
  });
  globalThis.fetch = mixedHistoryStore.fetchMock;

  const mixedHistoryGetResponse = await handler(new Request('https://example.test/api/rooms/HOSTOK', {
    method: 'GET'
  }));
  assert.equal(mixedHistoryGetResponse.status, 200);
  const mixedHistoryGetBody = await mixedHistoryGetResponse.json();
  assert.deepEqual(
    mixedHistoryGetBody.data.endGameVotesHistory,
    [
      {
        mvp: { 1: 1 },
        burden: {},
        completedAt: '2026-06-10T10:45:00.000Z'
      }
    ],
    'room GET should drop malformed primitive vote history entries and strip fingerprints from valid entries'
  );
  assert.equal(
    JSON.stringify(mixedHistoryGetBody.data).includes('fingerprint'),
    false,
    'room GET should never expose current, archived, or malformed vote fingerprints'
  );

  globalThis.fetch = roomStore.fetchMock;

  const endedUpdateResponse = await handler(new Request('https://example.test/api/rooms/HOSTOK', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer stored-host-token'
    },
    body: JSON.stringify(jsonRoomPayload({
      state: {
        nextRoundBase: 'K',
        gameStatus: {
          ended: false,
          winnerKey: null,
          winnerName: null,
          reason: null
        },
        winner: 't2',
        history: [completedHistoryEntry]
      },
      authToken: 'client-forged-token',
      createdAt: '1999-01-01T00:00:00.000Z',
      finishedAt: '1999-01-01T00:30:00.000Z',
      endGameVotes: {
        mvp: { 1: 3 },
        burden: { 2: 2 }
      },
      endGameVotesHistory: [
        {
          mvp: { 3: 99 },
          burden: { 4: 99 },
          completedAt: '2026-06-10T10:31:00.000Z'
        }
      ]
    }))
  }));

  assert.equal(endedUpdateResponse.status, 200, await endedUpdateResponse.text());
  assert.deepEqual(
    roomStore.savedRoom.endGameVotes,
    {
      mvp: { 1: 2 },
      burden: { 2: 1 },
      fingerprints: ['fp-a', 'fp-b']
    },
    'ended room PUT should preserve the authoritative active vote store instead of trusting public client vote totals'
  );
  assert.deepEqual(
    roomStore.savedRoom.endGameVotesHistory,
    existingRoom.endGameVotesHistory,
    'room PUT should preserve server-owned archived vote epochs instead of trusting public client vote history'
  );
  assert.equal(
    roomStore.savedRoom.authToken,
    'stored-host-token',
    'room PUT should continue preserving stored authToken over client body authToken'
  );
  assert.equal(
    roomStore.savedRoom.createdAt,
    existingRoom.createdAt,
    'room PUT should preserve server-owned createdAt over client body createdAt'
  );
  assert.equal(
    roomStore.savedRoom.finishedAt,
    existingRoom.finishedAt,
    'ended room PUT should preserve existing server-owned finishedAt over client body finishedAt'
  );
  assert.deepEqual(
    roomStore.savedRoom.state.gameStatus,
    {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    },
    'room PUT should persist canonical completed gameStatus when history proves the game ended'
  );
  assert.equal(
    roomStore.savedRoom.state.winner,
    't1',
    'room PUT should align legacy winner with canonical completed gameStatus'
  );
  assert.equal(
    roomStore.savedRoom.state.nextRoundBase,
    null,
    'room PUT should clear stale pending next-round state when canonical gameStatus is completed'
  );

  const nextCompletedGameStore = createRoomStore(existingRoom);
  globalThis.fetch = nextCompletedGameStore.fetchMock;

  const nextCompletedUpdateResponse = await handler(new Request('https://example.test/api/rooms/HOSTOK', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer stored-host-token'
    },
    body: JSON.stringify(jsonRoomPayload({
      state: {
        gameStatus: {
          ended: true,
          winnerKey: 't2',
          winnerName: '红队',
          reason: 'A_LEVEL_CLEARED'
        },
        history: [
          {
            ts: '2026-06-10 22:00:00',
            gameEndedAt: '2026-06-10T22:00:00.000Z',
            win: '红队',
            winKey: 't2',
            aNote: '红队 A级通关（胜方无末游，在自己的A级）'
          }
        ]
      }
    }))
  }));

  assert.equal(nextCompletedUpdateResponse.status, 200, await nextCompletedUpdateResponse.text());
  assert.deepEqual(
    nextCompletedGameStore.savedRoom.endGameVotes,
    {
      mvp: {},
      burden: {},
      fingerprints: []
    },
    'room PUT should clear active votes when the completed game identity changes'
  );
  assert.deepEqual(
    nextCompletedGameStore.savedRoom.endGameVotesHistory,
    existingRoom.endGameVotesHistory,
    'room PUT should still preserve archived vote epochs when a new completed game starts'
  );
  assert.notEqual(
    nextCompletedGameStore.savedRoom.finishedAt,
    existingRoom.finishedAt,
    'room PUT should not keep the previous game finishedAt for a different completed game'
  );
  assert.ok(
    Number.isFinite(new Date(nextCompletedGameStore.savedRoom.finishedAt).getTime()),
    'new completed game finishedAt should remain a valid timestamp'
  );

  globalThis.fetch = roomStore.fetchMock;

  const openUpdateResponse = await handler(new Request('https://example.test/api/rooms/HOSTOK', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer stored-host-token'
    },
    body: JSON.stringify(jsonRoomPayload({
      state: {
        gameStatus: {
          ended: false,
          winnerKey: null,
          winnerName: null,
          reason: null
        },
        history: []
      },
      endGameVotes: {
        mvp: {},
        burden: {},
        fingerprints: []
      },
      finishedAt: '1999-01-01T00:30:00.000Z'
    }))
  }));

  assert.equal(openUpdateResponse.status, 200, await openUpdateResponse.text());
  assert.equal(
    roomStore.savedRoom.createdAt,
    existingRoom.createdAt,
    'open room PUT should preserve server-owned createdAt over client body createdAt'
  );
  assert.equal(
    roomStore.savedRoom.finishedAt,
    null,
    'open room PUT should clear finishedAt server-side instead of trusting stale client body finishedAt'
  );
  assert.deepEqual(
    roomStore.savedRoom.endGameVotes,
    {
      mvp: {},
      burden: {},
      fingerprints: []
    },
    'open room PUT should still clear active vote fingerprints for the next voting window'
  );

  console.log('PASS room update preserves private vote fingerprints while ended');
  console.log('PASS room update clears private vote fingerprints when reopened');
} finally {
  globalThis.fetch = originalFetch;
}
