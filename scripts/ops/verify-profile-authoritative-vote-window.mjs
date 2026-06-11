import assert from 'node:assert/strict';

import { hashToken, initializePlayerStats } from '../../api/players/_utils.js';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';

const ownerToken = 'alice-owner-token';

const initialPlayer = {
  id: 'PLAYER_ALICE',
  handle: 'alice',
  displayName: 'Alice',
  emoji: 'A',
  playStyle: 'steady',
  tagline: 'ready',
  ownershipTokenHash: await hashToken(ownerToken),
  stats: initializePlayerStats(),
  recentGames: [],
  achievements: [],
  createdAt: '2026-06-10T10:00:00.000Z',
  lastActiveAt: '2026-06-10T10:00:00.000Z'
};

const reopenedRoom = {
  roomCode: 'REOPN1',
  authToken: 'room-host-token',
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
  players: [
    { id: 1, handle: 'alice', name: 'Alice', team: 1 },
    { id: 2, handle: 'bob', name: 'Bob', team: 2 }
  ],
  endGameVotes: {
    mvp: { 1: 5 },
    burden: { 1: 3 },
    fingerprints: ['stale-fingerprint']
  },
  endGameVotesHistory: [],
  createdAt: '2026-06-10T10:00:00.000Z'
};

let savedPlayer = null;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).endsWith('/pipeline'),
    'profile authoritative vote window test should only hit the mocked KV pipeline endpoint'
  );

  const commands = JSON.parse(options.body || '[]');
  return new Response(JSON.stringify(commands.map(command => {
    const [operation, key, ...args] = command;
    const normalizedOperation = String(operation).toLowerCase();

    if (normalizedOperation === 'get') {
      if (key === 'player:alice') {
        return { result: JSON.stringify(savedPlayer || initialPlayer) };
      }
      if (key === 'room:REOPN1') {
        return { result: JSON.stringify(reopenedRoom) };
      }
      if (key === 'room:MISS01') {
        return { result: null };
      }
    }

    if (normalizedOperation === 'set' && key === 'player:alice') {
      savedPlayer = JSON.parse(args[0]);
      return { result: 'OK' };
    }

    throw new Error(`Unexpected KV command: ${normalizedOperation} ${key}`);
  })), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { default: handler } = await import('../../api/players/[handle].js');

  const response = await handler(new Request('https://example.test/api/players/alice', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer room-host-token'
    },
    body: JSON.stringify({
      roomCode: 'REOPN1',
      mode: 'VOTE_ONLY',
      ranking: 0,
      team: 1,
      mvpVoteCount: 99,
      burdenVoteCount: 88
    })
  }));

  assert.equal(response.status, 200, await response.text());
  assert.equal(
    savedPlayer.stats.mvpVotes,
    0,
    'profile stats should not import stale MVP votes after a room is reopened'
  );
  assert.equal(
    savedPlayer.stats.burdenVotes,
    0,
    'profile stats should not import stale burden votes after a room is reopened'
  );
  assert.deepEqual(
    savedPlayer.stats.votingHistory.REOPN1,
    {
      mvp: 0,
      burden: 0,
      roomCode: 'REOPN1',
      lastSynced: savedPlayer.stats.votingHistory.REOPN1.lastSynced
    },
    'profile voting history should record the authoritative zero-count sync for reopened rooms'
  );

  savedPlayer = null;
  const missingRoomOwnerResponse = await handler(new Request('https://example.test/api/players/alice', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      roomCode: 'MISS01',
      mode: 'VOTE_ONLY',
      ranking: 0,
      team: 1,
      mvpVoteCount: 99,
      burdenVoteCount: 88
    })
  }));

  assert.equal(
    missingRoomOwnerResponse.status,
    403,
    'owner bearer should not authorize real-room vote imports when the room record is missing'
  );
  assert.equal(
    savedPlayer,
    null,
    'missing real-room owner vote imports should not write inflated client vote counts'
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('profile authoritative vote window checks passed');
