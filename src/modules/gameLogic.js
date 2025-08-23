/**
 * Game logic module for Guandan calculator
 */

// Level progression sequence
const LEVELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Parse rank input text
 * @param {string} text - Input text containing ranks
 * @param {number} need - Number of ranks needed
 * @returns {Object} Result with ok status and ranks array or error message
 */
export function parseRanks(text, need) {
  if (!text) {
    return { ok: false, msg: '请输入名次' };
  }
  
  const t = String(text).trim();
  const maxn = need === 2 ? 4 : (need === 3 ? 6 : 8);
  const re = new RegExp(`^[0-9]{${need}}$`);
  
  // Try parsing as a simple string of digits
  if (re.test(t)) {
    const arr = t.split('');
    const nums = [];
    
    for (let i = 0; i < arr.length; i++) {
      nums.push(parseInt(arr[i], 10));
    }
    
    const seen = {};
    for (let j = 0; j < nums.length; j++) {
      if (nums[j] < 1 || nums[j] > maxn) {
        return { ok: false, msg: '名次超出范围' };
      }
      if (seen[nums[j]]) {
        return { ok: false, msg: '名次不能重复' };
      }
      seen[nums[j]] = 1;
    }
    
    nums.sort((a, b) => a - b);
    return { ok: true, ranks: nums };
  }
  
  // Try parsing as space-separated numbers
  const parts = t.replace(/[^0-9]+/g, ' ').trim().split(/\s+/);
  if (parts.length !== need) {
    return { ok: false, msg: `需要 ${need} 个名次` };
  }
  
  const nums2 = [];
  for (let k = 0; k < parts.length; k++) {
    const n = parseInt(parts[k], 10);
    if (!(n >= 1 && n <= maxn)) {
      return { ok: false, msg: `名次必须在 1~${maxn}` };
    }
    nums2.push(n);
  }
  
  const seen2 = {};
  for (let m = 0; m < nums2.length; m++) {
    if (seen2[nums2[m]]) {
      return { ok: false, msg: '名次不能重复' };
    }
    seen2[nums2[m]] = 1;
  }
  
  nums2.sort((a, b) => a - b);
  return { ok: true, ranks: nums2 };
}

/**
 * Calculate upgrade tier based on score difference
 * @param {number} diff - Score difference
 * @param {Object} thresholds - Threshold object with g1, g2, g3 properties
 * @returns {number} Upgrade tier (0-3)
 */
export function calculateTier(diff, thresholds) {
  if (diff >= thresholds.g3) return 3;
  if (diff >= thresholds.g2) return 2;
  if (diff >= thresholds.g1) return 1;
  return 0;
}

/**
 * Get next level after upgrade
 * @param {string} current - Current level
 * @param {number} increment - Number of levels to advance
 * @returns {string} New level
 */
export function getNextLevel(current, increment) {
  const index = Math.max(0, LEVELS.indexOf(current));
  return LEVELS[Math.min(LEVELS.length - 1, index + increment)];
}

/**
 * Check if level is A
 * @param {string} level - Level to check
 * @returns {boolean} True if level is A
 */
export function isALevel(level) {
  return level === 'A';
}

/**
 * Get level index for comparison
 * @param {string} level - Level string
 * @returns {number} Index in levels array
 */
export function getLevelIndex(level) {
  return LEVELS.indexOf(level);
}

/**
 * Compare two levels
 * @param {string} level1 - First level
 * @param {string} level2 - Second level
 * @returns {number} -1 if level1 < level2, 0 if equal, 1 if level1 > level2
 */
export function compareLevels(level1, level2) {
  const index1 = getLevelIndex(level1);
  const index2 = getLevelIndex(level2);
  
  if (index1 < index2) return -1;
  if (index1 > index2) return 1;
  return 0;
}

/**
 * Calculate game result for 4-player mode
 * @param {number[]} ranks - Array of ranks
 * @param {Object} rules - Rules object with upgrade values
 * @param {boolean} must1 - Whether first place is required
 * @returns {Object} Result with winner and upgrade amount
 */
export function calculate4PlayerResult(ranks, rules, must1) {
  // Check first place requirement
  if (must1 && ranks[0] !== 1) {
    return { 
      ok: true, 
      winner: 't2', 
      upgrade: 0, 
      msg: '对方胜 (非头游)' 
    };
  }
  
  // Check for complete sweep (1,2,3,4)
  if (ranks.length === 2 && ranks[0] === 1 && ranks[1] === 2) {
    return { 
      ok: true, 
      winner: 't1', 
      upgrade: 4, 
      msg: '完胜！升4级' 
    };
  }
  
  const key = ranks.join(',');
  const upgrade = rules[key] || 0;
  
  return {
    ok: true,
    winner: 't1',
    upgrade: upgrade,
    msg: upgrade > 0 ? `胜方升${upgrade}级` : '平局'
  };
}

/**
 * Calculate game result for 6 or 8-player mode
 * @param {number[]} teamRanks - Array of team member ranks
 * @param {number[]} opponentRanks - Array of opponent ranks
 * @param {Object} points - Points mapping for each rank
 * @param {Object} thresholds - Upgrade thresholds
 * @param {boolean} must1 - Whether first place is required
 * @returns {Object} Result with winner and upgrade amount
 */
export function calculateMultiPlayerResult(teamRanks, opponentRanks, points, thresholds, must1) {
  // Check first place requirement
  const hasFirst = teamRanks.includes(1);
  const opponentHasFirst = opponentRanks.includes(1);
  
  if (must1 && !hasFirst && opponentHasFirst) {
    return {
      ok: true,
      winner: 'opponent',
      upgrade: 0,
      msg: '对方胜 (非头游)'
    };
  }
  
  // Check for complete sweep (8-player: 1,2,3,4)
  if (teamRanks.length === 4 && 
      teamRanks[0] === 1 && teamRanks[1] === 2 && 
      teamRanks[2] === 3 && teamRanks[3] === 4) {
    return {
      ok: true,
      winner: 'team',
      upgrade: 4,
      msg: '完胜！升4级'
    };
  }
  
  // Calculate scores
  let teamScore = 0;
  let opponentScore = 0;
  
  teamRanks.forEach(rank => {
    teamScore += points[rank] || 0;
  });
  
  opponentRanks.forEach(rank => {
    opponentScore += points[rank] || 0;
  });
  
  const diff = teamScore - opponentScore;
  const upgrade = calculateTier(Math.abs(diff), thresholds);
  
  if (diff > 0) {
    return {
      ok: true,
      winner: 'team',
      upgrade: upgrade,
      msg: upgrade > 0 ? `胜方升${upgrade}级` : '平局'
    };
  } else if (diff < 0) {
    return {
      ok: true,
      winner: 'opponent',
      upgrade: upgrade,
      msg: upgrade > 0 ? `对方升${upgrade}级` : '平局'
    };
  } else {
    return {
      ok: true,
      winner: null,
      upgrade: 0,
      msg: '平局'
    };
  }
}

/**
 * Apply A-level rules to the game result
 * @param {Object} gameState - Current game state
 * @param {string} winner - Winning team
 * @param {string} loser - Losing team
 * @param {boolean} strictMode - Whether strict A-level rules apply
 * @returns {Object} Updated state with A-level logic applied
 */
export function applyALevelRules(gameState, winner, loser, strictMode) {
  const result = {
    winnerLevel: gameState[winner].lvl,
    loserLevel: gameState[loser].lvl,
    winnerAFail: gameState[winner].aFail,
    loserAFail: gameState[loser].aFail,
    winnerUpgrade: 0,
    loserUpgrade: 0,
    aNote: ''
  };
  
  const currentRound = gameState.roundLevel;
  const winnerAtA = isALevel(result.winnerLevel);
  const loserAtA = isALevel(result.loserLevel);
  const playingAtA = isALevel(currentRound);
  
  // Handle A-level victory
  if (winnerAtA && playingAtA) {
    const winnerOwnsRound = result.winnerLevel === currentRound;
    
    if (strictMode) {
      // Strict mode: must win at YOUR OWN A level
      if (winnerOwnsRound) {
        result.winnerUpgrade = 1; // Complete victory
        result.aNote = `${winner === 't1' ? '蓝队' : '红队'} A级通关！`;
      } else {
        // Not their round, no upgrade but no failure
        result.aNote = `${winner === 't1' ? '蓝队' : '红队'} 在对方A级获胜，不升级`;
      }
    } else {
      // Lenient mode: any A-level victory counts
      result.winnerUpgrade = 1;
      result.aNote = `${winner === 't1' ? '蓝队' : '红队'} A级通关！`;
    }
  }
  
  // Handle A-level failure
  if (loserAtA && playingAtA) {
    const loserOwnsRound = result.loserLevel === currentRound;
    
    if (loserOwnsRound) {
      result.loserAFail++;
      
      if (result.loserAFail >= 3) {
        // Reset to level 2 after 3 failures
        result.loserLevel = '2';
        result.loserAFail = 0;
        result.aNote += (result.aNote ? ' | ' : '') + 
                       `${loser === 't1' ? '蓝队' : '红队'} A3失败，降至2级`;
      } else {
        result.aNote += (result.aNote ? ' | ' : '') + 
                       `${loser === 't1' ? '蓝队' : '红队'} A${result.loserAFail}失败`;
      }
    }
  }
  
  return result;
}