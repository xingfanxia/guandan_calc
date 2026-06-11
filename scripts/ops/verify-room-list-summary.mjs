import assert from 'node:assert/strict';

const { default: roomListHandler, summarizeRoomForList } = await import('../../api/rooms/list.js');
const { buildFavoriteIndexEntry } = await import('../../api/rooms/favorite/[code].js');

const room = {
  roomCode: 'ABC123',
  createdAt: '2026-06-10T10:00:00.000Z',
  lastUpdated: '2026-06-10T10:10:00.000Z',
  isFavorite: true,
  settings: {
    t1: { name: '北队' },
    t2: { name: '南队' }
  },
  state: {
    history: [{ round: 1 }, { round: 2 }],
    roundLevel: 'A',
    gameStatus: {
      ended: false
    }
  },
  players: [
    { handle: 'alice' },
    { profileHandle: 'legacy_bob' },
    { handle: 'test_bot' },
    { name: '临时玩家' }
  ]
};

const summary = summarizeRoomForList(room);
assert.deepEqual(summary, {
  roomCode: 'ABC123',
  createdAt: '2026-06-10T10:00:00.000Z',
  lastUpdated: '2026-06-10T10:10:00.000Z',
  isFavorite: true,
  playerCount: 4,
  playerHandles: ['alice', 'legacy_bob', 'test_bot'],
  currentRound: 3,
  isFinished: false,
  winnerKey: null,
  winnerName: null,
  statusText: 'LIVE',
  teamNames: ['北队', '南队']
});

const favoriteEntry = buildFavoriteIndexEntry(room, '2026-06-10T10:20:00.000Z');
assert.equal(favoriteEntry.roomCode, 'ABC123');
assert.equal(favoriteEntry.favoritedAt, '2026-06-10T10:20:00.000Z');
assert.deepEqual(favoriteEntry.teamNames, ['北队', '南队']);
assert.deepEqual(favoriteEntry.playerHandles, ['alice', 'legacy_bob', 'test_bot']);
assert.equal(favoriteEntry.currentRound, 3);
assert.equal(favoriteEntry.isFinished, false);
assert.equal(favoriteEntry.statusText, 'LIVE');

const staleOpenFinishedRoom = {
  ...room,
  state: {
    history: [
      {
        win: '北队',
        winKey: 't1',
        aNote: '北队 A级通关（胜方无末游，在自己的A级）'
      }
    ],
    gameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    }
  },
  finishedAt: null
};

const staleOpenSummary = summarizeRoomForList(staleOpenFinishedRoom);
assert.equal(
  staleOpenSummary.isFinished,
  true,
  'room list summary should reconcile stale-open gameStatus with completed history'
);
assert.equal(staleOpenSummary.currentRound, 1);
assert.equal(
  staleOpenSummary.winnerKey,
  't1',
  'room list summary should expose the resolved completed winner key'
);
assert.equal(
  staleOpenSummary.winnerName,
  '北队',
  'room list summary should expose the resolved completed winner name'
);
assert.equal(
  staleOpenSummary.statusText,
  '北队通关',
  'room list summary should expose a winner-specific completed status label'
);

const explicitRoundSummary = summarizeRoomForList({
  ...room,
  state: {
    ...room.state,
    roundNumber: '3'
  }
});
assert.equal(
  explicitRoundSummary.currentRound,
  3,
  'room list summary should accept positive integer roundNumber strings from legacy records'
);

const malformedExplicitRoundSummary = summarizeRoomForList({
  ...room,
  state: {
    ...room.state,
    history: [{ round: 1 }, { round: 2 }],
    roundNumber: '2.5'
  }
});
assert.equal(
  malformedExplicitRoundSummary.currentRound,
  3,
  'room list summary should ignore fractional roundNumber values instead of displaying impossible rounds'
);

const reopenedRoomWithStaleLegacyFinish = {
  ...room,
  state: {
    history: [],
    gameEnded: true,
    gameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    }
  },
  finishedAt: '2026-06-10T10:40:00.000Z'
};

const reopenedSummary = summarizeRoomForList(reopenedRoomWithStaleLegacyFinish);
assert.equal(
  reopenedSummary.isFinished,
  false,
  'explicit open gameStatus should override stale legacy finishedAt/gameEnded fields'
);
assert.equal(reopenedSummary.currentRound, 1);
assert.equal(reopenedSummary.winnerKey, null);
assert.equal(reopenedSummary.winnerName, null);
assert.equal(reopenedSummary.statusText, 'LIVE');

const malformedRoom = {
  roomCode: 'bad<script>',
  createdAt: '2026-06-10T10:00:00.000Z',
  settings: {
    teamNames: ['Blue', 42, { name: 'bad' }, '', 'Red'],
    t1: { name: { nested: true } },
    t2: { name: 'Ignored when teamNames exists' }
  },
  state: {
    history: []
  },
  players: [
    { handle: 'alice' },
    { handle: 42 },
    { profileHandle: { toString: () => 'bad' } },
    { handle: 'session' },
    { handle: ' Session ' },
    { profileHandle: 'SESSION' },
    { profileHandle: 'legacy_bob' },
    { handle: '__proto__' },
    { handle: '__proto__', profileHandle: 'legacy_dan' },
    { handle: 'session', profileHandle: 'legacy_carol' }
  ]
};

const malformedSummary = summarizeRoomForList(malformedRoom, { roomCode: 'ZXCVBN' });
assert.equal(malformedSummary.roomCode, 'ZXCVBN');
assert.deepEqual(malformedSummary.teamNames, ['Blue', 'Red']);
assert.deepEqual(
  malformedSummary.playerHandles,
  ['alice', 'legacy_bob', 'legacy_dan', 'legacy_carol'],
  'room summary should emit only valid player handles and fall back to legacy profileHandle when needed'
);

const unlistableSummary = summarizeRoomForList({ ...malformedRoom, roomCode: '<bad>' }, { roomCode: '../BAD' });
assert.equal(unlistableSummary.roomCode, null);

const malformedPlayersSummary = summarizeRoomForList({
  ...room,
  players: {
    alice: { handle: 'alice' },
    bob: { profileHandle: 'legacy_bob' }
  }
});
assert.equal(malformedPlayersSummary.playerCount, 0);
assert.deepEqual(
  malformedPlayersSummary.playerHandles,
  [],
  'room summary should ignore non-array legacy players instead of throwing'
);

const stringFavoriteEntry = buildFavoriteIndexEntry(
  JSON.stringify({
    ...room,
    state: {
      history: [{ round: 1 }, { round: 2 }, { round: 3 }],
      gameStatus: {
        ended: false
      }
    }
  }),
  '2026-06-10T10:30:00.000Z'
);
assert.equal(
  stringFavoriteEntry.gameCount,
  3,
  'favorite index should count history from string room payloads returned by KV'
);

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';

const originalFetch = globalThis.fetch;
const roomRecords = {
  'rooms:index': [
    { roomCode: 'ABC123', createdAt: '2026-06-10T10:00:00.000Z' },
    { roomCode: 'BOB123', createdAt: '2026-06-10T10:00:00.000Z' }
  ],
  'room:ABC123': {
    ...room,
    roomCode: 'ABC123',
    players: [{ handle: 'alice' }]
  },
  'room:BOB123': {
    ...room,
    roomCode: 'BOB123',
    players: [{ handle: 'bob' }]
  }
};

function roomRecordResult(key) {
  const record = roomRecords[key];
  return record === undefined ? null : JSON.stringify(record);
}

globalThis.fetch = async (url, options = {}) => {
  assert.equal(String(url).startsWith('https://kv.example.test'), true);
  const command = JSON.parse(options.body || '[]');

  if (Array.isArray(command[0])) {
    return new Response(JSON.stringify(command.map(([operation, key]) => {
      assert.equal(String(operation).toLowerCase(), 'get');
      return { result: roomRecordResult(key) };
    })), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  assert.equal(String(command[0]).toLowerCase(), 'get');
  return new Response(JSON.stringify({
    result: roomRecordResult(command[1])
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  roomRecords['rooms:index'] = [
    { roomCode: 'BAD123', createdAt: 'not-a-date' },
    { roomCode: 'ABC123', createdAt: '2026-06-10T10:00:00.000Z' },
    { roomCode: 'BOB123', createdAt: '2026-06-10T10:00:00.000Z' }
  ];
  roomRecords['room:BAD123'] = {
    ...room,
    roomCode: 'BAD123',
    createdAt: 'not-a-date',
    lastUpdated: 'also-not-a-date',
    players: [{ handle: 'charlie' }]
  };

  const badDateResponse = await roomListHandler(
    new Request('https://example.test/api/rooms/list?page=1&limit=1', { method: 'GET' })
  );
  const badDateBody = await badDateResponse.json();
  assert.equal(
    badDateResponse.status,
    200,
    'room list should keep responding when one room has malformed dates'
  );
  assert.deepEqual(
    badDateBody.rooms.map(filteredRoom => filteredRoom.roomCode),
    ['ABC123'],
    'room list should drop rooms with unrenderable dates before sorting and pagination'
  );
  assert.equal(
    badDateBody.pagination.total,
    2,
    'room list pagination total should count only renderable room summaries'
  );

  roomRecords['rooms:index'] = [
    { roomCode: 'ABC123', createdAt: '2026-06-10T10:00:00.000Z' },
    { roomCode: 'BOB123', createdAt: '2026-06-10T10:00:00.000Z' }
  ];

  const paddedPlayerResponse = await roomListHandler(
    new Request('https://example.test/api/rooms/list?player=%20ALI%20', { method: 'GET' })
  );
  const paddedPlayerBody = await paddedPlayerResponse.json();
  assert.equal(
    paddedPlayerResponse.status,
    200,
    'room list player filter should accept padded mixed-case handles'
  );
  assert.deepEqual(
    paddedPlayerBody.rooms.map(filteredRoom => filteredRoom.roomCode),
    ['ABC123'],
    'room list player filter should trim and lowercase before matching handles'
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('room list summary checks passed');
