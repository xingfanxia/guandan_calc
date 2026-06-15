import assert from 'node:assert/strict';

import { hashToken, initializePlayerStats } from '../../api/players/_utils.js';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';
// Admin-authorize the PUTs so they bypass the anti-cheat review queue and
// exercise the apply path directly (an approved session applies the same way:
// api/players/pending.js replays it with an admin token). The authoritative
// teamWon/vote overrides run regardless of which credential authorized.
process.env.ADMIN_TOKEN ||= 'authoritative-session-admin-secret';

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

const freshStats = initializePlayerStats();
freshStats.recentRankings.push(1);
freshStats.stats6P.recentRankings.push(6);
assert.deepEqual(
  freshStats.stats4P.recentRankings,
  [],
  'fresh top-level rankings should not share the 4P rankings array'
);
assert.deepEqual(
  freshStats.stats8P.recentRankings,
  [],
  'fresh 6P rankings should not share the 8P rankings array'
);

const completedRoom = {
  roomCode: 'AUTHW1',
  authToken: 'room-host-token',
  settings: {},
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
        gameEndedAt: '2026-06-10T20:15:00.000Z',
        winKey: 't2',
        win: '红队',
        gameStatus: {
          ended: true,
          winnerKey: 't2',
          winnerName: '红队',
          reason: 'A_LEVEL_CLEARED'
        }
      }
    ]
  },
  finishedAt: '2026-06-10T20:15:00.000Z',
  players: [
    { id: 1, handle: 'alice', name: 'Alice', team: 1 },
    { id: 2, handle: 'bob', name: 'Bob', team: 2 },
    { id: 3, handle: 'carol', name: 'Carol', team: 1 },
    { id: 4, handle: 'dave', name: 'Dave', team: 2 }
  ],
  endGameVotes: {
    mvp: {},
    burden: {},
    fingerprints: []
  },
  endGameVotesHistory: [],
  createdAt: '2026-06-10T10:00:00.000Z'
};

let savedPlayer = null;
let activePlayer = initialPlayer;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).endsWith('/pipeline'),
    'profile authoritative session result test should only hit the mocked KV pipeline endpoint'
  );

  const commands = JSON.parse(options.body || '[]');
  return new Response(JSON.stringify(commands.map(command => {
    const [operation, key, ...args] = command;
    const normalizedOperation = String(operation).toLowerCase();

    if (normalizedOperation === 'get') {
      if (key === 'player:alice') {
        return { result: JSON.stringify(savedPlayer || activePlayer) };
      }
      if (key === 'room:AUTHW1' || key === 'room:AUTHW6') {
        return { result: JSON.stringify({ ...completedRoom, roomCode: key.slice('room:'.length) }) };
      }
      // Ladder application reads the other participants' profiles to compute team
      // averages; this test doesn't seed them, so they resolve to base-rated guests.
      if (typeof key === 'string' && key.startsWith('player:')) {
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
      roomCode: 'AUTHW1',
      mode: '4P',
      ranking: 4,
      relativeRank: 4,
      team: 1,
      teamWon: true,
      gamesInSession: 1,
      firstPlaces: 0,
      lastPlaces: 1,
      sessionDuration: 1200,
      adminToken: process.env.ADMIN_TOKEN,
      gameSessionKey: 'client-stale-session-key',
      teammates: ['carol'],
      opponents: ['bob', 'dave'],
      honorsEarned: []
    })
  }));

  assert.equal(response.status, 200, await response.text());
  assert.equal(savedPlayer.stats.sessionsPlayed, 1);
  assert.equal(
    savedPlayer.stats.sessionsWon,
    0,
    'real-room profile stats should derive teamWon from the room winner, not from the client payload'
  );
  assert.equal(savedPlayer.stats.currentWinStreak, 0);
  assert.equal(savedPlayer.stats.currentLossStreak, 1);
  assert.equal(savedPlayer.stats.stats4P.sessionsWon, 0);
  assert.equal(savedPlayer.stats.stats4P.currentWinStreak, 0);
  assert.equal(savedPlayer.stats.stats4P.currentLossStreak, 1);
  assert.equal(savedPlayer.stats.partners.carol.wins, 0);
  assert.equal(savedPlayer.stats.opponents.bob.wins, 0);
  assert.equal(savedPlayer.recentGames[0].teamWon, false);

  const sessionHistory = Object.values(savedPlayer.stats.sessionHistory);
  assert.equal(sessionHistory.length, 1);
  assert.equal(sessionHistory[0].teamWon, false);

  const halfMigratedStats = initializePlayerStats();
  delete halfMigratedStats.stats6P;
  delete halfMigratedStats.stats8P;
  delete halfMigratedStats.modeBreakdown;
  activePlayer = {
    ...initialPlayer,
    stats: halfMigratedStats,
    recentGames: []
  };
  savedPlayer = null;

  const halfMigratedResponse = await handler(new Request('https://example.test/api/players/alice', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer room-host-token'
    },
    body: JSON.stringify({
      roomCode: 'AUTHW6',
      mode: '6P',
      ranking: 5,
      relativeRank: 5,
      team: 1,
      teamWon: true,
      gamesInSession: 1,
      firstPlaces: 0,
      lastPlaces: 0,
      sessionDuration: 900,
      adminToken: process.env.ADMIN_TOKEN,
      gameSessionKey: 'AUTHW6:game:1:t2:2026-06-10T20%3A15%3A00.000Z',
      teammates: ['carol'],
      opponents: ['bob', 'dave'],
      honorsEarned: []
    })
  }));

  assert.equal(halfMigratedResponse.status, 200, await halfMigratedResponse.text());
  assert.equal(
    savedPlayer.stats.stats6P.sessionsPlayed,
    1,
    'semi-migrated profiles should initialize missing 6P stats before applying a 6P session'
  );
  assert.equal(
    savedPlayer.stats.modeBreakdown['6P'],
    1,
    'semi-migrated profiles should initialize and update modeBreakdown for 6P sessions'
  );
  assert.equal(
    savedPlayer.stats.stats8P.sessionsPlayed,
    0,
    'semi-migrated profiles should backfill untouched 8P stats without incrementing them'
  );

  const malformedModeStats = initializePlayerStats();
  const malformedStatsBucket = {
    sessionsPlayed: 'bad',
    sessionsWon: 'bad',
    sessionWinRate: 'bad',
    avgRankingPerSession: 'bad',
    avgRoundsPerSession: 'bad',
    longestSessionRounds: 'bad',
    roundsPlayed: 'bad',
    avgRankingPerRound: 'bad',
    totalPlayTimeSeconds: 'bad',
    longestSessionSeconds: 'bad',
    avgSessionSeconds: 'bad',
    recentRankings: 'bad',
    currentWinStreak: 'bad',
    longestWinStreak: 'bad',
    currentLossStreak: 'bad',
    longestLossStreak: 'bad'
  };
  Object.assign(malformedModeStats, malformedStatsBucket);
  malformedModeStats.stats6P = { ...malformedStatsBucket };
  malformedModeStats.modeBreakdown = {
    '4P': 0,
    '6P': 'bad',
    '8P': 0
  };
  activePlayer = {
    ...initialPlayer,
    stats: malformedModeStats,
    recentGames: []
  };
  savedPlayer = null;

  const malformedModeStatsResponse = await handler(new Request('https://example.test/api/players/alice', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer room-host-token'
    },
    body: JSON.stringify({
      roomCode: 'AUTHW6',
      mode: '6P',
      ranking: 5,
      relativeRank: 5,
      team: 1,
      teamWon: true,
      gamesInSession: 1,
      firstPlaces: 0,
      lastPlaces: 0,
      sessionDuration: 900,
      adminToken: process.env.ADMIN_TOKEN,
      gameSessionKey: 'AUTHW6:game:2:t2:2026-06-10T20%3A15%3A00.000Z',
      teammates: ['carol'],
      opponents: ['bob', 'dave'],
      honorsEarned: []
    })
  }));

  assert.equal(malformedModeStatsResponse.status, 200, await malformedModeStatsResponse.text());
  assert.equal(
    savedPlayer.stats.stats6P.sessionsPlayed,
    1,
    'malformed existing 6P counters should be reset before applying the new session'
  );
  assert.equal(savedPlayer.stats.sessionsPlayed, 1);
  assert.deepEqual(savedPlayer.stats.recentRankings, [5]);
  assert.equal(savedPlayer.stats.stats6P.sessionsWon, 0);
  assert.equal(savedPlayer.stats.stats6P.roundsPlayed, 1);
  assert.deepEqual(savedPlayer.stats.stats6P.recentRankings, [5]);
  assert.equal(savedPlayer.stats.stats6P.currentWinStreak, 0);
  assert.equal(savedPlayer.stats.stats6P.currentLossStreak, 1);
  assert.equal(
    savedPlayer.stats.modeBreakdown['6P'],
    1,
    'malformed modeBreakdown counters should be reset before incrementing'
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('profile authoritative session result checks passed');
