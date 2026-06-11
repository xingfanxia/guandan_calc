import assert from 'node:assert/strict';

const localStore = new Map();

globalThis.window = {
  location: {
    origin: 'https://example.test'
  }
};

globalThis.localStorage = {
  getItem(key) {
    return localStore.has(key) ? localStore.get(key) : null;
  },
  setItem(key, value) {
    localStore.set(key, String(value));
  },
  removeItem(key) {
    localStore.delete(key);
  }
};

const profileRequests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  profileRequests.push({
    url: String(url),
    body: JSON.parse(options.body || '{}')
  });

  return new Response(JSON.stringify({
    success: true,
    updatedStats: {},
    newAchievements: []
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { syncProfileStats } = await import('../../src/api/playerApi.js');
  const completedHistoryEntry = {
    ts: '2026-06-10 21:00:00',
    mode: '4',
    winKey: 't1',
    t1: 'A',
    t2: 'K',
    gameEndedAt: '2026-06-10T21:00:00.000Z',
    gameStatus: {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    }
  };

  await assert.doesNotReject(
    () => syncProfileStats(
      completedHistoryEntry,
      'LOCAL',
      null,
      {},
      null,
      null,
      null
    ),
    'profile sync should tolerate malformed player lists without breaking final-win side effects'
  );
  assert.equal(
    profileRequests.length,
    0,
    'malformed player lists should not issue profile update requests'
  );

  const players = [
    { id: 1, name: '蓝一', emoji: 'A', team: '1', handle: 'blue_one' },
    { id: 2, name: '蓝二', emoji: 'B', team: 1, handle: 'blue_two' },
    { id: 3, name: '红一', emoji: 'C', team: '2', handle: 'red_one' },
    { id: 4, name: '红二', emoji: 'D', team: 2, handle: 'red_two' },
    { id: 5, name: '旁观五', emoji: 'E', team: 1, handle: 'bench_five' },
    { id: 6, name: '旁观六', emoji: 'F', team: 1, handle: 'bench_six' },
    { id: 7, name: '旁观七', emoji: 'G', team: 2, handle: 'bench_seven' },
    { id: 8, name: '旁观八', emoji: 'H', team: 2, handle: 'bench_eight' },
    { id: 9, name: '坏队伍', emoji: 'I', team: null, handle: 'bad_team' }
  ];
  const sessionStats = {
    1: { games: 3, totalRank: 4, firstPlaceCount: 1, lastPlaceCount: 0, rankings: [1, 2, 1] },
    2: { games: 3, totalRank: 8, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [2, 3, 3] },
    3: { games: 3, totalRank: 9, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [3, 2, 4] },
    4: { games: 3, totalRank: 9, firstPlaceCount: 0, lastPlaceCount: 1, rankings: [4, 4, 1] },
    9: { games: 3, totalRank: 6, firstPlaceCount: 1, lastPlaceCount: 0, rankings: [1, 2, 3] }
  };

  await assert.doesNotReject(
    () => syncProfileStats(
      completedHistoryEntry,
      'LOCAL',
      players,
      sessionStats,
      null,
      null,
      null
    ),
    'profile sync should treat null session honors as an empty honor map'
  );

  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(
    profileRequests.length,
    4,
    'profile sync should still update valid-team players when session honors are null'
  );
  assert.deepEqual(
    profileRequests.map(request => request.body.honorsEarned),
    [[], [], [], []],
    'null session honors should produce empty honorsEarned arrays'
  );

  profileRequests.length = 0;

  syncProfileStats(
    completedHistoryEntry,
    'LOCAL',
    players,
    sessionStats,
    {},
    null,
    null
  );

  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(
    profileRequests.length,
    4,
    'profile sync should only update players with session stats and valid teams'
  );
  assert.equal(
    profileRequests.some(request => request.url.includes('bad_team')),
    false,
    'profile sync should skip stat-bearing players without a valid team instead of sending invalid backend payloads'
  );
  assert.deepEqual(
    profileRequests.map(request => request.body.mode),
    ['4P', '4P', '4P', '4P'],
    'profile sync should use the completed history entry mode, not the full player pool size'
  );
  assert.deepEqual(
    profileRequests[0].body.teammates,
    ['blue_two'],
    'profile sync should normalize raw string team values and not add bench players to teammate history'
  );
  assert.deepEqual(
    profileRequests[0].body.opponents,
    ['red_one', 'red_two'],
    'profile sync should normalize raw string team values and not add bench or invalid-team players to opponent history'
  );
  assert.equal(
    profileRequests[0].body.team,
    1,
    'profile sync should write normalized numeric team values to profile history'
  );

  profileRequests.length = 0;

  syncProfileStats(
    completedHistoryEntry,
    'LOCAL',
    players,
    sessionStats,
    {},
    { mvp: '1', burden: '4' },
    null
  );

  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));

  const votedMvpRequest = profileRequests.find(request => request.url.includes('blue_one'));
  const votedBurdenRequest = profileRequests.find(request => request.url.includes('red_two'));
  assert.equal(
    votedMvpRequest?.body.votedMVP,
    true,
    'profile sync should match string MVP vote ids to numeric player ids'
  );
  assert.equal(
    votedMvpRequest?.body.votedBurden,
    false,
    'profile sync should not mark unrelated players as burden votes'
  );
  assert.equal(
    votedBurdenRequest?.body.votedBurden,
    true,
    'profile sync should match string burden vote ids to numeric player ids'
  );
  assert.equal(
    votedBurdenRequest?.body.votedMVP,
    false,
    'profile sync should not mark unrelated players as MVP votes'
  );

  profileRequests.length = 0;
  await assert.doesNotReject(
    () => syncProfileStats(
      {
        ...completedHistoryEntry,
        winKey: 't1',
        gameStatus: {
          ended: true,
          winnerKey: 't2',
          winnerName: '红队',
          reason: 'A_LEVEL_CLEARED'
        }
      },
      'LOCAL',
      players,
      sessionStats,
      {},
      null,
      null
    ),
    'profile sync should tolerate legacy winKey conflicting with structured gameStatus'
  );

  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));

  const blueOneProfileRequest = profileRequests.find(request => request.url.includes('blue_one'));
  const redOneProfileRequest = profileRequests.find(request => request.url.includes('red_one'));
  assert.equal(
    blueOneProfileRequest?.body.teamWon,
    false,
    'profile sync should not credit blue team when structured gameStatus says red cleared'
  );
  assert.equal(
    redOneProfileRequest?.body.teamWon,
    true,
    'profile sync should credit red team from structured gameStatus even if legacy winKey is stale'
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('profile sync mode checks passed');
