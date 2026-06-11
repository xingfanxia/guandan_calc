import assert from 'node:assert/strict';

globalThis.localStorage = {
  _data: new Map(),
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  },
  setItem(key, value) {
    this._data.set(key, String(value));
  },
  removeItem(key) {
    this._data.delete(key);
  },
  clear() {
    this._data.clear();
  }
};

globalThis.window = {
  location: {
    origin: 'http://localhost'
  },
  localStorage: globalThis.localStorage
};

const alerts = [];
const warnings = [];
globalThis.alert = message => alerts.push(String(message));
globalThis.confirm = () => true;
globalThis.console.warn = (...args) => warnings.push(args.map(String).join(' '));

const { default: state } = await import('../../src/core/state.js');
const { rollbackTo } = await import('../../src/game/history.js');

state.resetAll();
state.setTeamLevel('t1', '5');
state.setTeamLevel('t2', '6');
state.setRoundLevel('6');
state.setRoundOwner('t2');
state.setHistory([
  {
    ts: '2026-06-10 12:00:00',
    mode: '4',
    combo: '(1,3)',
    ranks: [1, 3],
    up: 1,
    win: '蓝队',
    winKey: 't1',
    t1: '6',
    t2: '6',
    round: '5'
  }
]);

const beforeState = {
  t1: state.getTeamLevel('t1'),
  t2: state.getTeamLevel('t2'),
  roundLevel: state.getRoundLevel(),
  roundOwner: state.getRoundOwner(),
  history: state.getHistory()
};

let result;
assert.doesNotThrow(() => {
  result = rollbackTo(0);
}, 'legacy history rows without rollback snapshots should not throw');

assert.equal(result.success, false);
assert.equal(result.reason, 'missing_snapshot');
assert.deepEqual(
  {
    t1: state.getTeamLevel('t1'),
    t2: state.getTeamLevel('t2'),
    roundLevel: state.getRoundLevel(),
    roundOwner: state.getRoundOwner(),
    history: state.getHistory()
  },
  beforeState,
  'failed legacy rollback should not partially mutate levels, round state, or history'
);
assert.ok(
  alerts.some(message => message.includes('缺少回滚快照')),
  'failed legacy rollback should explain why the action was refused'
);
assert.ok(
  warnings.some(message => message.includes('Cannot rollback history entry without a valid rollback snapshot')),
  'failed legacy rollback should leave a diagnostic warning for developers'
);

state.resetAll();
state.setWinner('t2');
state.setTeamLevel('t1', '9');
state.setTeamLevel('t2', '10');
state.setRoundLevel('10');
state.setRoundOwner('t2');
state.history = [
  {
    ts: '2026-06-10 12:05:00',
    mode: '4',
    combo: '(1,3)',
    ranks: [1, 3],
    up: 1,
    win: '红队',
    winKey: 't2',
    t1: '9',
    t2: '10',
    round: '9',
    prevT1Lvl: '8',
    prevT1A: 0,
    prevT2Lvl: '9',
    prevT2A: 0,
    prevRound: '9',
    prevRoundOwner: 't1',
    prevNextRoundBase: null,
    prevWinner: 't1',
    prevGameStatus: {
      ended: 'false',
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    }
  }
];

const beforeMalformedSnapshotRollback = {
  t1: state.getTeamLevel('t1'),
  t2: state.getTeamLevel('t2'),
  roundLevel: state.getRoundLevel(),
  roundOwner: state.getRoundOwner(),
  winner: state.getWinner(),
  gameStatus: state.getGameStatus(),
  history: state.getHistory()
};

assert.doesNotThrow(() => {
  result = rollbackTo(0);
}, 'malformed rollback gameStatus snapshots should be rejected before any state mutation');
assert.equal(result.success, false);
assert.equal(result.reason, 'missing_snapshot');
assert.deepEqual(
  {
    t1: state.getTeamLevel('t1'),
    t2: state.getTeamLevel('t2'),
    roundLevel: state.getRoundLevel(),
    roundOwner: state.getRoundOwner(),
    winner: state.getWinner(),
    gameStatus: state.getGameStatus(),
    history: state.getHistory()
  },
  beforeMalformedSnapshotRollback,
  'malformed rollback gameStatus snapshots should not partially mutate state'
);

state.resetAll();
state.setPlayers([
  { id: 1, name: '蓝头', emoji: 'A', team: 1 },
  { id: 2, name: '蓝二', emoji: 'B', team: 1 },
  { id: 3, name: '红三', emoji: 'C', team: 2 },
  { id: 4, name: '红末', emoji: 'D', team: 2 }
]);
state.setPlayerStats({
  1: { games: 1, totalRank: 1, firstPlaceCount: 1, lastPlaceCount: 0, rankings: [1] }
});
state.setWinner('t2');
state.setTeamLevel('t1', '9');
state.setTeamLevel('t2', '10');
state.setRoundLevel('10');
state.setRoundOwner('t2');
state.history = [
  {
    ts: '2026-06-10 12:08:00',
    mode: '4',
    combo: '(1,3)',
    ranks: [1, 3],
    up: 1,
    win: '红队',
    winKey: 't2',
    t1: '9',
    t2: '10',
    round: '9',
    prevT1Lvl: '8',
    prevT1A: 0,
    prevT2Lvl: '9',
    prevT2A: 0,
    prevRound: '9',
    prevRoundOwner: 't1',
    prevNextRoundBase: null,
    prevWinner: 't1',
    prevGameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    },
    prevPlayerStats: {
      999: { games: 1, totalRank: 1, firstPlaceCount: 1, lastPlaceCount: 0, rankings: [1] }
    }
  }
];

const beforeMalformedStatsRollback = {
  t1: state.getTeamLevel('t1'),
  t2: state.getTeamLevel('t2'),
  roundLevel: state.getRoundLevel(),
  roundOwner: state.getRoundOwner(),
  winner: state.getWinner(),
  gameStatus: state.getGameStatus(),
  playerStats: state.getPlayerStats(),
  history: state.getHistory()
};

assert.doesNotThrow(() => {
  result = rollbackTo(0);
}, 'malformed rollback playerStats snapshots should be rejected before any state mutation');
assert.equal(result.success, false);
assert.equal(result.reason, 'missing_snapshot');
assert.deepEqual(
  {
    t1: state.getTeamLevel('t1'),
    t2: state.getTeamLevel('t2'),
    roundLevel: state.getRoundLevel(),
    roundOwner: state.getRoundOwner(),
    winner: state.getWinner(),
    gameStatus: state.getGameStatus(),
    playerStats: state.getPlayerStats(),
    history: state.getHistory()
  },
  beforeMalformedStatsRollback,
  'malformed rollback playerStats snapshots should not partially mutate state'
);

state.resetAll();
state.setWinner('t2');
state.setTeamLevel('t1', '6');
state.setTeamLevel('t2', '7');
state.setRoundLevel('7');
state.setRoundOwner('t2');
state.setHistory([
  {
    ts: '2026-06-10 12:10:00',
    mode: '4',
    combo: '(1,3)',
    ranks: [1, 3],
    up: 1,
    win: '红队',
    winKey: 't2',
    t1: '6',
    t2: '7',
    round: '6',
    prevT1Lvl: '5',
    prevT1A: 0,
    prevT2Lvl: '6',
    prevT2A: 0,
    prevRound: '6',
    prevRoundOwner: 't1',
    prevNextRoundBase: null,
    prevWinner: 't1',
    prevGameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    }
  }
]);

result = rollbackTo(0);

assert.equal(result.success, true);
assert.equal(
  state.getWinner(),
  't1',
  'rollback should restore the legacy winner from the history snapshot'
);

state.resetAll();
state.setPlayers([
  { id: 1, name: '蓝头', emoji: 'A', team: 1 },
  { id: 2, name: '蓝二', emoji: 'B', team: 1 },
  { id: 3, name: '红三', emoji: 'C', team: 2 },
  { id: 4, name: '红末', emoji: 'D', team: 2 }
]);

const statsAfterRoundOne = {
  1: { games: 1, totalRank: 1, firstPlaceCount: 1, lastPlaceCount: 0, rankings: [1] },
  2: { games: 1, totalRank: 2, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [2] },
  3: { games: 1, totalRank: 3, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [3] },
  4: { games: 1, totalRank: 4, firstPlaceCount: 0, lastPlaceCount: 1, rankings: [4] }
};
const statsAfterRoundTwo = {
  1: { games: 2, totalRank: 5, firstPlaceCount: 1, lastPlaceCount: 1, rankings: [1, 4] },
  2: { games: 2, totalRank: 5, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [2, 3] },
  3: { games: 2, totalRank: 5, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [3, 2] },
  4: { games: 2, totalRank: 5, firstPlaceCount: 1, lastPlaceCount: 1, rankings: [4, 1] }
};

state.setPlayerStats(statsAfterRoundTwo);
state.setWinner('t2');
state.setTeamLevel('t1', '4');
state.setTeamLevel('t2', '5');
state.setRoundLevel('5');
state.setRoundOwner('t2');
state.setHistory([
  {
    ts: '2026-06-10 12:20:00',
    mode: '4',
    combo: '(1,2)',
    ranks: [1, 2],
    up: 2,
    win: '蓝队',
    winKey: 't1',
    t1: '4',
    t2: '2',
    round: '2',
    prevT1Lvl: '2',
    prevT1A: 0,
    prevT2Lvl: '2',
    prevT2A: 0,
    prevRound: '2',
    prevRoundOwner: null,
    prevNextRoundBase: null,
    prevWinner: 't1',
    prevGameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    },
    prevPlayerStats: {},
    playerRankings: {
      1: { id: 1, name: '蓝头', emoji: 'A', team: 1 },
      2: { id: 2, name: '蓝二', emoji: 'B', team: 1 },
      3: { id: 3, name: '红三', emoji: 'C', team: 2 },
      4: { id: 4, name: '红末', emoji: 'D', team: 2 }
    }
  },
  {
    ts: '2026-06-10 12:30:00',
    mode: '4',
    combo: '(1,3)',
    ranks: [1, 3],
    up: 1,
    win: '红队',
    winKey: 't2',
    t1: '4',
    t2: '5',
    round: '4',
    prevT1Lvl: '4',
    prevT1A: 0,
    prevT2Lvl: '4',
    prevT2A: 0,
    prevRound: '4',
    prevRoundOwner: 't1',
    prevNextRoundBase: null,
    prevWinner: 't1',
    prevGameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    },
    prevPlayerStats: statsAfterRoundOne,
    playerRankings: {
      1: { id: 4, name: '红末', emoji: 'D', team: 2 },
      2: { id: 3, name: '红三', emoji: 'C', team: 2 },
      3: { id: 2, name: '蓝二', emoji: 'B', team: 1 },
      4: { id: 1, name: '蓝头', emoji: 'A', team: 1 }
    }
  }
]);

result = rollbackTo(1);
assert.equal(result.success, true);
assert.deepEqual(
  state.getPlayerStats(),
  statsAfterRoundOne,
  'rollback should restore playerStats from the removed round snapshot'
);

console.log('game history rollback checks passed');
