/**
 * Game Rules Engine - A-Level Logic and Rule Application
 * Handles complex A-level victory/failure conditions
 *
 * Rule modes:
 *   4-player: Strict A-level rules with A1/A2/A3 failure tracking; 3 fails → demote to level 2.
 *   6/8-player (since 2026-05): NO failure tracking, NO demotion. Game keeps playing until either
 *                               team wins on their own A level (subject to strictA preference).
 */

import { nextLevel } from './calculator.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';
import { now } from '../core/utils.js';

/**
 * Whether this mode tracks A-level failures and demotes after 3 strikes.
 */
function tracksAFail(mode) {
  return mode === '4';
}

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
  const roundOwner = state.getRoundOwner();
  const roundLevel = state.getRoundLevel();
  const strictA = config.getPreference('strictA');
  const aFailEnabled = tracksAFail(mode);

  let aNote = '';
  let finalWin = false;
  let aTeam = null;
  let winnerNewLevel = null;
  let loserNewLevel = null;

  // Determine which team is at A-level
  if (t1Level === 'A' && t2Level === 'A') {
    aTeam = winnerKey; // Both at A — winner is the A-team being evaluated
  } else if (t1Level === 'A') {
    aTeam = 't1';
  } else if (t2Level === 'A') {
    aTeam = 't2';
  }

  // No team at A-level → no special rules apply
  if (!aTeam) {
    return { aNote, finalWin };
  }

  const lastRank = mode === '4' ? 4 : (mode === '6' ? 6 : 8);
  const winnerHasLast = ranks.indexOf(lastRank) >= 0;

  const loserKey = winnerKey === 't1' ? 't2' : 't1';
  const aTeamName = config.getTeamName(aTeam);
  // Guard roundOwner === null (first-round / brand-new game)
  const roundOwnerName = roundOwner ? config.getTeamName(roundOwner) : '未定';

  /**
   * Increment A-fail counter for a team. Returns the new count + whether the team is demoted.
   * In 6/8 mode this is a no-op (returns null).
   */
  function recordAFail(team) {
    if (!aFailEnabled) return null;
    const current = state.getTeamAFail(team);
    const next = current + 1;
    if (next >= 3) {
      state.setTeamAFail(team, 0); // reset counter on demotion
      return { count: next, demoted: true };
    }
    state.setTeamAFail(team, next);
    return { count: next, demoted: false };
  }

  // Case 1: A-team WON the round
  if (aTeam === winnerKey) {
    if (winnerHasLast) {
      // Winner has last place → cannot pass A this round
      if (roundOwner === aTeam) {
        // Own A round, won with last → failure
        const fail = recordAFail(aTeam);
        if (fail) {
          // 4-player: track and possibly demote
          aNote = `${aTeamName} A级失败（在自己的A级胜方含末游）→ A${fail.count}`;
          if (fail.demoted) {
            winnerNewLevel = '2';
            aNote += '｜累计3次失败，仅该队重置到2';
          } else {
            winnerNewLevel = state.getTeamLevel(winnerKey);
          }
        } else {
          // 6/8: no failure tracking, just stay at A
          winnerNewLevel = state.getTeamLevel(winnerKey);
          aNote = `${aTeamName} 在自己的A级胜方含末游，不通关，继续打到通关`;
        }
      } else {
        // Not their own A round — doesn't trigger failure regardless of mode
        winnerNewLevel = state.getTeamLevel(winnerKey);
        const tail = aFailEnabled ? '但A失败不计' : '继续打到通关';
        aNote = `${aTeamName} 在对方回合（${roundOwnerName}的级）胜但含末游，不通关，${tail}`;
      }
    } else {
      // Winner does not have last place — eligible for victory
      if (strictA && (roundLevel !== 'A' || roundOwner !== aTeam)) {
        // Strict mode: must win at OWN A-level
        if (roundLevel !== 'A') {
          aNote = `${aTeamName} A级胜利（但本局级牌为${roundLevel}，需在自己的A级获胜才能通关）`;
        } else {
          aNote = `${aTeamName} A级胜利（但在${roundOwnerName}的回合，需在自己的A级获胜才能通关）`;
        }
        // No upgrade past A (calculator.nextLevel clamps), no failure
        winnerNewLevel = state.getTeamLevel(winnerKey);
      } else {
        // Victory! (Lenient mode, OR strict mode at own A-level)
        finalWin = true;
        aNote = `${aTeamName} A级通关（胜方无末游${strictA ? '，在自己的A级' : ''}）`;
      }
    }
  } else {
    // Case 2: A-team LOST the round
    if (roundOwner === aTeam) {
      // Own A round, didn't win → failure
      const fail = recordAFail(aTeam);
      if (fail) {
        // 4-player: track and possibly demote (the loser, since aTeam !== winnerKey here)
        aNote = `${aTeamName} A级失败（在自己的A级未取胜）→ A${fail.count}`;
        if (fail.demoted) {
          loserNewLevel = '2';
          aNote += '｜累计3次失败，仅该队重置到2';
        }
      } else {
        // 6/8: stay at A and keep playing
        aNote = `${aTeamName} 在自己的A级未取胜，继续打到通关`;
      }
    } else {
      // Not their own A round — doesn't trigger failure regardless of mode
      const tail = aFailEnabled ? '，A失败不计' : '';
      aNote = `${aTeamName} 在对方回合（${roundOwnerName}的级）未胜${tail}`;
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
  if (!calcResult || calcResult.upgrade === undefined) {
    console.error('Invalid calc result:', calcResult);
    return { applied: false };
  }

  if (!calcResult.ranks || !Array.isArray(calcResult.ranks)) {
    console.error('calcResult.ranks is missing or invalid:', calcResult);
    return { applied: false };
  }

  const loserKey = winnerKey === 't1' ? 't2' : 't1';
  const thisRound = state.getRoundLevel();

  // Snapshot for rollback — includes nextRoundBase so rollback restores manual-mode state correctly
  const snapshot = {
    prevT1Lvl: state.getTeamLevel('t1'),
    prevT1A: state.getTeamAFail('t1'),
    prevT2Lvl: state.getTeamLevel('t2'),
    prevT2A: state.getTeamAFail('t2'),
    prevRound: thisRound,
    prevRoundOwner: state.getRoundOwner(),
    prevNextRoundBase: state.getNextRoundBase()
  };

  // Calculate naive new levels (calculator clamps at 'A')
  const winnerCurrentLevel = state.getTeamLevel(winnerKey);
  let winnerNewLevel = nextLevel(winnerCurrentLevel, calcResult.upgrade);
  let loserNewLevel = state.getTeamLevel(loserKey);

  // Apply A-level rules — may override winnerNewLevel / loserNewLevel
  const aLevelResult = checkALevelRules(winnerKey, calcResult.ranks, calcResult.mode);

  if (aLevelResult.winnerNewLevel !== null && aLevelResult.winnerNewLevel !== undefined) {
    winnerNewLevel = aLevelResult.winnerNewLevel;
  }
  if (aLevelResult.loserNewLevel !== null && aLevelResult.loserNewLevel !== undefined) {
    loserNewLevel = aLevelResult.loserNewLevel;
  }

  // Compute next-round base AFTER A-level override so demotion paths advance correctly.
  // Previously this was captured before override, causing round to advance to stale level.
  const nextBaseByRule = winnerNewLevel;

  // Apply upgrades to teams
  state.setTeamLevel(winnerKey, winnerNewLevel);
  state.setTeamLevel(loserKey, loserNewLevel);

  // Decide round advancement
  const autoNext = config.getPreference('autoNext');
  if (autoNext || aLevelResult.finalWin) {
    state.setRoundLevel(String(nextBaseByRule));
    state.setRoundOwner(winnerKey);
    state.setNextRoundBase(null);
  } else {
    state.setRoundLevel(String(thisRound));
    state.setNextRoundBase(String(nextBaseByRule));
  }

  // Build history entry
  const winnerName = config.getTeamName(winnerKey);
  const historyEntry = {
    ts: now(),
    mode: String(calcResult.mode),
    combo: '(' + calcResult.ranks.join(',') + ')',
    ranks: calcResult.ranks,
    up: calcResult.upgrade,
    win: winnerName,
    winKey: winnerKey,
    t1: state.getTeamLevel('t1'),
    t2: state.getTeamLevel('t2'),
    round: thisRound,
    aNote: aLevelResult.aNote,
    sessionDuration: state.getSessionDuration(),
    gameEndedAt: aLevelResult.finalWin ? new Date().toISOString() : null,
    ...snapshot,
    playerRankings: playerRankingData || {}
  };

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
