/**
 * Game Rules Engine - A-Level Logic and Rule Application
 * Handles complex A-level victory/failure conditions
 *
 * Rule modes:
 *   Clear condition: a team must win on its own A round, without last place.
 *   Strict A: own-A failures accumulate across all player counts; 3 failures demote that team to 2.
 *   Lenient A: own-A failures do not accumulate; teams stay at A until a valid clear.
 */

import { nextLevel } from './calculator.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';
import { now } from '../core/utils.js';
import { normalizePlayerCountMode } from '../core/playerCountMode.js';
import { resolveGameStatus } from './gameStatus.js';
import { isValidRoomSnapshotPayload } from '../../shared/roomSnapshotValidation.js';
import { checkALevelRules as evaluateALevelRules } from '../../shared/aLevelLogic.js';

const VALID_WINNER_KEYS = new Set(['t1', 't2']);

function isValidWinnerRanks(ranks, mode) {
  if (!Array.isArray(ranks)) return false;
  if (ranks.length !== mode / 2) return false;

  const seen = new Set();
  for (const rank of ranks) {
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > mode) return false;
    if (seen.has(rank)) return false;
    seen.add(rank);
  }

  return true;
}

/**
 * Check A-level rules and conditions
 * Thin wrapper: gathers state/config and delegates to the pure algorithm in
 * shared/aLevelLogic.js (single source of truth, vendored by the wxapp sibling repo).
 * @param {string} winnerKey - Winning team key ('t1' or 't2')
 * @param {number[]} ranks - Winning team's ranking positions
 * @param {string|number} mode - Game mode ('4', '6', or '8')
 * @returns {{aNote: string, finalWin: boolean, winnerNewLevel?: string, loserNewLevel?: string, aTeam?: string}}
 */
export function checkALevelRules(winnerKey, ranks, mode) {
  return evaluateALevelRules({
    winnerKey,
    ranks,
    mode,
    teamLevels: {
      t1: state.getTeamLevel('t1'),
      t2: state.getTeamLevel('t2')
    },
    roundOwner: state.getRoundOwner(),
    roundLevel: state.getRoundLevel(),
    strictA: config.getPreference('strictA'),
    aFailCounts: {
      t1: state.getTeamAFail('t1'),
      t2: state.getTeamAFail('t2')
    },
    teamNames: {
      t1: config.getTeamName('t1'),
      t2: config.getTeamName('t2')
    }
  });
}

/**
 * Apply game result - main orchestration function
 * @param {Object} calcResult - Result from calculator.calculateUpgrade() (must have: upgrade, mode, ranks)
 * @param {string} winnerKey - Winning team key
 * @param {Object} playerRankingData - Current ranking with player details
 * @returns {{applied: boolean, finalWin?: boolean, historyEntry?: Object, reason?: string, message?: string}}
 */
export function applyGameResult(calcResult, winnerKey, playerRankingData) {
  if (!calcResult || calcResult.upgrade === undefined) {
    console.error('Invalid calc result:', calcResult);
    return { applied: false };
  }

  if (!VALID_WINNER_KEYS.has(winnerKey)) {
    console.error('Invalid winner key:', winnerKey);
    return { applied: false, reason: 'invalid_winner' };
  }

  const normalizedMode = normalizePlayerCountMode(calcResult.mode);
  if (!normalizedMode) {
    console.error('Invalid calc result mode:', calcResult.mode);
    return { applied: false, reason: 'invalid_mode' };
  }

  if (!isValidWinnerRanks(calcResult.ranks, normalizedMode)) {
    console.error('calcResult.ranks is missing or invalid:', calcResult);
    return { applied: false, reason: 'invalid_ranks' };
  }

  const currentGameStatus = resolveGameStatus(state.getGameStatus(), state.getHistory());
  if (currentGameStatus.ended) {
    return {
      applied: false,
      reason: 'game_already_ended',
      message: '比赛已通关。请先撤销通关局或重置整场比赛，再应用新的结果。'
    };
  }

  const pendingNextRoundBase = state.getNextRoundBase();
  if (pendingNextRoundBase) {
    return {
      applied: false,
      reason: 'pending_next_round',
      message: `请先进入下一局（${pendingNextRoundBase}），再应用新的结果。`
    };
  }

  const autoNext = config.getPreference('autoNext');
  const loserKey = winnerKey === 't1' ? 't2' : 't1';
  const thisRound = state.getRoundLevel();
  const existingHistory = state.getHistory();
  const previousAppliedWinner = [...existingHistory]
    .reverse()
    .find(entry => entry?.winKey === 't1' || entry?.winKey === 't2')
    ?.winKey || 't1';

  // Snapshot for rollback — includes nextRoundBase so rollback restores manual-mode state correctly
  const snapshot = {
    prevT1Lvl: state.getTeamLevel('t1'),
    prevT1A: state.getTeamAFail('t1'),
    prevT2Lvl: state.getTeamLevel('t2'),
    prevT2A: state.getTeamAFail('t2'),
    prevRound: thisRound,
    prevRoundOwner: state.getRoundOwner(),
    prevNextRoundBase: state.getNextRoundBase(),
    prevWinner: previousAppliedWinner,
    prevGameStatus: state.getGameStatus(),
    prevPlayerStats: state.getPlayerStats()
  };

  // Calculate naive new levels (calculator clamps at 'A')
  const winnerCurrentLevel = state.getTeamLevel(winnerKey);
  let winnerNewLevel = nextLevel(winnerCurrentLevel, calcResult.upgrade);
  let loserNewLevel = state.getTeamLevel(loserKey);

  // Apply A-level rules — may override winnerNewLevel / loserNewLevel
  const aLevelResult = checkALevelRules(winnerKey, calcResult.ranks, normalizedMode);

  if (aLevelResult.winnerNewLevel !== null && aLevelResult.winnerNewLevel !== undefined) {
    winnerNewLevel = aLevelResult.winnerNewLevel;
  }
  if (aLevelResult.loserNewLevel !== null && aLevelResult.loserNewLevel !== undefined) {
    loserNewLevel = aLevelResult.loserNewLevel;
  }

  // Compute next-round base AFTER A-level override so demotion paths advance correctly.
  // Previously this was captured before override, causing round to advance to stale level.
  const nextBaseByRule = winnerNewLevel;

  const winnerName = config.getTeamName(winnerKey);
  const gameStatus = aLevelResult.finalWin
    ? {
      ended: true,
      winnerKey,
      winnerName,
      reason: 'A_LEVEL_CLEARED'
    }
    : {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    };

  const finalLevels = {
    t1: state.getTeamLevel('t1'),
    t2: state.getTeamLevel('t2')
  };
  finalLevels[winnerKey] = winnerNewLevel;
  finalLevels[loserKey] = loserNewLevel;

  // Build history entry
  const historyEntry = {
    ts: now(),
    mode: String(normalizedMode),
    combo: '(' + calcResult.ranks.join(',') + ')',
    ranks: calcResult.ranks,
    up: calcResult.upgrade,
    win: winnerName,
    winKey: winnerKey,
    t1: finalLevels.t1,
    t2: finalLevels.t2,
    round: thisRound,
    aNote: aLevelResult.aNote,
    gameStatus,
    sessionDuration: state.getSessionDuration(),
    gameEndedAt: aLevelResult.finalWin ? new Date().toISOString() : null,
    ...snapshot,
    playerRankings: playerRankingData || {}
  };

  if (!isValidRoomSnapshotPayload({ state: { history: [...existingHistory, historyEntry] } })) {
    console.error('Invalid history entry:', historyEntry);
    return { applied: false, reason: 'invalid_history_entry' };
  }

  if (aLevelResult.aFailUpdates && typeof aLevelResult.aFailUpdates === 'object') {
    Object.entries(aLevelResult.aFailUpdates).forEach(([teamKey, count]) => {
      state.setTeamAFail(teamKey, count);
    });
  }

  // Apply upgrades to teams after history validation so bad payloads cannot
  // leave levels/status advanced without a matching history row.
  state.setWinner(winnerKey);
  state.setTeamLevel(winnerKey, winnerNewLevel);
  state.setTeamLevel(loserKey, loserNewLevel);

  // Decide round advancement
  if (autoNext || aLevelResult.finalWin) {
    state.setRoundLevel(String(nextBaseByRule));
    state.setRoundOwner(winnerKey);
    state.setNextRoundBase(null);
  } else {
    state.setRoundLevel(String(thisRound));
    state.setNextRoundBase(String(nextBaseByRule));
  }

  state.setGameStatus(gameStatus);
  state.addHistoryEntry(historyEntry);

  emit('game:resultApplied', {
    winner: winnerKey,
    upgrade: calcResult.upgrade,
    finalWin: aLevelResult.finalWin
  });

  if (aLevelResult.finalWin) {
    emit('game:victoryAchieved', {
      teamKey: winnerKey,
      teamName: winnerName
    });
  }

  return {
    applied: true,
    finalWin: aLevelResult.finalWin,
    historyEntry,
    message: aLevelResult.finalWin
      ? `🎉 ${winnerName} A级通关！`
      : (autoNext
        ? `已应用，已进入下一局（本局→下局：${thisRound}→${nextBaseByRule}）。`
        : `已应用。下局级牌：${nextBaseByRule}。`)
  };
}

/**
 * Advance to next round (manual mode)
 * @returns {{advanced: boolean, message: string}}
 */
export function advanceToNextRound() {
  const nextRoundBase = state.getNextRoundBase();

  if (!nextRoundBase) {
    return {
      advanced: false,
      message: '没有待进入的下一局（或已自动进入）。'
    };
  }

  const currentGameStatus = resolveGameStatus(state.getGameStatus(), state.getHistory());
  if (currentGameStatus.ended) {
    return {
      advanced: false,
      reason: 'game_already_ended',
      message: '比赛已通关。请先撤销通关局或重置整场比赛，再进入下一局。'
    };
  }

  const history = state.getHistory();
  let lastWinner = null;
  if (history.length > 0) {
    lastWinner = history[history.length - 1].winKey;
  }

  state.setRoundLevel(nextRoundBase);
  if (lastWinner) {
    state.setRoundOwner(lastWinner);
  }
  state.setNextRoundBase(null);

  emit('game:roundAdvanced', {
    newRound: nextRoundBase,
    owner: lastWinner
  });

  return {
    advanced: true,
    message: '已进入下一局'
  };
}
