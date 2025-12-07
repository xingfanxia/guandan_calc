/**
 * Game Rules Engine - A-Level Logic and Rule Application
 * Extracted from app.js lines 1525-1644
 * Handles complex A-level victory/failure conditions
 */

import { nextLevel } from './calculator.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';
import { now } from '../core/utils.js';

/**
 * Check A-level rules and conditions
 * @param {string} winnerKey - Winning team key ('t1' or 't2')
 * @param {number[]} ranks - Winning team's ranking positions
 * @param {string} mode - Game mode ('4', '6', or '8')
 * @returns {{aNote: string, finalWin: boolean, winnerNewLevel?: string, loserNewLevel?: string, aTeam?: string}}
 */
export function checkALevelRules(winnerKey, ranks, mode) {
  const t1Level = state.getTeamLevel('t1');
  const t2Level = state.getTeamLevel('t2');
  const t1AFail = state.getTeamAFail('t1');
  const t2AFail = state.getTeamAFail('t2');
  const roundOwner = state.getRoundOwner();
  const roundLevel = state.getRoundLevel();
  const strictA = config.getPreference('strictA');

  let aNote = '';
  let finalWin = false;
  let aTeam = null;
  let winnerNewLevel = null;
  let loserNewLevel = null;

  // Determine which team is at A-level
  if (t1Level === 'A' && t2Level === 'A') {
    aTeam = winnerKey; // Both at A, so winner is the A-team
  } else if (t1Level === 'A') {
    aTeam = 't1';
  } else if (t2Level === 'A') {
    aTeam = 't2';
  }

  // If no team at A-level, no special rules apply
  if (!aTeam) {
    return { aNote, finalWin };
  }

  // Determine if winner has last place
  const lastRank = mode === '4' ? 4 : (mode === '6' ? 6 : 8);
  const winnerHasLast = ranks.indexOf(lastRank) >= 0;

  const loserKey = winnerKey === 't1' ? 't2' : 't1';
  const aTeamName = aTeam === 't1' ? config.getTeamName('t1') : config.getTeamName('t2');
  const roundOwnerName = roundOwner === 't1' ? config.getTeamName('t1') : config.getTeamName('t2');

  // Case 1: A-team won the round
  if (aTeam === winnerKey) {
    if (winnerHasLast) {
      // Winner has last place - cannot pass A-level
      if (roundOwner === aTeam) {
        // It's their own round - counts as failure
        const newAFail = (aTeam === 't1' ? t1AFail : t2AFail) + 1;
        state.setTeamAFail(aTeam, newAFail);

        aNote = `${aTeamName} A级失败（在自己的A级胜方含末游）→ A${newAFail}`;

        if (newAFail >= 3) {
          // Reset to level 2 after 3 failures
          winnerNewLevel = '2';
          state.setTeamAFail(aTeam, 0);
          aNote += '｜累计3次失败，仅该队重置到2';
        } else {
          // No upgrade this round
          winnerNewLevel = state.getTeamLevel(winnerKey);
        }
      } else {
        // Not their own round - doesn't count as failure
        winnerNewLevel = state.getTeamLevel(winnerKey);
        aNote = `${aTeamName} 在对方回合（${roundOwnerName}的级）胜但含末游，不通关但A失败不计`;
      }
    } else {
      // Winner does not have last place
      if (strictA && (roundLevel !== 'A' || roundOwner !== aTeam)) {
        // Strict mode: Must win at own A-level
        if (roundLevel !== 'A') {
          aNote = `${aTeamName} A级胜利（但本局级牌为${roundLevel}，需在自己的A级获胜才能通关）`;
        } else {
          aNote = `${aTeamName} A级胜利（但在${roundOwnerName}的回合，需在自己的A级获胜才能通关）`;
        }
        // No upgrade, but no failure count
        winnerNewLevel = state.getTeamLevel(winnerKey);
      } else {
        // Victory! (Either lenient mode, or strict mode at own A-level)
        finalWin = true;
        aNote = `${aTeamName} A级通关（胜方无末游${strictA ? '，在自己的A级' : ''}）`;
      }
    }
  } else {
    // Case 2: A-team lost the round
    if (roundOwner === aTeam) {
      // It's their own round - counts as failure
      const newAFail = (aTeam === 't1' ? t1AFail : t2AFail) + 1;
      state.setTeamAFail(aTeam, newAFail);

      aNote = `${aTeamName} A级失败（在自己的A级未取胜）→ A${newAFail}`;

      if (newAFail >= 3) {
        // Reset the A-team to level 2
        if (aTeam === winnerKey) {
          winnerNewLevel = '2';
        } else {
          loserNewLevel = '2';
        }
        state.setTeamAFail(aTeam, 0);
        aNote += '｜累计3次失败，仅该队重置到2';
      }
    } else {
      // Not their own round - doesn't count as failure
      aNote = `${aTeamName} 在对方回合（${roundOwnerName}的级）未胜，A失败不计`;
    }
  }

  return {
    aNote,
    finalWin,
    winnerNewLevel,
    loserNewLevel,
    aTeam
  };
}

/**
 * Apply game result - main orchestration function
 * @param {Object} calcResult - Result from calculator.calculateUpgrade() (must have: upgrade, mode, ranks)
 * @param {string} winnerKey - Winning team key
 * @param {Object} playerRankingData - Current ranking with player details
 * @returns {{applied: boolean, finalWin: boolean, historyEntry: Object}}
 */
export function applyGameResult(calcResult, winnerKey, playerRankingData) {
  console.log('applyGameResult called with:', { calcResult, winnerKey, playerRankingData });

  if (!calcResult || calcResult.upgrade === undefined) {
    console.error('Invalid calc result:', calcResult);
    return { applied: false };
  }

  // Ensure ranks array exists
  if (!calcResult.ranks || !Array.isArray(calcResult.ranks)) {
    console.error('calcResult.ranks is missing or invalid:', calcResult);
    return { applied: false };
  }

  const loserKey = winnerKey === 't1' ? 't2' : 't1';
  const thisRound = state.getRoundLevel();

  // Create snapshot for rollback
  const snapshot = {
    prevT1Lvl: state.getTeamLevel('t1'),
    prevT1A: state.getTeamAFail('t1'),
    prevT2Lvl: state.getTeamLevel('t2'),
    prevT2A: state.getTeamAFail('t2'),
    prevRound: thisRound
  };

  // Calculate new levels
  const winnerCurrentLevel = state.getTeamLevel(winnerKey);
  let winnerNewLevel = nextLevel(winnerCurrentLevel, calcResult.upgrade);
  let loserNewLevel = state.getTeamLevel(loserKey);

  // Next round base is winner's new level
  const nextBaseByRule = winnerNewLevel;

  // Apply A-level rules
  const aLevelResult = checkALevelRules(winnerKey, calcResult.ranks, calcResult.mode);

  // Override levels if A-level rules dictate
  if (aLevelResult.winnerNewLevel !== null && aLevelResult.winnerNewLevel !== undefined) {
    winnerNewLevel = aLevelResult.winnerNewLevel;
  }
  if (aLevelResult.loserNewLevel !== null && aLevelResult.loserNewLevel !== undefined) {
    loserNewLevel = aLevelResult.loserNewLevel;
  }

  // Apply upgrades to teams
  state.setTeamLevel(winnerKey, winnerNewLevel);
  state.setTeamLevel(loserKey, loserNewLevel);

  // Decide round advancement
  const autoNext = config.getPreference('autoNext');
  if (autoNext || aLevelResult.finalWin) {
    // Advance to next round
    state.setRoundLevel(String(nextBaseByRule));
    state.setRoundOwner(winnerKey);
    state.setNextRoundBase(null);
    console.log('Auto advancing: roundLevel set to', nextBaseByRule, 'from', thisRound, 'owner:', winnerKey);
  } else {
    // Stay at current round (manual mode)
    state.setRoundLevel(String(thisRound));
    state.setNextRoundBase(String(nextBaseByRule));
    console.log('Manual mode: roundLevel stays at', thisRound, 'next would be', nextBaseByRule);
  }

  // Create history entry
  const winnerName = winnerKey === 't1' ? config.getTeamName('t1') : config.getTeamName('t2');
  const historyEntry = {
    ts: now(),
    mode: calcResult.mode,
    combo: '(' + calcResult.ranks.join(',') + ')',
    ranks: calcResult.ranks,
    up: calcResult.upgrade,
    win: winnerName,
    winKey: winnerKey,
    t1: state.getTeamLevel('t1'),
    t2: state.getTeamLevel('t2'),
    round: thisRound,
    aNote: aLevelResult.aNote,
    ...snapshot,
    playerRankings: playerRankingData || {}
  };

  // Add to history
  state.addHistoryEntry(historyEntry);

  // Emit events
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

  // Get last winner from history
  const history = state.getHistory();
  let lastWinner = null;
  if (history.length > 0) {
    lastWinner = history[history.length - 1].winKey;
  }

  // Advance round
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
