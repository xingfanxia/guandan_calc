import assert from 'node:assert/strict';

import { initializePlayerStats } from '../../api/players/_utils.js';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';
process.env.ADMIN_TOKEN = 'player-record-secret';

const validPlayer = {
  id: 'PLR_VALID1',
  handle: 'valid',
  displayName: 'Valid Player',
  emoji: 'V',
  playStyle: 'steady',
  tagline: 'ready',
  ownershipTokenHash: undefined,
  stats: initializePlayerStats(),
  recentGames: [
    {
      roomCode: 'BADJSN',
      mode: '4P',
      ranking: 1,
      team: 1,
      teamWon: true
    },
    {
      roomCode: 'BADTIM',
      mode: '4P',
      ranking: 2,
      team: 1,
      teamWon: false
    },
    {
      roomCode: 'NEGDUR',
      mode: '4P',
      ranking: 3,
      team: 2,
      teamWon: false
    },
    {
      roomCode: 'GOODTM',
      mode: '4P',
      ranking: 1,
      team: 1,
      teamWon: true
    }
  ],
  achievements: [],
  createdAt: '2026-06-10T10:00:00.000Z',
  lastActiveAt: '2026-06-10T10:00:00.000Z'
};

const badAchievementsPlayer = {
  ...validPlayer,
  id: 'PLR_BADACH',
  handle: 'badach',
  achievements: { newbie: true },
  recentGames: []
};

const malformedRelationsPlayer = {
  ...validPlayer,
  id: 'PLR_BADREL',
  handle: 'badrel',
  stats: {
    ...initializePlayerStats(),
    partners: [],
    opponents: []
  },
  recentGames: []
};

const migratedBadSessionHistoryPlayer = {
  ...validPlayer,
  id: 'PLR_BADSESS',
  handle: 'badsess',
  stats: {
    ...initializePlayerStats(),
    sessionHistory: []
  },
  recentGames: []
};

const legacyStreakPlayer = {
  ...validPlayer,
  id: 'PLR_STREAK',
  handle: 'streaky',
  stats: {
    honors: {},
    sessionHistory: {}
  },
  recentGames: [
    { roomCode: 'NEWEST', mode: '4P', ranking: 1, relativeRank: 1, team: 1, teamWon: true, rounds: 1 },
    { roomCode: 'MIDDLE', mode: '4P', ranking: 2, relativeRank: 2, team: 1, teamWon: true, rounds: 1 },
    { roomCode: 'OLDEST', mode: '4P', ranking: 4, relativeRank: 4, team: 2, teamWon: false, rounds: 1 }
  ]
};

const dirtyRecentGamesPlayer = {
  ...validPlayer,
  id: 'PLR_DIRTYREC',
  handle: 'dirtyrec',
  stats: {
    honors: {},
    sessionHistory: {}
  },
  recentGames: [
    { roomCode: 'GOODOLD', mode: '4P', ranking: 2, relativeRank: 2, team: 1, teamWon: false, rounds: 2, duration: 120 },
    { roomCode: 'BADOLD', mode: '4P', ranking: 'bad', relativeRank: 'bad', team: 2, teamWon: true, rounds: -5, duration: -100 }
  ]
};

const dirtyManualMigrationPlayer = {
  ...dirtyRecentGamesPlayer,
  id: 'PLR_DIRTYMAN',
  handle: 'dirtyman'
};

const records = new Map([
  ['player:valid', JSON.stringify(validPlayer)],
  ['player:badach', JSON.stringify(badAchievementsPlayer)],
  ['player:badrel', JSON.stringify(malformedRelationsPlayer)],
  ['player:badsess', JSON.stringify(migratedBadSessionHistoryPlayer)],
  ['player:streaky', JSON.stringify(legacyStreakPlayer)],
  ['player:dirtyrec', JSON.stringify(dirtyRecentGamesPlayer)],
  ['player:dirtyman', JSON.stringify(dirtyManualMigrationPlayer)],
  ['player:keyfix', JSON.stringify({
    ...validPlayer,
    id: 'PLR_KEYFIX',
    handle: 'ghost',
    recentGames: []
  })],
  ['player:corrupt', 'not-json'],
  ['room:BADJSN', 'not-json'],
  ['room:BADTIM', JSON.stringify({
    roomCode: 'BADTIM',
    createdAt: 'not-a-date',
    finishedAt: '2026-06-10T10:10:00.000Z'
  })],
  ['room:NEGDUR', JSON.stringify({
    roomCode: 'NEGDUR',
    createdAt: '2026-06-10T10:10:00.000Z',
    finishedAt: '2026-06-10T10:00:00.000Z'
  })],
  ['room:GOODTM', JSON.stringify({
    roomCode: 'GOODTM',
    createdAt: '2026-06-10T10:00:00.000Z',
    finishedAt: '2026-06-10T10:10:00.000Z'
  })]
]);

const writes = [];
const originalFetch = globalThis.fetch;

function normalizeCommands(body) {
  const parsed = JSON.parse(body || '[]');
  return Array.isArray(parsed?.[0]) ? parsed : [parsed];
}

globalThis.fetch = async (url, options = {}) => {
  assert.ok(
    String(url).endsWith('/pipeline'),
    `player record parsing test should only hit mocked KV pipeline endpoint, got ${url}`
  );

  const commands = normalizeCommands(options.body);
  const results = commands.map(([operation, key, ...args]) => {
    const normalizedOperation = String(operation).toLowerCase();

    if (normalizedOperation === 'get') {
      return { result: records.has(key) ? records.get(key) : null };
    }

    if (normalizedOperation === 'set') {
      records.set(key, args[0]);
      writes.push({ operation: 'set', key, value: JSON.parse(args[0]) });
      return { result: 'OK' };
    }

    if (normalizedOperation === 'del') {
      const deleted = records.delete(key) ? 1 : 0;
      writes.push({ operation: 'del', key });
      return { result: deleted };
    }

    throw new Error(`Unexpected KV operation: ${normalizedOperation}`);
  });

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const { default: profileHandler } = await import('../../api/players/[handle].js');
  const { default: touchHandler } = await import('../../api/players/touch.js');
  const { default: deleteHandler } = await import('../../api/players/delete.js');
  const { default: resetStatsHandler } = await import('../../api/players/reset-stats.js');
  const { default: migrateSingleHandler } = await import('../../api/players/migrate-single.js');
  const { default: backfillDurationHandler } = await import('../../api/players/backfill-duration.js');

  const keyScopedProfileResponse = await profileHandler(new Request('https://example.test/api/players/keyfix', {
    method: 'GET'
  }));
  assert.equal(keyScopedProfileResponse.status, 200);
  const keyScopedProfileBody = await keyScopedProfileResponse.json();
  assert.equal(
    keyScopedProfileBody.player.handle,
    'keyfix',
    'player profile GET should return the storage-key handle instead of stale embedded handle values'
  );

  const keyScopedTouchResponse = await touchHandler(new Request('https://example.test/api/players/touch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: 'keyfix' })
  }));
  assert.equal(keyScopedTouchResponse.status, 200);
  const keyScopedTouchWrite = writes.find(write => write.operation === 'set' && write.key === 'player:keyfix');
  assert.equal(
    keyScopedTouchWrite?.value.handle,
    'keyfix',
    'player touch should persist the storage-key handle instead of stale embedded handle values'
  );

  for (const [name, request, handler] of [
    ['profile GET', new Request('https://example.test/api/players/corrupt', { method: 'GET' }), profileHandler],
    ['profile update', new Request('https://example.test/api/players/corrupt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'PROFILE_UPDATE',
        adminToken: 'player-record-secret',
        tagline: 'new'
      })
    }), profileHandler],
    ['token rotate', new Request('https://example.test/api/players/corrupt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'ROTATE_TOKEN',
        adminToken: 'player-record-secret'
      })
    }), profileHandler],
    ['touch', new Request('https://example.test/api/players/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'corrupt' })
    }), touchHandler],
    ['delete', new Request('https://example.test/api/players/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'corrupt', adminToken: 'player-record-secret' })
    }), deleteHandler],
    ['reset stats', new Request('https://example.test/api/players/reset-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'corrupt', adminToken: 'player-record-secret' })
    }), resetStatsHandler],
    ['migrate single', new Request('https://example.test/api/players/migrate-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'corrupt', adminToken: 'player-record-secret' })
    }), migrateSingleHandler],
    ['backfill duration', new Request('https://example.test/api/players/backfill-duration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'corrupt', adminToken: 'player-record-secret' })
    }), backfillDurationHandler]
  ]) {
    const response = await handler(request);
    assert.equal(response.status, 404, `${name} should treat corrupt player records as missing`);
    assert.deepEqual(await response.json(), { error: 'Player not found' });
  }

  const migrateBadSessionHistoryResponse = await migrateSingleHandler(new Request('https://example.test/api/players/migrate-single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: 'badsess', adminToken: 'player-record-secret' })
  }));
  assert.equal(migrateBadSessionHistoryResponse.status, 200);
  const migrateBadSessionHistoryBody = await migrateBadSessionHistoryResponse.json();
  assert.equal(
    migrateBadSessionHistoryBody.normalizedSessionHistory,
    true,
    'single-player migration should report malformed sessionHistory normalization'
  );
  const migrateBadSessionHistoryWrite = writes.find(write => write.operation === 'set' && write.key === 'player:badsess');
  assert.deepEqual(
    migrateBadSessionHistoryWrite?.value.stats.sessionHistory,
    {},
    'single-player migration should persist sessionHistory as an object map, not leave malformed arrays in KV'
  );

  const migrateStreakResponse = await migrateSingleHandler(new Request('https://example.test/api/players/migrate-single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: 'streaky', adminToken: 'player-record-secret' })
  }));
  assert.equal(migrateStreakResponse.status, 200, await migrateStreakResponse.text());
  const migrateStreakWrite = writes.find(write => write.operation === 'set' && write.key === 'player:streaky');
  assert.equal(
    migrateStreakWrite?.value.stats.stats4P.currentWinStreak,
    2,
    'single-player migration should replay newest-first recentGames oldest-first so current mode win streak is correct'
  );
  assert.equal(
    migrateStreakWrite?.value.stats.stats4P.longestWinStreak,
    2,
    'single-player migration should rebuild mode longest win streaks'
  );
  assert.equal(
    migrateStreakWrite?.value.stats.stats4P.longestLossStreak,
    1,
    'single-player migration should rebuild mode longest loss streaks'
  );
  assert.deepEqual(
    migrateStreakWrite?.value.stats.stats4P.recentRankings,
    [1, 2, 4],
    'single-player migration should persist mode recent rankings newest-first after chronological replay'
  );

  const dirtyManualResponse = await migrateSingleHandler(new Request('https://example.test/api/players/migrate-single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: 'dirtyman', adminToken: 'player-record-secret' })
  }));
  const dirtyManualText = await dirtyManualResponse.text();
  assert.equal(dirtyManualResponse.status, 200, dirtyManualText);
  const dirtyManualBody = JSON.parse(dirtyManualText);
  assert.equal(
    dirtyManualBody.migratedGames,
    1,
    'single-player migration should skip malformed legacy recentGames records'
  );
  const dirtyManualWrite = writes.find(write => write.operation === 'set' && write.key === 'player:dirtyman');
  assert.equal(
    dirtyManualWrite?.value.stats.stats4P.sessionsPlayed,
    1,
    'single-player migration should count only valid legacy recentGames'
  );
  assert.equal(
    dirtyManualWrite?.value.stats.stats4P.roundsPlayed,
    2,
    'single-player migration should not let malformed legacy rounds make mode rounds negative'
  );
  assert.equal(
    dirtyManualWrite?.value.stats.stats4P.totalPlayTimeSeconds,
    120,
    'single-player migration should ignore malformed negative legacy durations'
  );
  assert.equal(
    dirtyManualWrite?.value.stats.stats4P.avgRankingPerSession,
    2,
    'single-player migration should not persist null/NaN ranking averages from malformed legacy rankings'
  );

  const backfillValidResponse = await backfillDurationHandler(new Request('https://example.test/api/players/backfill-duration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: 'valid', adminToken: 'player-record-secret' })
  }));
  assert.equal(backfillValidResponse.status, 200);
  const backfillValidBody = await backfillValidResponse.json();
  assert.equal(
    backfillValidBody.updated,
    1,
    'backfill duration should update only rooms with valid non-negative timestamps'
  );
  assert.ok(
    backfillValidBody.results.some(result => result.roomCode === 'BADTIM' && result.status === 'invalid_timestamps'),
    'backfill duration should reject malformed timestamp strings'
  );
  assert.ok(
    backfillValidBody.results.some(result => result.roomCode === 'NEGDUR' && result.status === 'invalid_timestamps'),
    'backfill duration should reject negative room durations'
  );
  const backfillWrite = writes.find(write => write.operation === 'set' && write.key === 'player:valid');
  assert.equal(
    backfillWrite?.value.recentGames.find(game => game.roomCode === 'GOODTM')?.duration,
    600,
    'backfill duration should persist the valid room duration in seconds'
  );
  assert.equal(
    backfillWrite?.value.recentGames.find(game => game.roomCode === 'BADTIM')?.duration,
    undefined,
    'backfill duration should not persist NaN/null duration for malformed timestamps'
  );
  assert.equal(
    backfillWrite?.value.recentGames.find(game => game.roomCode === 'NEGDUR')?.duration,
    undefined,
    'backfill duration should not persist negative durations'
  );

  const statsResponse = await profileHandler(new Request('https://example.test/api/players/valid', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'BADJSN',
      mode: '4P',
      ranking: 1,
      team: 1,
      gamesInSession: 1,
      sessionDuration: 0,
      firstPlaces: 1,
      lastPlaces: 0,
      teamWon: true,
      gameSessionKey: 'badjson-room-session',
      adminToken: 'player-record-secret'
    })
  }));

  assert.equal(
    statsResponse.status,
    200,
    `stats update with admin auth should skip corrupt room metadata instead of failing: ${await statsResponse.text()}`
  );
  assert.ok(
    writes.some(write => write.operation === 'set' && write.key === 'player:valid'),
    'valid stats update should still persist the player record'
  );

  const dirtyRecentGamesResponse = await profileHandler(new Request('https://example.test/api/players/dirtyrec', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'LOCAL',
      mode: '4P',
      ranking: 1,
      team: 1,
      gamesInSession: 1,
      sessionDuration: 0,
      firstPlaces: 1,
      lastPlaces: 0,
      teamWon: true,
      gameSessionKey: 'LOCAL:game:dirtyrec:t1:2026-06-10T10%3A15%3A00.000Z',
      adminToken: 'player-record-secret'
    })
  }));
  assert.equal(
    dirtyRecentGamesResponse.status,
    200,
    `stats update should skip malformed legacy recentGames during automatic mode migration: ${await dirtyRecentGamesResponse.text()}`
  );
  const dirtyRecentGamesWrite = writes.find(write => write.operation === 'set' && write.key === 'player:dirtyrec');
  assert.equal(
    dirtyRecentGamesWrite?.value.stats.stats4P.sessionsPlayed,
    2,
    'automatic mode migration should count only valid legacy recentGames plus the new stats update'
  );
  assert.equal(
    dirtyRecentGamesWrite?.value.stats.stats4P.roundsPlayed,
    3,
    'automatic mode migration should not let malformed legacy rounds make mode rounds negative'
  );
  assert.equal(
    dirtyRecentGamesWrite?.value.stats.stats4P.totalPlayTimeSeconds,
    120,
    'automatic mode migration should ignore malformed negative legacy durations'
  );
  assert.equal(
    dirtyRecentGamesWrite?.value.stats.stats4P.avgRankingPerSession,
    1.5,
    'automatic mode migration should not persist null/NaN mode ranking averages from malformed legacy rankings'
  );

  const badAchievementsResponse = await profileHandler(new Request('https://example.test/api/players/badach', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'LOCAL',
      mode: '4P',
      ranking: 1,
      team: 1,
      gamesInSession: 1,
      sessionDuration: 0,
      firstPlaces: 1,
      lastPlaces: 0,
      teamWon: true,
      gameSessionKey: 'LOCAL:game:badach:t1:2026-06-10T10%3A00%3A00.000Z',
      adminToken: 'player-record-secret'
    })
  }));

  assert.equal(
    badAchievementsResponse.status,
    200,
    `stats update should normalize malformed achievement history instead of throwing: ${await badAchievementsResponse.text()}`
  );
  const badAchievementsWrite = writes.find(write => write.operation === 'set' && write.key === 'player:badach');
  assert.ok(
    Array.isArray(badAchievementsWrite?.value.achievements),
    'stats update should persist achievements as an array even when the old record was malformed'
  );

  const malformedRelationsResponse = await profileHandler(new Request('https://example.test/api/players/badrel', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'LOCAL',
      mode: '4P',
      ranking: 2,
      team: 1,
      gamesInSession: 1,
      sessionDuration: 0,
      firstPlaces: 0,
      lastPlaces: 0,
      teamWon: true,
      teammates: ['ally_one'],
      opponents: ['opp_one'],
      gameSessionKey: 'LOCAL:game:badrel:t1:2026-06-10T10%3A30%3A00.000Z',
      adminToken: 'player-record-secret'
    })
  }));

  assert.equal(
    malformedRelationsResponse.status,
    200,
    `stats update should normalize malformed relation maps instead of silently dropping new relations: ${await malformedRelationsResponse.text()}`
  );
  const malformedRelationsWrite = writes.find(write => write.operation === 'set' && write.key === 'player:badrel');
  assert.deepEqual(
    malformedRelationsWrite?.value.stats.partners.ally_one,
    { games: 1, wins: 1, winRate: 1 },
    'stats update should persist new partner relations as object map entries after normalizing malformed arrays'
  );
  assert.deepEqual(
    malformedRelationsWrite?.value.stats.opponents.opp_one,
    { games: 1, wins: 1, winRate: 1 },
    'stats update should persist new opponent relations as object map entries after normalizing malformed arrays'
  );
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.ADMIN_TOKEN;
}

console.log('player record parsing checks passed');
