import assert from 'node:assert/strict';

const storage = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
  clear() {
    storage.clear();
  }
};

const { KEYS } = await import('../../src/core/storage.js');
const { isValidRoomSnapshotPayload } = await import('../../shared/roomSnapshotValidation.js');
const { on: onEvent } = await import('../../src/core/events.js');

localStorage.setItem(KEYS.STATE, JSON.stringify({
  teams: {
    t1: { lvl: 10, aFail: 1 },
    t2: { lvl: 'A', aFail: 0 }
  },
  roundLevel: 10,
  roundOwner: 't1',
  nextRoundBase: 10,
  winner: 't2',
  history: []
}));

const { default: legacyLevelState } = await import('../../src/core/state.js?legacy-levels');
legacyLevelState.hydrate();
assert.equal(legacyLevelState.getTeamLevel('t1'), '10');
assert.equal(legacyLevelState.getTeamLevel('t2'), 'A');
assert.equal(legacyLevelState.getRoundLevel(), '10');
assert.equal(legacyLevelState.getNextRoundBase(), '10');
assert.deepEqual(legacyLevelState.getTeam('t1'), { lvl: '10', aFail: 1 });
storage.clear();

localStorage.setItem(KEYS.PLAYERS, JSON.stringify([
  { id: '1', name: '旧蓝', team: 'A' },
  { id: '2', name: '旧红', team: 'B' },
  { id: '3', name: '未分配', team: null }
]));

const { default: legacyTeamState } = await import('../../src/core/state.js?legacy-player-teams');
legacyTeamState.hydrate();
assert.deepEqual(
  legacyTeamState.getPlayers().map(player => player.team),
  [1, 2, null],
  'state hydration should migrate legacy A/B player teams instead of dropping the saved player list'
);
assert.deepEqual(
  legacyTeamState.getPlayers().map(player => player.id),
  [1, 2, 3],
  'state hydration should migrate legacy numeric-string player IDs instead of dropping the saved player list'
);
storage.clear();

localStorage.setItem(KEYS.STATE, JSON.stringify({
  teams: {
    t1: { lvl: 'A', aFail: 0 },
    t2: { lvl: 'A', aFail: 0 }
  },
  roundLevel: 'A',
  roundOwner: 't2',
  nextRoundBase: 'K',
  winner: 't1',
  gameStatus: {
    ended: true,
    winnerKey: 't2',
    winnerName: '红队',
    reason: 'A_LEVEL_CLEARED'
  },
  history: [
    {
      ts: '2026-06-10 22:00:00',
      win: '红队',
      winKey: 't2',
      aNote: '红队 A级通关（胜方无末游，在自己的A级）',
      gameStatus: {
        ended: true,
        winnerKey: 't2',
        winnerName: '红队',
        reason: 'A_LEVEL_CLEARED'
      }
    }
  ]
}));

const { default: completedWinnerState } = await import('../../src/core/state.js?completed-winner');
completedWinnerState.hydrate();
assert.deepEqual(
  completedWinnerState.getGameStatus(),
  {
    ended: true,
    winnerKey: 't2',
    winnerName: '红队',
    reason: 'A_LEVEL_CLEARED'
  },
  'state hydration should keep a resolvable completed game status'
);
assert.equal(
  completedWinnerState.getWinner(),
  't2',
  'state hydration should align legacy winner with authoritative completed gameStatus'
);
assert.equal(
  completedWinnerState.getNextRoundBase(),
  null,
  'state hydration should clear stale pending next-round state when completed gameStatus is authoritative'
);
storage.clear();

assert.equal(
  isValidRoomSnapshotPayload({
    state: {
      teams: {
        t1: { lvl: 'A', aFail: '1' },
        t2: { lvl: '2', aFail: 0 }
      }
    }
  }),
  false,
  'room snapshots should reject string A-fail counters before hydration can persist dirty state types'
);

assert.equal(
  isValidRoomSnapshotPayload({
    state: {
      history: [
        { mode: '4', winKey: 't1', ranks: [1, 5] }
      ]
    }
  }),
  false,
  'history ranks should not exceed the entry game mode'
);

assert.equal(
  isValidRoomSnapshotPayload({
    state: {
      history: [
        { mode: '8', winKey: 't1', ranks: [1, 1] }
      ]
    }
  }),
  false,
  'history ranks should reject duplicate positions'
);

assert.equal(
  isValidRoomSnapshotPayload({
    state: {
      history: [
        {
          mode: '4',
          winKey: 't1',
          playerRankings: {
            5: { id: 1, name: 'Out of range', team: 1 }
          }
        }
      ]
    }
  }),
  false,
  'history playerRankings should not exceed the entry game mode'
);

assert.equal(
  isValidRoomSnapshotPayload({
    state: {
      history: [
        {
          mode: '8',
          winKey: 't1',
          playerRankings: {
            1: { id: 1, name: 'Duplicate', team: 1 },
            2: { id: 1, name: 'Duplicate', team: 1 }
          }
        }
      ]
    }
  }),
  false,
  'history playerRankings should reject duplicate player IDs'
);

assert.equal(
  isValidRoomSnapshotPayload({
    players: [
      { id: '1', name: '外部字符串 ID', team: 1 }
    ]
  }),
  false,
  'external room snapshots should still reject string player IDs before state-level local migration runs'
);

assert.equal(
  isValidRoomSnapshotPayload({
    players: [
      { id: 1, name: '甲', team: 1 },
      { id: 2, name: '乙', team: 2 },
      { id: 3, name: '丙', team: 1 },
      { id: 4, name: '丁', team: 2 }
    ],
    playerStats: {
      1: {
        games: 1,
        totalRank: 5,
        firstPlaceCount: 0,
        lastPlaceCount: 0,
        rankings: [5]
      }
    }
  }),
  false,
  'player stats rankings should not exceed the active player count'
);

assert.equal(
  isValidRoomSnapshotPayload({
    players: [
      { id: 1, name: '甲', team: 1 },
      { id: 2, name: '乙', team: 2 },
      { id: 3, name: '丙', team: 1 },
      { id: 4, name: '丁', team: 2 }
    ],
    currentRanking: {
      5: 1
    }
  }),
  false,
  'current ranking slots should not exceed the active player count'
);

assert.equal(
  isValidRoomSnapshotPayload({
    state: {
      gameStatus: {
        ended: false,
        winnerKey: 't1',
        winnerName: '蓝队',
        reason: 'stale-clear'
      }
    }
  }),
  false,
  'open room snapshots should not accept stale completed winner fields'
);

assert.equal(
  isValidRoomSnapshotPayload({
    state: {
      gameStatus: {
        winnerKey: 't2'
      }
    }
  }),
  false,
  'room snapshots should only accept winner fields on explicit completed game statuses'
);

localStorage.setItem(KEYS.STATE, JSON.stringify({
  teams: {
    t1: { lvl: { bad: true }, aFail: 99 },
    t2: null
  },
  roundLevel: { bad: true },
  roundOwner: 'bad',
  nextRoundBase: { bad: true },
  gameStatus: {
    ended: true,
    winnerKey: null,
    winnerName: null,
    reason: 'A_LEVEL_CLEARED'
  },
  history: [
    {
      winKey: { bad: true },
      aNote: 'bad clear',
      gameStatus: { ended: true, winnerKey: { bad: true } }
    }
  ],
  winner: 'bad'
}));

localStorage.setItem(KEYS.PLAYERS, JSON.stringify([null]));
localStorage.setItem(KEYS.STATS, JSON.stringify({
  1: {
    games: 1,
    totalRank: 1,
    rankings: [1]
  }
}));

const { default: state } = await import('../../src/core/state.js');
state.hydrate();

assert.deepEqual(state.getTeam('t1'), { lvl: '2', aFail: 0 });
assert.deepEqual(state.getTeam('t2'), { lvl: '2', aFail: 0 });
assert.equal(state.getRoundLevel(), '2');
assert.equal(state.getRoundOwner(), null);
assert.equal(state.getNextRoundBase(), null);
assert.equal(state.getWinner(), 't1');
assert.deepEqual(state.getGameStatus(), {
  ended: false,
  winnerKey: null,
  winnerName: null,
  reason: null
});
assert.deepEqual(state.getHistory(), []);
assert.deepEqual(state.getPlayers(), []);
assert.deepEqual(state.getPlayerStats(), {});

assert.throws(
  () => state.setTeamLevel('t1', { bad: true }),
  /Invalid team level/,
  'team level setter should reject malformed levels before they can be persisted or synced'
);
assert.equal(state.getTeamLevel('t1'), '2');

assert.throws(
  () => state.setTeamAFail('t1', 99),
  /Invalid A-fail count/,
  'A-fail setter should reject impossible counters'
);
assert.equal(state.getTeamAFail('t1'), 0);

assert.throws(
  () => state.setRoundLevel({ bad: true }),
  /Invalid round level/,
  'round level setter should reject malformed levels'
);
assert.equal(state.getRoundLevel(), '2');

assert.throws(
  () => state.setRoundOwner('bad'),
  /Invalid round owner/,
  'round owner setter should reject non-team keys'
);
assert.equal(state.getRoundOwner(), null);

assert.throws(
  () => state.setNextRoundBase({ bad: true }),
  /Invalid next round base/,
  'next round base setter should reject malformed levels'
);
assert.equal(state.getNextRoundBase(), null);

assert.throws(
  () => state.setGameStatus({ ended: true, winnerKey: { bad: true } }),
  /Invalid game status/,
  'game status setter should reject ended statuses without a valid winner key'
);
assert.deepEqual(state.getGameStatus(), {
  ended: false,
  winnerKey: null,
  winnerName: null,
  reason: null
});

assert.throws(
  () => state.setGameStatus({ ended: 'false', winnerKey: 't1', winnerName: '蓝队' }),
  /Invalid game status/,
  'game status setter should reject non-boolean ended flags instead of coercing them'
);
assert.deepEqual(state.getGameStatus(), {
  ended: false,
  winnerKey: null,
  winnerName: null,
  reason: null
});

state.setGameStatus({
  ended: false,
  winnerKey: 't2',
  winnerName: '红队',
  reason: 'stale-clear'
});
assert.deepEqual(
  state.getGameStatus(),
  {
    ended: false,
    winnerKey: null,
    winnerName: null,
    reason: null
  },
  'game status setter should normalize open statuses by clearing stale winner fields'
);

state.setNextRoundBase('A');
state.setGameStatus({
  ended: true,
  winnerKey: 't2',
  winnerName: '红队',
  reason: 'A_LEVEL_CLEARED'
});
assert.equal(
  state.getWinner(),
  't2',
  'completed game status should keep the legacy winner field aligned at the state source'
);
assert.equal(
  state.getNextRoundBase(),
  null,
  'completed game status should clear stale pending next-round state at the source of truth'
);

assert.throws(
  () => state.setPlayers([null]),
  /Invalid players/,
  'players setter should reject malformed player lists before they can be synced'
);
assert.deepEqual(state.getPlayers(), []);

assert.throws(
  () => state.setPlayerStats({
    1: { games: 1, totalRank: 1, rankings: [1] }
  }),
  /Invalid player stats/,
  'player stats setter should reject stats for unknown players'
);
assert.deepEqual(state.getPlayerStats(), {});

assert.throws(
  () => state.setCurrentRanking({ 9: 1 }),
  /Invalid current ranking/,
  'current ranking setter should reject malformed rank slots'
);
assert.deepEqual(state.getCurrentRanking(), {});

state.setPlayers([{ id: 1, name: '甲', team: 1 }, { id: 2, name: '乙', team: 2 }]);
assert.throws(
  () => state.setCurrentRanking({ 1: 99 }),
  /Invalid current ranking/,
  'current ranking setter should reject player IDs that are not in the active player list'
);
assert.deepEqual(state.getCurrentRanking(), {});

assert.throws(
  () => state.setHistory([
    {
      win: '蓝队',
      aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
    }
  ]),
  /Invalid history/,
  'history setter should reject completed history entries without a resolvable winner key'
);
assert.deepEqual(state.getHistory(), []);

assert.throws(
  () => state.addHistoryEntry({
    winKey: { bad: true },
    ranks: [1, 2]
  }),
  /Invalid history/,
  'history entry setter should reject malformed entries before appending'
);
assert.deepEqual(state.getHistory(), []);

assert.throws(
  () => state.addHistoryEntry({
    win: '蓝队',
    winKey: 't1',
    prevWinner: 'bad'
  }),
  /Invalid history/,
  'history entry setter should reject malformed rollback winner snapshots before appending'
);
assert.deepEqual(state.getHistory(), []);

const teamSnapshot = state.getTeam('t1');
teamSnapshot.lvl = 'A';
assert.equal(state.getTeamLevel('t1'), '2');

state.setWinner('t2');
assert.equal(state.getWinner(), 't2');
assert.equal(
  JSON.parse(localStorage.getItem(KEYS.STATE)).winner,
  't2',
  'winner setter should persist the selected team for reloads and room snapshots'
);

const playersInput = [{ id: 1, name: '甲', team: '1' }, { id: 2, name: '乙' }];
state.setPlayers(playersInput);
assert.equal(
  state.getPlayers()[0].team,
  1,
  'players setter should normalize legacy string team IDs to numeric teams'
);
assert.equal(
  state.getPlayers()[1].team,
  null,
  'players setter should normalize missing team values to unassigned null'
);
playersInput[0].name = 'polluted after set';
assert.equal(state.getPlayers()[0].name, '甲');

state.setPlayers([{ id: 1, name: '旧蓝', team: 'A' }, { id: 2, name: '旧红', team: 'B' }]);
assert.deepEqual(
  state.getPlayers().map(player => player.team),
  [1, 2],
  'players setter should normalize legacy A/B team IDs before validation'
);

const playersSnapshot = state.getPlayers();
playersSnapshot[0].name = 'polluted from getter';
assert.equal(state.getPlayers()[0].name, '旧蓝');

const statsInput = {
  1: { games: 1, totalRank: 2, rankings: [2] }
};
state.setPlayerStats(statsInput);
statsInput[1].rankings.push(1);
assert.deepEqual(state.getPlayerStats()[1].rankings, [2]);

const statsSnapshot = state.getPlayerStats();
statsSnapshot[1].rankings.push(3);
assert.deepEqual(state.getPlayerStats()[1].rankings, [2]);

const rankingInput = { 1: 1 };
state.setCurrentRanking(rankingInput);
rankingInput[1] = 2;
assert.equal(state.getCurrentRanking()[1], 1);

const rankingSnapshot = state.getCurrentRanking();
rankingSnapshot[1] = 3;
assert.equal(state.getCurrentRanking()[1], 1);

state.setPlayers([
  { id: 1, name: '甲', team: 1 },
  { id: 2, name: '乙', team: 2 },
  { id: 3, name: '丙', team: 1 },
  { id: 4, name: '丁', team: 2 }
]);
state.setCurrentRanking({ 1: 1, 4: 4 });
const rankingEvents = [];
const unsubscribeRankingEvents = onEvent('state:currentRankingChanged', event => {
  rankingEvents.push(event);
});
state.setPlayers([
  { id: 1, name: '甲', team: 1 },
  { id: 2, name: '乙', team: 2 }
]);
unsubscribeRankingEvents();
assert.deepEqual(
  state.getCurrentRanking(),
  { 1: 1 },
  'players setter should prune ranking slots and player IDs that no longer fit the active player list'
);
assert.deepEqual(
  rankingEvents.map(event => event.ranking),
  [{ 1: 1 }],
  'players setter should emit currentRankingChanged when pruning invalid ranking entries'
);
state.setPlayers([]);
assert.deepEqual(
  state.getCurrentRanking(),
  {},
  'players setter should clear ranking when the active player list is emptied'
);

const historyInput = { winKey: 't1', ranks: [1, 2] };
state.addHistoryEntry(historyInput);
historyInput.winKey = 't2';
assert.equal(state.getHistory()[0].winKey, 't1');

const historySnapshot = state.getHistory();
historySnapshot[0].ranks.push(3);
assert.deepEqual(state.getHistory()[0].ranks, [1, 2]);

console.log('state hydration sanitization checks passed');
