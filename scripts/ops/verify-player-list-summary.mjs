import assert from 'node:assert/strict';
import { initializePlayerStats, parseListPagination, summarizePlayerForList } from '../../api/players/_utils.js';
import playerListHandler from '../../api/players/list.js';

const fullStats = initializePlayerStats();
Object.assign(fullStats, {
  sessionsPlayed: 12,
  sessionsWon: 7,
  sessionWinRate: 7 / 12,
  avgRankingPerSession: 3.25,
  gamesPlayed: 12,
  wins: 7,
  winRate: 7 / 12,
  avgRanking: 3.25,
  mvpVotes: 3,
  burdenVotes: 2,
  partners: { alice: { games: 12, wins: 7, winRate: 7 / 12 } },
  opponents: { bob: { games: 10, wins: 4, winRate: 0.4 } },
  votingHistory: { ABC123: { mvp: 3, burden: 2 } },
  recentRankings: [1, 2, 3],
  ladder: { rating: 1180, sessions: 9, peak: 1205 }
});

const summary = summarizePlayerForList({
  id: 'PLR_DEMO',
  handle: 'demo',
  displayName: 'Demo Player',
  emoji: 'D',
  playStyle: 'steady',
  tagline: 'short tagline',
  photoBase64: 'data:image/png;base64,' + 'a'.repeat(120_000),
  ownershipTokenHash: 'secret',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastActiveAt: '2026-02-01T00:00:00.000Z',
  stats: fullStats,
  recentGames: [{ roomCode: 'ABC123' }],
  achievements: ['newbie']
});

assert.deepEqual(Object.keys(summary).sort(), [
  'createdAt',
  'displayName',
  'emoji',
  'handle',
  'id',
  'lastActiveAt',
  'playStyle',
  'stats',
  'tagline'
].sort());

assert.equal(summary.photoBase64, undefined);
assert.equal(summary.ownershipTokenHash, undefined);
assert.equal(summary.recentGames, undefined);
assert.equal(summary.achievements, undefined);
assert.equal(summary.stats.partners, undefined);
assert.equal(summary.stats.opponents, undefined);
assert.equal(summary.stats.votingHistory, undefined);
assert.equal(summary.stats.recentRankings, undefined);

assert.deepEqual(summary.stats, {
  sessionsPlayed: 12,
  sessionsWon: 7,
  sessionWinRate: 7 / 12,
  avgRankingPerSession: 3.25,
  gamesPlayed: 12,
  wins: 7,
  winRate: 7 / 12,
  avgRanking: 3.25,
  ladder: { rating: 1180, peak: 1205, sessions: 9 }
});

assert.deepEqual(summarizePlayerForList(null), null);
assert.deepEqual(summarizePlayerForList(undefined), undefined);

assert.deepEqual(
  summarizePlayerForList({
    id: 'PLR_CORRUPT',
    handle: 'corrupt',
    displayName: 'Corrupt Stats',
    emoji: 'C',
    playStyle: 'mystery',
    tagline: 'bad stats payload',
    stats: null
  }).stats,
  {
    sessionsPlayed: 0,
    sessionsWon: 0,
    sessionWinRate: 0,
    avgRankingPerSession: 0,
    gamesPlayed: 0,
    wins: 0,
    winRate: 0,
    avgRanking: 0,
    ladder: { rating: 1000, peak: 1000, sessions: 0 }
  },
  'player list summaries should tolerate null stats from legacy/corrupt KV records'
);

assert.deepEqual(
  summarizePlayerForList({
    id: 'PLR_BAD_NUMBERS',
    handle: 'bad_numbers',
    displayName: 'Bad Numbers',
    emoji: 'N',
    playStyle: 'mystery',
    tagline: 'bad numeric stats',
    stats: {
      sessionsPlayed: 'NaN',
      sessionsWon: -2,
      sessionWinRate: Infinity,
      avgRankingPerSession: {},
      gamesPlayed: '4',
      wins: null,
      winRate: '0.5',
      avgRanking: undefined
    }
  }).stats,
  {
    sessionsPlayed: 0,
    sessionsWon: 0,
    sessionWinRate: 0,
    avgRankingPerSession: 0,
    gamesPlayed: 4,
    wins: 0,
    winRate: 0.5,
    avgRanking: 0,
    ladder: { rating: 1000, peak: 1000, sessions: 0 }
  },
  'player list summaries should coerce only finite non-negative numeric stats'
);

assert.deepEqual(parseListPagination(new URLSearchParams('')), { limit: 20, offset: 0 });
assert.deepEqual(parseListPagination(new URLSearchParams('limit=50&offset=10')), { limit: 50, offset: 10 });
assert.deepEqual(parseListPagination(new URLSearchParams('limit=abc')), {
  error: 'Invalid limit. Must be an integer between 1 and 100.'
});
assert.deepEqual(parseListPagination(new URLSearchParams('limit=0')), {
  error: 'Invalid limit. Must be an integer between 1 and 100.'
});
assert.deepEqual(parseListPagination(new URLSearchParams('limit=101')), {
  error: 'Invalid limit. Must be an integer between 1 and 100.'
});
assert.deepEqual(parseListPagination(new URLSearchParams('offset=abc')), {
  error: 'Invalid offset. Must be an integer 0 or greater.'
});
assert.deepEqual(parseListPagination(new URLSearchParams('offset=-1')), {
  error: 'Invalid offset. Must be an integer 0 or greater.'
});
assert.deepEqual(parseListPagination(new URLSearchParams('offset=9007199254740992')), {
  error: 'Invalid offset. Must be a safe integer 0 or greater.'
});

const invalidLimitResponse = await playerListHandler(
  new Request('https://example.test/api/players/list?limit=abc', { method: 'GET' })
);
assert.equal(invalidLimitResponse.status, 400);
assert.equal(invalidLimitResponse.headers.get('Access-Control-Allow-Origin'), '*');
assert.deepEqual(await invalidLimitResponse.json(), {
  error: 'Invalid limit. Must be an integer between 1 and 100.'
});

const methodResponse = await playerListHandler(
  new Request('https://example.test/api/players/list', { method: 'POST' })
);
assert.equal(methodResponse.status, 405);
assert.equal(methodResponse.headers.get('Access-Control-Allow-Origin'), '*');

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  assert.equal(String(url).startsWith('https://kv.example.test'), true);
  const command = JSON.parse(options.body || '[]');

  if (command[0] === 'keys') {
    assert.deepEqual(command, ['keys', 'player:*']);
    return new Response(JSON.stringify({
      result: ['player:wrong_key', 'player:timeless', 'player:alice', 'player:padded', 'player:nickonly', 'player:malformed', 'player:broken-json', 'player:bob']
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  assert.ok(Array.isArray(command), 'expected KV pipeline command list');
  return new Response(JSON.stringify(command.map(([operation, key]) => {
    assert.equal(operation, 'get');
    const records = {
      'player:alice': {
        id: 'PLR_ALICE',
        handle: 'alice',
        displayName: 'Alice',
        emoji: 'A',
        playStyle: 'steady',
        tagline: 'clean',
        lastActiveAt: '2026-06-10T12:00:00.000Z',
        stats: initializePlayerStats()
      },
      'player:wrong_key': {
        id: 'PLR_WRONG_KEY',
        handle: 'ghost',
        displayName: 'Wrong Key Ghost',
        emoji: 'G',
        playStyle: 'mystery',
        tagline: 'key does not match handle',
        lastActiveAt: '2026-06-10T14:00:00.000Z',
        stats: initializePlayerStats()
      },
      'player:nickonly': {
        id: 'PLR_NICKONLY',
        handle: null,
        displayName: 'Alice Without Handle',
        emoji: 'N',
        playStyle: 'mystery',
        tagline: 'cannot open profile',
        lastActiveAt: '2026-06-10T13:30:00.000Z',
        stats: initializePlayerStats()
      },
      'player:padded': {
        id: 'PLR_PADDED',
        handle: ' alice ',
        displayName: 'Padded Alice',
        emoji: 'P',
        playStyle: 'mystery',
        tagline: 'cannot open profile',
        lastActiveAt: '2026-06-10T13:20:00.000Z',
        stats: initializePlayerStats()
      },
      'player:timeless': {
        id: 'PLR_TIMELESS',
        handle: 'timeless',
        displayName: 'Broken Timestamp',
        emoji: 'T',
        playStyle: 'mystery',
        tagline: 'bad date payload',
        createdAt: 'not-a-date',
        lastActiveAt: 'also-not-a-date',
        stats: initializePlayerStats()
      },
      'player:malformed': {
        id: 'PLR_BAD',
        handle: null,
        displayName: null,
        lastActiveAt: '2026-06-10T13:00:00.000Z'
      },
      'player:broken-json': 'not-json',
      'player:bob': {
        id: 'PLR_BOB',
        handle: 'bob',
        displayName: 'Bob',
        emoji: 'B',
        playStyle: 'chill',
        tagline: 'other',
        lastActiveAt: '2026-06-10T11:00:00.000Z',
        stats: initializePlayerStats()
      }
    };
    return {
      result: typeof records[key] === 'string'
        ? records[key]
        : JSON.stringify(records[key])
    };
  })), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const orderedResponse = await playerListHandler(
    new Request('https://example.test/api/players/list?limit=2', { method: 'GET' })
  );
  const orderedBody = await orderedResponse.json();
  assert.equal(
    orderedResponse.status,
    200,
    'player list should keep responding when one valid player has malformed timestamps'
  );
  assert.deepEqual(
    orderedBody.players.map(player => player.handle),
    ['alice', 'bob'],
    'player list should sort players with malformed timestamps after timestamped players before pagination'
  );
  assert.equal(
    orderedBody.total,
    3,
    'player list total should keep valid players even when their timestamps are malformed'
  );

  const searchResponse = await playerListHandler(
    new Request('https://example.test/api/players/list?q=ali', { method: 'GET' })
  );
  const searchBody = await searchResponse.json();

  assert.equal(
    searchResponse.status,
    200,
    'player list search should skip malformed player records instead of failing the whole request'
  );
  assert.deepEqual(
    searchBody.players.map(player => player.handle),
    ['alice'],
    'player list search should return only matching valid player summaries'
  );

  const spacedSearchResponse = await playerListHandler(
    new Request('https://example.test/api/players/list?q=%20ALI%20', { method: 'GET' })
  );
  const spacedSearchBody = await spacedSearchResponse.json();
  assert.equal(
    spacedSearchResponse.status,
    200,
    'player list search should accept padded mixed-case search queries'
  );
  assert.deepEqual(
    spacedSearchBody.players.map(player => player.handle),
    ['alice'],
    'player list search should trim and lowercase query text before matching'
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('player list summary checks passed');
