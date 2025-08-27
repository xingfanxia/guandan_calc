// Game calculation and rules engine
// UTF-8 encoding for Chinese characters

import { GAME_LEVELS } from '../utils/constants.js';

/**
 * Parse ranking input text into validated ranks array
 * @param {string} text - Input text
 * @param {number} need - Number of ranks needed
 * @returns {Object} Result with ok status and ranks or error message
 */
export function parseRanks(text, need) {
  if (!text) return {ok: false, msg: '请输入名次'};
  
  const t = String(text).trim();
  const maxn = (need === 2 ? 4 : (need === 3 ? 6 : 8));
  const re = new RegExp('^[0-9]{' + need + '}$');
  
  // Try compact format (e.g., "123" for ranks 1,2,3)
  if (re.test(t)) {
    const arr = t.split('');
    const nums = [];
    
    for (let i = 0; i < arr.length; i++) {
      nums.push(parseInt(arr[i], 10));
    }
    
    // Check for valid range and duplicates
    const seen = {};
    for (let j = 0; j < nums.length; j++) {
      if (nums[j] < 1 || nums[j] > maxn) {
        return {ok: false, msg: '名次超出范围'};
      }
      if (seen[nums[j]]) {
        return {ok: false, msg: '名次不能重复'};
      }
      seen[nums[j]] = 1;
    }
    
    nums.sort((a, b) => a - b);
    return {ok: true, ranks: nums};
  }
  
  // Try space-separated format (e.g., "1 2 3")
  const parts = t.replace(/[^0-9]+/g, ' ').trim().split(/\s+/);
  if (parts.length !== need) {
    return {ok: false, msg: '需要 ' + need + ' 个名次'};
  }
  
  const nums2 = [];
  for (let k = 0; k < parts.length; k++) {
    const n = parseInt(parts[k], 10);
    if (!(n >= 1 && n <= maxn)) {
      return {ok: false, msg: '名次必须在 1~' + maxn};
    }
    nums2.push(n);
  }
  
  // Check for duplicates
  const seen2 = {};
  for (let m = 0; m < nums2.length; m++) {
    if (seen2[nums2[m]]) {
      return {ok: false, msg: '名次不能重复'};
    }
    seen2[nums2[m]] = 1;
  }
  
  nums2.sort((a, b) => a - b);
  return {ok: true, ranks: nums2};
}

/**
 * Sum array values
 * @param {Array} arr - Array of numbers
 * @returns {number} Sum
 */
export function sum(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s += arr[i];
  }
  return s;
}

/**
 * Calculate score sum from ranks using point map
 * @param {Array} ranks - Array of ranks
 * @param {Object} pointMap - Points mapping
 * @returns {number} Score sum
 */
export function scoreSum(ranks, pointMap) {
  let s = 0;
  for (let i = 0; i < ranks.length; i++) {
    s += (pointMap[ranks[i]] || 0);
  }
  return s;
}

/**
 * Determine tier based on score difference
 * @param {number} diff - Score difference
 * @param {Object} thresholds - Tier thresholds
 * @returns {number} Tier level (0-3)
 */
export function tier(diff, thresholds) {
  if (diff >= thresholds.g3) return 3;
  if (diff >= thresholds.g2) return 2;
  if (diff >= thresholds.g1) return 1;
  return 0;
}

/**
 * Calculate next level after upgrade
 * @param {string} current - Current level
 * @param {number} increment - Level increment
 * @returns {string} Next level
 */
export function nextLevel(current, increment) {
  const i = Math.max(0, GAME_LEVELS.indexOf(current));
  return GAME_LEVELS[Math.min(GAME_LEVELS.length - 1, i + increment)];
}

/**
 * Main game calculation function
 * @param {string} mode - Game mode ('4', '6', or '8')
 * @param {Array} ranks - Winning team ranks
 * @param {Object} settings - Game settings
 * @param {boolean} must1 - Must have rank 1 rule
 * @returns {Object} Calculation result
 */
export function calculateUpgrade(mode, ranks, settings, must1 = true) {
  const need = (mode === '4' ? 2 : (mode === '6' ? 3 : 4));
  
  let up = 0;
  let ours = null;
  let opp = null;
  let diff = null;
  
  if (mode === '4') {
    // 4-player mode uses fixed upgrade table
    up = settings.c4[ranks[0] + ',' + ranks[1]] || 0;
  } else if (mode === '6') {
    // 6-player mode uses point-based system
    ours = scoreSum(ranks, settings.p6);
    opp = sum([settings.p6[1], settings.p6[2], settings.p6[3], settings.p6[4], settings.p6[5], settings.p6[6]]) - ours;
    diff = ours - opp;
    up = (must1 && ranks.indexOf(1) === -1) ? 0 : tier(diff, settings.t6);
  } else {
    // 8-player mode
    // Special case: complete sweep (ranks 1,2,3,4) = 4 level upgrade
    if (ranks.length === 4 && ranks[0] === 1 && ranks[1] === 2 && ranks[2] === 3 && ranks[3] === 4) {
      up = 4;
    } else {
      // Normal point-based calculation
      ours = scoreSum(ranks, settings.p8);
      opp = sum([settings.p8[1], settings.p8[2], settings.p8[3], settings.p8[4], settings.p8[5], settings.p8[6], settings.p8[7], settings.p8[8]]) - ours;
      diff = ours - opp;
      up = (must1 && ranks.indexOf(1) === -1) ? 0 : tier(diff, settings.t8);
    }
  }
  
  return {
    upgrade: up,
    ourScore: ours,
    oppScore: opp,
    difference: diff
  };
}

/**
 * Check A-level victory conditions
 * @param {Object} state - Game state
 * @param {Object} settings - Game settings
 * @param {string} winner - Winner team
 * @param {Array} ranks - Winner ranks
 * @param {string} mode - Game mode
 * @returns {Object} A-level result
 */
export function checkALevelRules(state, settings, winner, ranks, mode) {
  const lastRank = (mode === '4' ? 4 : (mode === '6' ? 6 : 8));
  const winnerHasLast = ranks.indexOf(lastRank) >= 0;
  
  let aNote = '';
  let finalWin = false;
  let aTeam = null;
  let winnerNewLevel = null;
  let loserNewLevel = null;
  
  // Determine which team is at A level
  if (state.t1.lvl === 'A' && state.t2.lvl === 'A') {
    aTeam = winner;
  } else if (state.t1.lvl === 'A') {
    aTeam = 't1';
  } else if (state.t2.lvl === 'A') {
    aTeam = 't2';
  }
  
  if (aTeam) {
    const aTeamName = (aTeam === 't1' ? settings.t1.name : settings.t2.name);
    
    if (aTeam === winner) {
      // A-level team won
      if (winnerHasLast) {
        // Winner has last place - cannot pass A level
        if (state.roundOwner === aTeam) {
          // Only count failure if it's their own round
          state[aTeam].aFail = (state[aTeam].aFail || 0) + 1;
          aNote = aTeamName + ' A级失败（在自己的A级胜方含末游）→ A' + state[aTeam].aFail;
          
          if (state[aTeam].aFail >= 3) {
            winnerNewLevel = '2'; // Reset to level 2
            state[aTeam].aFail = 0;
            aNote += '｜累计3次失败，仅该队重置到2';
          } else {
            winnerNewLevel = state[winner].lvl; // No upgrade
          }
        } else {
          winnerNewLevel = state[winner].lvl; // No upgrade
          aNote = aTeamName + ' 在对方回合（' + (state.roundOwner === 't1' ? settings.t1.name : settings.t2.name) + '的级）胜但含末游，不通关但A失败不计';
        }
      } else {
        // Check strict mode
        if (settings.strictA && (state.roundLevel !== 'A' || state.roundOwner !== aTeam)) {
          // In strict mode, must win at your own A level
          const roundOwnerName = state.roundOwner ? (state.roundOwner === 't1' ? settings.t1.name : settings.t2.name) : '未知';
          
          if (state.roundLevel !== 'A') {
            aNote = aTeamName + ' A级胜利（但本局级牌为' + state.roundLevel + '，需在自己的A级获胜才能通关）';
          } else {
            aNote = aTeamName + ' A级胜利（但在' + roundOwnerName + '的回合，需在自己的A级获胜才能通关）';
          }
          winnerNewLevel = state[winner].lvl; // No upgrade
        } else {
          // Victory conditions met
          finalWin = true;
          aNote = aTeamName + ' A级通关（胜方无末游' + (settings.strictA ? '，在自己的A级' : '') + '）';
        }
      }
    } else {
      // A-level team lost
      if (state.roundOwner === aTeam) {
        // Only count failure if it's their own round
        state[aTeam].aFail = (state[aTeam].aFail || 0) + 1;
        aNote = aTeamName + ' A级失败（在自己的A级未取胜）→ A' + state[aTeam].aFail;
        
        if (state[aTeam].aFail >= 3) {
          // Reset the A-team to level 2
          if (aTeam === winner) {
            winnerNewLevel = '2';
          } else {
            loserNewLevel = '2';
          }
          state[aTeam].aFail = 0;
          aNote += '｜累计3次失败，仅该队重置到2';
        }
      } else {
        aNote = aTeamName + ' 在对方回合（' + (state.roundOwner === 't1' ? settings.t1.name : settings.t2.name) + '的级）未胜，A失败不计';
      }
    }
  }
  
  return {
    aNote,
    finalWin,
    winnerNewLevel,
    loserNewLevel
  };
}