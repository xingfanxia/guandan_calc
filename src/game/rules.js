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
 * @param {string} winnerKey - Winning team key ('t1' or 't2')
 * @param {number[]} ranks - Winning team's ranking positions
 * @param {string|number} mode - Game mode ('4', '6', or '8')
 * @returns {{aNote: string, finalWin: boolean, winnerNewLevel?: string, loserNewLevel?: string, aTeam?: string}}
 */
export function checkALevelRules(winnerKey, ranks, mode) {
  const teamLevels = {
    t1: state.getTeamLevel('t1'),
    t2: state.getTeamLevel('t2')
  };
  const roundOwner = state.getRoundOwner();
  const roundLevel = state.getRoundLevel();
  const strictA = config.getPreference('strictA');
  const aFailEnabled = strictA;

  const notes = [];
  let finalWin = false;
  let aTeam = null;
  let winnerNewLevel = null;
  let loserNewLevel = null;
  const aFailUpdates = {};
  const loserKey = winnerKey === 't1' ? 't2' : 't1';
  const winnerStartedAtA = teamLevels[winnerKey] === 'A';
  const loserStartedAtA = teamLevels[loserKey] === 'A';
  const roundOwnerStartedAtA = roundOwner ? teamLevels[roundOwner] === 'A' : false;
  const normalizedMode = normalizePlayerCountMode(mode);
  if (!normalizedMode) {
    return {
      aNote: '模式无效',
      finalWin: false,
      aFailUpdates: {},
      error: 'invalid_mode'
    };
  }

  // No team at A-level → no special rules apply
  if (!winnerStartedAtA && !loserStartedAtA) {
    return { aNote: '', finalWin };
  }

  const lastRank = normalizedMode;
  const winnerHasLast = ranks.indexOf(lastRank) >= 0;
  // Guard roundOwner === null (first-round / brand-new game)
  const roundOwnerName = roundOwner ? config.getTeamName(roundOwner) : '未定';
  const isRoundAtA = roundLevel === 'A';
  const winnerOwnARound = winnerStartedAtA && isRoundAtA && roundOwner === winnerKey;
  const ownerOwnARound = isRoundAtA && roundOwner && roundOwnerStartedAtA;

  /**
   * Preview the next A-fail counter for a team. Returns the new count + whether
   * the team is demoted. Outside strict mode this is a no-op (returns null).
   * The actual state write happens in applyGameResult(), keeping this rule
   * checker safe for previews and tests.
   */
  function previewAFail(team) {
    if (!aFailEnabled) return null;
    const current = state.getTeamAFail(team);
    const next = current + 1;
    if (next >= 3) {
      aFailUpdates[team] = 0;
      return { count: next, demoted: true };
    }
    aFailUpdates[team] = next;
    return { count: next, demoted: false };
  }

  function applyFailTo(team, reason) {
    const teamName = config.getTeamName(team);
    const fail = previewAFail(team);

    if (fail) {
      let note = `${teamName} A级失败（${reason}）→ A${fail.count}`;
      if (fail.demoted) {
        note += '｜累计3次失败，仅该队重置到2';
        if (team === winnerKey) {
          winnerNewLevel = '2';
        } else {
          loserNewLevel = '2';
        }
      } else if (team === winnerKey) {
        winnerNewLevel = teamLevels[team];
      }
      notes.push(note);
      return;
    }

    if (team === winnerKey) {
      winnerNewLevel = teamLevels[team];
    }
    notes.push(`${teamName} ${reason}，不通关，继续打到通关`);
  }

  if (winnerStartedAtA) {
    const winnerName = config.getTeamName(winnerKey);
    aTeam = winnerKey;

    if (winnerHasLast) {
      if (winnerOwnARound) {
        applyFailTo(winnerKey, '在自己的A级胜方含末游');
      } else {
        winnerNewLevel = teamLevels[winnerKey];
        const tail = aFailEnabled ? '但A失败不计' : '继续打到通关';
        notes.push(`${winnerName} 在对方回合（${roundOwnerName}的级）胜但含末游，不通关，${tail}`);
      }
    } else if (!winnerOwnARound) {
      if (roundLevel !== 'A') {
        notes.push(`${winnerName} A级胜利（但本局级牌为${roundLevel}，需在自己的A级获胜才能通关）`);
      } else {
        notes.push(`${winnerName} A级胜利（但在${roundOwnerName}的回合，需在自己的A级获胜才能通关）`);
      }
      winnerNewLevel = teamLevels[winnerKey];
    } else {
      finalWin = true;
      notes.push(`${winnerName} A级通关（胜方无末游，在自己的A级）`);
    }
  }

  if (!finalWin && ownerOwnARound && roundOwner !== winnerKey) {
    aTeam = roundOwner;
    applyFailTo(roundOwner, '在自己的A级未取胜');
  } else if (!finalWin && loserStartedAtA && isRoundAtA && roundOwner === loserKey) {
    aTeam = loserKey;
    applyFailTo(loserKey, '在自己的A级未取胜');
  } else if (!finalWin && loserStartedAtA && roundOwner !== loserKey) {
    const loserName = config.getTeamName(loserKey);
    const tail = aFailEnabled ? '，A失败不计' : '';
    notes.push(`${loserName} 在对方回合（${roundOwnerName}的级）未胜${tail}`);
  }

  return {
    aNote: notes.join('｜'),
    finalWin,
    winnerNewLevel,
    loserNewLevel,
    aTeam,
    aFailUpdates
  };
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
