import assert from 'node:assert/strict';

const { applyRankingToPlayerStats } = await import('../../src/stats/statisticsUpdater.js');

const players = [
  { id: 1, name: '蓝头', team: 1 },
  { id: 2, name: '蓝二', team: 1 },
  { id: 3, name: '红三', team: 2 },
  { id: 4, name: '红末', team: 2 }
];

const baseStats = {
  1: {
    games: 1,
    totalRank: 4,
    firstPlaceCount: 0,
    lastPlaceCount: 1,
    rankings: [4]
  }
};

const completeRanking = { 1: 1, 2: 2, 3: 3, 4: 4 };

const invalidMode = applyRankingToPlayerStats({
  players,
  playerStats: baseStats,
  ranking: completeRanking,
  mode: '4abc'
});

assert.equal(invalidMode.ok, false);
assert.match(invalidMode.message, /模式|人数/);
assert.deepEqual(
  baseStats,
  {
    1: {
      games: 1,
      totalRank: 4,
      firstPlaceCount: 0,
      lastPlaceCount: 1,
      rankings: [4]
    }
  },
  'invalid modes must not mutate the caller-owned stats object'
);

const missingRank = applyRankingToPlayerStats({
  players,
  playerStats: {},
  ranking: { 1: 1, 2: 2, 4: 4 },
  mode: 4
});
assert.equal(missingRank.ok, false);
assert.match(missingRank.message, /第3名/);

const duplicatePlayer = applyRankingToPlayerStats({
  players,
  playerStats: {},
  ranking: { 1: 1, 2: 1, 3: 3, 4: 4 },
  mode: 4
});
assert.equal(duplicatePlayer.ok, false);
assert.match(duplicatePlayer.message, /重复/);

const valid = applyRankingToPlayerStats({
  players,
  playerStats: baseStats,
  ranking: completeRanking,
  mode: '4'
});

assert.equal(valid.ok, true);
assert.deepEqual(valid.playerStats[1], {
  games: 2,
  totalRank: 5,
  firstPlaceCount: 1,
  lastPlaceCount: 1,
  rankings: [4, 1]
});
assert.deepEqual(valid.playerStats[4], {
  games: 1,
  totalRank: 4,
  firstPlaceCount: 0,
  lastPlaceCount: 1,
  rankings: [4]
});

console.log('statistics updater checks passed');
