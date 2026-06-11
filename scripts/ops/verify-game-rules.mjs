import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

const { default: state } = await import('../../src/core/state.js');
const { default: config } = await import('../../src/core/config.js');
const { calculateUpgrade } = await import('../../src/game/calculator.js');
const { applyGameResult, advanceToNextRound, checkALevelRules } = await import('../../src/game/rules.js');
const { checkGameEnded } = await import('../../src/ranking/rankingRenderer.js');
const { updateRuleHint } = await import('../../src/ui/teamDisplay.js');

function readProjectFile(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function reset() {
  localStorage.clear();
  state.resetAll();
  config.resetToDefaults();
  config.setPreference('strictA', true);
  config.setPreference('autoNext', true);
}

function applyRound({ winner, mode = '4', ranks, upgrade = 1 }) {
  return applyGameResult({ mode, ranks, upgrade }, winner, {});
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('rules documentation describes current own-A clear requirement', () => {
  const rulesDoc = readProjectFile('docs/GAME_RULES.md');

  assert.equal(
    rulesDoc.includes('The first team to win at A-level wins the entire match.'),
    false,
    'rules overview should not claim any A-level win immediately ends the match'
  );
  assert.match(
    rulesDoc,
    /own A-level round without a last-place player/i,
    'rules overview should state that the clear must happen on the team own A-level round without last place'
  );
});

test('upgrade calculation normalizes numeric game modes', () => {
  reset();
  const calcConfig = config.getAll();

  assert.deepEqual(calculateUpgrade(4, [1, 2], calcConfig).details, {
    mode: '4-player',
    combination: '1,2',
    upgradeTable: calcConfig.c4
  });
  assert.equal(calculateUpgrade(4, [1, 2], calcConfig).upgrade, 3);

  const sixPlayerResult = calculateUpgrade(6, [1, 3, 5], calcConfig);
  assert.equal(sixPlayerResult.upgrade, 1);
  assert.equal(sixPlayerResult.details.mode, '6-player');
});

test('upgrade calculation rejects invalid game modes instead of treating them as 8-player', () => {
  reset();
  const result = calculateUpgrade('4abc', [1, 2, 3, 4], config.getAll());

  assert.equal(result.upgrade, 0);
  assert.equal(result.details.error, 'invalid_mode');
});

test('applyGameResult rejects invalid game modes before mutating state', () => {
  reset();
  state.setTeamLevel('t1', 'A');
  state.setRoundLevel('A');
  state.setRoundOwner('t1');

  const result = applyGameResult({ mode: '4abc', ranks: [1, 3], upgrade: 1 }, 't1', {});

  assert.deepEqual(result, { applied: false, reason: 'invalid_mode' });
  assert.equal(state.getTeamLevel('t1'), 'A');
  assert.equal(state.getRoundLevel(), 'A');
  assert.deepEqual(state.getGameStatus(), {
    ended: false,
    winnerKey: null,
    winnerName: null,
    reason: null
  });
  assert.deepEqual(state.getHistory(), []);
});

test('applyGameResult rejects malformed winner ranks before mutating state', () => {
  reset();
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', '5');
  state.setRoundLevel('K');
  state.setRoundOwner('t1');
  state.setWinner('t2');

  const result = applyGameResult({ mode: '4', ranks: [1, 99], upgrade: 3 }, 't1', {});

  assert.deepEqual(result, { applied: false, reason: 'invalid_ranks' });
  assert.equal(state.getTeamLevel('t1'), 'K');
  assert.equal(state.getTeamLevel('t2'), '5');
  assert.equal(state.getRoundLevel(), 'K');
  assert.equal(state.getRoundOwner(), 't1');
  assert.equal(state.getWinner(), 't2');
  assert.deepEqual(state.getGameStatus(), {
    ended: false,
    winnerKey: null,
    winnerName: null,
    reason: null
  });
  assert.deepEqual(state.getHistory(), []);
});

test('applyGameResult rejects invalid history payloads before mutating state', () => {
  reset();
  state.setWinner('t2');
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', 'A');
  state.setTeamAFail('t2', 1);
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const before = {
    t1: state.getTeamLevel('t1'),
    t1A: state.getTeamAFail('t1'),
    t2: state.getTeamLevel('t2'),
    t2A: state.getTeamAFail('t2'),
    roundLevel: state.getRoundLevel(),
    roundOwner: state.getRoundOwner(),
    winner: state.getWinner(),
    gameStatus: state.getGameStatus(),
    history: state.getHistory()
  };

  let result;
  assert.doesNotThrow(() => {
    result = applyGameResult(
      { mode: '4', ranks: [1, 3], upgrade: 1 },
      't1',
      {
        5: { id: 1, name: 'Out of range rank', team: 1 }
      }
    );
  });

  assert.deepEqual(result, { applied: false, reason: 'invalid_history_entry' });
  assert.deepEqual(
    {
      t1: state.getTeamLevel('t1'),
      t1A: state.getTeamAFail('t1'),
      t2: state.getTeamLevel('t2'),
      t2A: state.getTeamAFail('t2'),
      roundLevel: state.getRoundLevel(),
      roundOwner: state.getRoundOwner(),
      winner: state.getWinner(),
      gameStatus: state.getGameStatus(),
      history: state.getHistory()
    },
    before,
    'invalid history payloads should not leave partially applied levels, owner, winner, status, or history'
  );
});

test('applyGameResult rejects invalid winner keys before mutating state', () => {
  reset();
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', '5');
  state.setRoundLevel('K');
  state.setRoundOwner('t1');
  state.setWinner('t2');

  const result = applyGameResult({ mode: '4', ranks: [1, 3], upgrade: 3 }, 'bad', {});

  assert.deepEqual(result, { applied: false, reason: 'invalid_winner' });
  assert.equal(state.getTeamLevel('t1'), 'K');
  assert.equal(state.getTeamLevel('t2'), '5');
  assert.equal(state.getRoundLevel(), 'K');
  assert.equal(state.getRoundOwner(), 't1');
  assert.equal(state.getWinner(), 't2');
  assert.deepEqual(state.getHistory(), []);
});

test('manual next-round mode rejects another result while next round is pending', () => {
  reset();
  config.setPreference('autoNext', false);
  state.setTeamLevel('t1', '4');
  state.setTeamLevel('t2', '4');
  state.setRoundLevel('4');
  state.setRoundOwner('t1');

  const first = applyRound({ winner: 't1', ranks: [1, 2], upgrade: 2 });

  assert.equal(first.applied, true);
  assert.equal(state.getTeamLevel('t1'), '6');
  assert.equal(state.getTeamLevel('t2'), '4');
  assert.equal(state.getRoundLevel(), '4');
  assert.equal(state.getRoundOwner(), 't1');
  assert.equal(state.getNextRoundBase(), '6');

  const beforeSecondApply = {
    t1: state.getTeamLevel('t1'),
    t2: state.getTeamLevel('t2'),
    roundLevel: state.getRoundLevel(),
    roundOwner: state.getRoundOwner(),
    nextRoundBase: state.getNextRoundBase(),
    winner: state.getWinner(),
    gameStatus: state.getGameStatus(),
    history: state.getHistory()
  };

  config.setPreference('autoNext', true);
  const second = applyRound({ winner: 't2', ranks: [1, 3], upgrade: 1 });

  assert.equal(second.applied, false);
  assert.equal(second.reason, 'pending_next_round');
  assert.match(second.message, /先进入下一局/);
  assert.deepEqual(
    {
      t1: state.getTeamLevel('t1'),
      t2: state.getTeamLevel('t2'),
      roundLevel: state.getRoundLevel(),
      roundOwner: state.getRoundOwner(),
      nextRoundBase: state.getNextRoundBase(),
      winner: state.getWinner(),
      gameStatus: state.getGameStatus(),
      history: state.getHistory()
    },
    beforeSecondApply,
    'pending manual next-round state should block duplicate applies without mutation'
  );

  const advanceResult = advanceToNextRound();
  assert.equal(advanceResult.advanced, true);
  assert.equal(state.getRoundLevel(), '6');
  assert.equal(state.getRoundOwner(), 't1');
  assert.equal(state.getNextRoundBase(), null);

  const third = applyRound({ winner: 't2', ranks: [1, 3], upgrade: 1 });

  assert.equal(third.applied, true);
  assert.equal(state.getHistory().length, 2);
});

test('rule hint rendering normalizes numeric game modes', () => {
  reset();
  const originalDocument = globalThis.document;
  const ruleHint = { textContent: '' };

  globalThis.document = {
    getElementById(id) {
      return id === 'ruleHint' ? ruleHint : null;
    }
  };

  try {
    updateRuleHint(4);
    assert.match(ruleHint.textContent, /^4人：/);

    updateRuleHint(6);
    assert.match(ruleHint.textContent, /^6人：/);
  } finally {
    if (originalDocument) {
      globalThis.document = originalDocument;
    } else {
      delete globalThis.document;
    }
  }
});

test('configuration mode helpers normalize numeric game modes', () => {
  reset();
  const originalDocument = globalThis.document;
  const inputs = new Map([
    ['c4_12', { value: '' }],
    ['c4_13', { value: '' }],
    ['c4_14', { value: '' }],
    ['t6_3', { value: '' }],
    ['t6_2', { value: '' }],
    ['t6_1', { value: '' }],
    ['p6_1', { value: '' }],
    ['p6_2', { value: '' }],
    ['p6_3', { value: '' }],
    ['p6_4', { value: '' }],
    ['p6_5', { value: '' }],
    ['p6_6', { value: '' }]
  ]);

  globalThis.document = {
    getElementById(id) {
      return inputs.get(id) || null;
    }
  };

  try {
    config.set4PlayerRules({ '1,2': 9 });
    config.resetModeToDefaults(4);
    assert.equal(config.get4PlayerRules()['1,2'], 3);
    assert.equal(String(inputs.get('c4_12').value), '3');

    config.set6PlayerRules({ thresholds: { g3: 99 }, points: { 1: 99 } });
    config.resetModeToDefaults(6);
    assert.equal(config.get6PlayerRules().thresholds.g3, 7);
    assert.equal(String(inputs.get('t6_3').value), '7');
    assert.equal(String(inputs.get('p6_1').value), '5');
  } finally {
    if (originalDocument) {
      globalThis.document = originalDocument;
    } else {
      delete globalThis.document;
    }
  }
});

test('strict A records failure for the owner when both teams are at A and the other team wins', () => {
  reset();
  state.setTeamLevel('t1', 'A');
  state.setTeamLevel('t2', 'A');
  state.setTeamAFail('t2', 1);
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const result = applyRound({ winner: 't1', ranks: [1, 3] });

  assert.equal(result.finalWin, false);
  assert.equal(state.getTeamAFail('t2'), 2);
  assert.equal(state.getTeamLevel('t2'), 'A');
  assert.match(result.historyEntry.aNote, /红队.*A级失败/);
});

test('A-level rule checks are pure until applyGameResult commits the round', () => {
  reset();
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', 'A');
  state.setTeamAFail('t2', 1);
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const preview = checkALevelRules('t1', [1, 3], '4');

  assert.equal(state.getTeamAFail('t2'), 1);
  assert.deepEqual(preview.aFailUpdates, { t2: 2 });
  assert.match(preview.aNote, /红队.*A级失败/);
});

test('A-level rule checks preview demotion without mutating failure counters', () => {
  reset();
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', 'A');
  state.setTeamAFail('t2', 2);
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const preview = checkALevelRules('t1', [1, 3], '4');

  assert.equal(state.getTeamAFail('t2'), 2);
  assert.deepEqual(preview.aFailUpdates, { t2: 0 });
  assert.equal(preview.loserNewLevel, '2');
  assert.match(preview.aNote, /累计3次失败/);
});

test('strict A demotes a team to 2 after the third own-A failure in 6-player mode', () => {
  reset();
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', 'A');
  state.setTeamAFail('t2', 2);
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const result = applyRound({ winner: 't1', mode: '6', ranks: [1, 3, 5] });

  assert.equal(result.finalWin, false);
  assert.equal(state.getTeamLevel('t2'), '2');
  assert.equal(state.getTeamAFail('t2'), 0);
  assert.match(result.historyEntry.aNote, /累计3次失败/);
});

test('strict A away-level win returns to own A without ending the match', () => {
  reset();
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', 'A');
  state.setRoundLevel('K');
  state.setRoundOwner('t1');

  const result = applyRound({ winner: 't2', ranks: [1, 3] });

  assert.equal(result.finalWin, false);
  assert.equal(state.getTeamLevel('t2'), 'A');
  assert.equal(state.getRoundLevel(), 'A');
  assert.equal(state.getRoundOwner(), 't2');
  assert.equal(checkGameEnded(), null);
});

test('lenient A away-level win returns to own A without ending the match', () => {
  reset();
  config.setPreference('strictA', false);
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', 'A');
  state.setRoundLevel('K');
  state.setRoundOwner('t1');

  const result = applyRound({ winner: 't2', ranks: [1, 3] });

  assert.equal(result.finalWin, false);
  assert.equal(state.getGameStatus().ended, false);
  assert.equal(state.getTeamLevel('t2'), 'A');
  assert.equal(state.getTeamAFail('t2'), 0);
  assert.equal(state.getRoundLevel(), 'A');
  assert.equal(state.getRoundOwner(), 't2');
  assert.match(result.historyEntry.aNote, /需在自己的A级获胜才能通关/);
  assert.equal(checkGameEnded(), null);
});

test('A-level last-place checks normalize numeric game modes', () => {
  reset();
  state.setTeamLevel('t2', 'A');
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const preview = checkALevelRules('t2', [1, 4], 4);

  assert.equal(preview.finalWin, false);
  assert.deepEqual(preview.aFailUpdates, { t2: 1 });
  assert.match(preview.aNote, /胜方含末游/);
});

test('lenient A own-round win with last place is not misread as a clear', () => {
  reset();
  config.setPreference('strictA', false);
  state.setTeamLevel('t2', 'A');
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const result = applyRound({ winner: 't2', ranks: [1, 4] });

  assert.equal(result.finalWin, false);
  assert.match(result.historyEntry.aNote, /不通关/);
  assert.equal(checkGameEnded(), null);
});

test('lenient A own-round loss does not accumulate failure or demote', () => {
  reset();
  config.setPreference('strictA', false);
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', 'A');
  state.setTeamAFail('t2', 2);
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const result = applyRound({ winner: 't1', ranks: [1, 3] });

  assert.equal(result.finalWin, false);
  assert.equal(state.getTeamLevel('t2'), 'A');
  assert.equal(state.getTeamAFail('t2'), 2);
  assert.deepEqual(result.historyEntry.gameStatus, {
    ended: false,
    winnerKey: null,
    winnerName: null,
    reason: null
  });
  assert.match(result.historyEntry.aNote, /不通关，继续打到通关/);
});

test('A-level victory is stored as structured game status and survives note wording changes', () => {
  reset();
  state.setTeamLevel('t2', 'A');
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const result = applyRound({ winner: 't2', ranks: [1, 3] });

  assert.equal(result.finalWin, true);
  assert.equal(typeof state.getGameStatus, 'function');
  assert.deepEqual(state.getGameStatus(), {
    ended: true,
    winnerKey: 't2',
    winnerName: '红队',
    reason: 'A_LEVEL_CLEARED'
  });
  assert.deepEqual(checkGameEnded(), {
    winner: '红队',
    winKey: 't2'
  });
});

test('completed games reject later result applies without reopening the match', () => {
  reset();
  state.setTeamLevel('t2', 'A');
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const finalResult = applyRound({ winner: 't2', ranks: [1, 3] });
  assert.equal(finalResult.finalWin, true);

  const endedSnapshot = {
    t1: state.getTeamLevel('t1'),
    t1A: state.getTeamAFail('t1'),
    t2: state.getTeamLevel('t2'),
    t2A: state.getTeamAFail('t2'),
    roundLevel: state.getRoundLevel(),
    roundOwner: state.getRoundOwner(),
    nextRoundBase: state.getNextRoundBase(),
    winner: state.getWinner(),
    gameStatus: state.getGameStatus(),
    history: state.getHistory()
  };

  const duplicate = applyRound({ winner: 't1', ranks: [1, 3] });

  assert.deepEqual(duplicate, {
    applied: false,
    reason: 'game_already_ended',
    message: '比赛已通关。请先撤销通关局或重置整场比赛，再应用新的结果。'
  });
  assert.deepEqual(
    {
      t1: state.getTeamLevel('t1'),
      t1A: state.getTeamAFail('t1'),
      t2: state.getTeamLevel('t2'),
      t2A: state.getTeamAFail('t2'),
      roundLevel: state.getRoundLevel(),
      roundOwner: state.getRoundOwner(),
      nextRoundBase: state.getNextRoundBase(),
      winner: state.getWinner(),
      gameStatus: state.getGameStatus(),
      history: state.getHistory()
    },
    endedSnapshot,
    'post-completion applies must not mutate levels, failure counters, winner, status, or history'
  );
});

test('completed games reject stale next-round advancement without mutating state', () => {
  reset();
  state.setTeamLevel('t1', 'K');
  state.setTeamLevel('t2', 'A');
  state.setRoundLevel('A');
  state.setRoundOwner('t2');
  state.setWinner('t2');
  state.setGameStatus({
    ended: true,
    winnerKey: 't2',
    winnerName: '红队',
    reason: 'A_LEVEL_CLEARED'
  });
  // Simulate a corrupted legacy in-memory state that bypassed the setter.
  // Normal state.setGameStatus(ended) clears nextRoundBase at the source.
  state.nextRoundBase = 'K';

  const endedSnapshot = {
    roundLevel: state.getRoundLevel(),
    roundOwner: state.getRoundOwner(),
    nextRoundBase: state.getNextRoundBase(),
    winner: state.getWinner(),
    gameStatus: state.getGameStatus()
  };

  const advanceResult = advanceToNextRound();

  assert.deepEqual(advanceResult, {
    advanced: false,
    reason: 'game_already_ended',
    message: '比赛已通关。请先撤销通关局或重置整场比赛，再进入下一局。'
  });
  assert.deepEqual(
    {
      roundLevel: state.getRoundLevel(),
      roundOwner: state.getRoundOwner(),
      nextRoundBase: state.getNextRoundBase(),
      winner: state.getWinner(),
      gameStatus: state.getGameStatus()
    },
    endedSnapshot,
    'post-completion next-round advancement must not reopen or move the match'
  );
});

test('applied result keeps legacy winner aligned with history and structured game status', () => {
  reset();
  state.setWinner('t1');
  state.setTeamLevel('t2', 'A');
  state.setRoundLevel('A');
  state.setRoundOwner('t2');

  const result = applyRound({ winner: 't2', ranks: [1, 3] });

  assert.equal(result.finalWin, true);
  assert.equal(result.historyEntry.prevWinner, 't1');
  assert.equal(result.historyEntry.winKey, 't2');
  assert.equal(result.historyEntry.gameStatus.winnerKey, 't2');
  assert.equal(
    state.getWinner(),
    't2',
    'legacy winner field should not stay stale after applyGameResult'
  );
});
