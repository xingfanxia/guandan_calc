import assert from 'node:assert/strict';

const {
  isValidRoomCode,
  normalizeVoteFingerprint,
  normalizeVoteStore,
  publicVoteStore,
  publicVoteStoreForRoom,
  validateVotePayload
} = await import('../../api/rooms/_votes.js');

const endedRoom = {
  state: {
    gameStatus: {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    }
  },
  players: [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
    { id: 4, name: 'D' }
  ]
};

assert.deepEqual(validateVotePayload(endedRoom, { mvpPlayerId: '1', burdenPlayerId: 2, fingerprint: 'fp-ok' }), {
  ok: true,
  mvpPlayerId: '1',
  burdenPlayerId: '2',
  fingerprint: 'fp-ok'
});

assert.equal(
  validateVotePayload(endedRoom, { mvpPlayerId: '1', burdenPlayerId: 1, fingerprint: 'fp-ok' }).error,
  'same_person'
);

assert.equal(
  validateVotePayload(endedRoom, { mvpPlayerId: 1, burdenPlayerId: 99, fingerprint: 'fp-ok' }).error,
  'invalid_player'
);

assert.equal(
  validateVotePayload({ ...endedRoom, players: {} }, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'invalid_player',
  'malformed legacy room players payloads should reject votes instead of throwing'
);

assert.deepEqual(
  validateVotePayload({ ...endedRoom, players: [null, { id: 1 }, { bad: true }, { id: 2 }] }, {
    mvpPlayerId: 1,
    burdenPlayerId: 2,
    fingerprint: 'fp-ok'
  }),
  {
    ok: true,
    mvpPlayerId: '1',
    burdenPlayerId: '2',
    fingerprint: 'fp-ok'
  },
  'vote validation should ignore malformed room player entries instead of throwing'
);

assert.equal(
  validateVotePayload({ ...endedRoom, state: { gameStatus: { ended: false } } }, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'voting_not_open'
);

assert.equal(
  validateVotePayload({
    ...endedRoom,
    state: {
      gameStatus: {
        ended: true,
        winnerKey: null,
        winnerName: null,
        reason: 'A_LEVEL_CLEARED'
      },
      history: []
    }
  }, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'voting_not_open',
  'ended rooms without a resolvable winner should not open voting'
);

assert.equal(
  validateVotePayload({
    ...endedRoom,
    state: {
      gameStatus: { ended: false },
      history: [
        {
          win: '蓝队',
          winKey: 't1',
          aNote: '蓝队 在自己的A级胜方含末游，不通关，继续打到通关'
        }
      ]
    }
  }, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'voting_not_open',
  'non-clearing A-level notes should not open room voting'
);

assert.equal(
  validateVotePayload({
    ...endedRoom,
    state: {
      history: [
        {
          win: '坏数据',
          winKey: 'bad',
          aNote: '坏数据 A级通关（胜方无末游，在自己的A级）'
        }
      ]
    }
  }, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'voting_not_open',
  'legacy clear-note rooms with invalid winner keys should not open room voting'
);

assert.equal(
  validateVotePayload({
    ...endedRoom,
    state: {
      gameStatus: {
        ended: true,
        winnerKey: null,
        winnerName: null,
        reason: 'A_LEVEL_CLEARED'
      },
      history: [
        {
          win: '蓝队',
          winKey: 't1',
          aNote: '蓝队 A级胜利（但本局级牌为K，需在自己的A级获胜才能通关）'
        }
      ]
    }
  }, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'voting_not_open',
  'ended statuses missing a winner should not borrow one from a non-clearing history entry'
);

assert.equal(
  validateVotePayload({
    ...endedRoom,
    state: {
      gameStatus: {
        ended: true,
        winnerKey: 'bad',
        winnerName: '坏数据',
        reason: 'A_LEVEL_CLEARED'
      },
      history: []
    }
  }, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'voting_not_open',
  'completed statuses with invalid winner keys must not open room voting'
);

assert.deepEqual(
  validateVotePayload({
    ...endedRoom,
    state: {
      gameStatus: {
        ended: false,
        winnerKey: null,
        winnerName: null,
        reason: null
      },
      hist: [
        {
          win: '蓝队',
          winKey: 't1',
          aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
        }
      ]
    }
  }, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: 'fp-ok' }),
  {
    ok: true,
    mvpPlayerId: '1',
    burdenPlayerId: '2',
    fingerprint: 'fp-ok'
  },
  'legacy hist-only completed rooms should open room voting'
);

assert.equal(
  validateVotePayload(endedRoom, { mvpPlayerId: 'abc', burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'Missing player IDs'
);

assert.equal(
  validateVotePayload({
    ...endedRoom,
    players: [...endedRoom.players, { id: 100, name: 'Hundred' }]
  }, { mvpPlayerId: '1e2', burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'Missing player IDs',
  'vote payloads should reject exponent-form player IDs instead of normalizing them to a valid room player'
);

assert.equal(
  validateVotePayload(endedRoom, { mvpPlayerId: '01', burdenPlayerId: 2, fingerprint: 'fp-ok' }).error,
  'Missing player IDs',
  'vote payloads should reject leading-zero player IDs instead of accepting alternate representations'
);

assert.equal(
  validateVotePayload(endedRoom, { mvpPlayerId: 1, burdenPlayerId: 2 }).error,
  'invalid_fingerprint',
  'vote payloads without a fingerprint should not bypass server-side duplicate protection'
);

assert.equal(
  validateVotePayload(endedRoom, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: '   ' }).error,
  'invalid_fingerprint'
);

assert.equal(
  validateVotePayload(endedRoom, { mvpPlayerId: 1, burdenPlayerId: 2, fingerprint: 'x'.repeat(129) }).error,
  'invalid_fingerprint'
);

assert.equal(isValidRoomCode('ABC123'), true);
assert.equal(isValidRoomCode('abc123'), false);
assert.equal(isValidRoomCode('../BAD'), false);
assert.equal(isValidRoomCode('TOO-LONG'), false);

assert.deepEqual(
  normalizeVoteStore({ mvp: { 1: 2 }, fingerprints: 'bad-shape' }),
  { mvp: { 1: 2 }, burden: {}, fingerprints: [] }
);

assert.deepEqual(
  publicVoteStoreForRoom({
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
      mvp: { 1: 2 },
      burden: { 2: 1 },
      fingerprints: ['stale-fp']
    }
  }),
  { mvp: {}, burden: {} },
  'public vote reads should not expose stale votes after the room reopens'
);

assert.deepEqual(
  publicVoteStoreForRoom({
    state: endedRoom.state,
    endGameVotes: {
      mvp: { 1: 2 },
      burden: { 2: 1 },
      fingerprints: ['private-fp']
    }
  }),
  { mvp: { 1: 2 }, burden: { 2: 1 } },
  'public vote reads should still expose votes while the completed-game voting window is open'
);

assert.deepEqual(
  publicVoteStoreForRoom({
    state: {
      gameStatus: {
        ended: false,
        winnerKey: null,
        winnerName: null,
        reason: null
      },
      hist: [
        {
          win: '蓝队',
          winKey: 't1',
          aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
        }
      ]
    },
    endGameVotes: {
      mvp: { 1: 2 },
      burden: { 2: 1 },
      fingerprints: ['private-fp']
    }
  }),
  { mvp: { 1: 2 }, burden: { 2: 1 } },
  'public vote reads should expose votes for legacy hist-only completed rooms'
);

assert.deepEqual(
  normalizeVoteStore({
    mvp: {
      1: '2',
      '1e2': 5,
      '01': 4,
      2: 0,
      3: -1,
      4: 1.5,
      5: 'bad'
    },
    burden: {
      2: '3',
      7: null
    },
    fingerprints: ['fp-a', '', 42, 'fp-b']
  }),
  {
    mvp: { 1: 2 },
    burden: { 2: 3 },
    fingerprints: ['fp-a', 'fp-b']
  },
  'vote normalization should coerce valid numeric counts and drop invalid values'
);

assert.equal(normalizeVoteFingerprint('fp-a_123'), 'fp-a_123');
assert.equal(normalizeVoteFingerprint('  fp-a_123  '), 'fp-a_123');
assert.equal(normalizeVoteFingerprint(''), null);
assert.equal(normalizeVoteFingerprint({ toString: () => 'fp-a' }), null);
assert.equal(normalizeVoteFingerprint('x'.repeat(129)), null);

assert.deepEqual(
  normalizeVoteStore({
    mvp: { 1: 1 },
    burden: { 2: 1 },
    fingerprints: [
      'fp-a',
      'x'.repeat(129),
      { bad: true },
      ' fp-b '
    ]
  }),
  {
    mvp: { 1: 1 },
    burden: { 2: 1 },
    fingerprints: ['fp-a', 'fp-b']
  },
  'vote normalization should drop invalid or oversized fingerprints before persisting room data'
);

assert.deepEqual(
  publicVoteStore({
    mvp: { 1: 2 },
    burden: { 2: 1 },
    fingerprints: ['fp-private']
  }),
  {
    mvp: { 1: 2 },
    burden: { 2: 1 }
  },
  'public vote responses should expose only vote totals, not device fingerprints'
);

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).endsWith('/pipeline'),
    'room vote corrupt-KV test should only hit the mocked KV pipeline endpoint'
  );

  const commands = JSON.parse(options.body || '[]');
  return new Response(JSON.stringify(commands.map(([operation, key]) => {
    assert.equal(String(operation).toLowerCase(), 'get');
    assert.equal(key, 'room:BADJSN');
    return { result: 'not-json' };
  })), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { default: voteHandler } = await import('../../api/rooms/vote/[code].js');

  const corruptGetResponse = await voteHandler(new Request('https://example.test/api/rooms/vote/BADJSN', {
    method: 'GET'
  }));
  assert.equal(
    corruptGetResponse.status,
    200,
    'vote GET should treat corrupt KV room payloads like unavailable rooms instead of throwing a 500'
  );
  assert.deepEqual(await corruptGetResponse.json(), {
    success: true,
    votes: { mvp: {}, burden: {} }
  });

  const corruptPostResponse = await voteHandler(new Request('https://example.test/api/rooms/vote/BADJSN', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mvpPlayerId: 1,
      burdenPlayerId: 2,
      fingerprint: 'fp-ok'
    })
  }));
  assert.equal(
    corruptPostResponse.status,
    404,
    'vote POST should reject corrupt KV room payloads as unavailable instead of throwing a 500'
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('room vote validation checks passed');
