// Utility functions for player profile APIs
// UTF-8 encoding for Chinese characters

/**
 * Generate unique player ID in format PLR_XXXXXX
 * @returns {string} Player ID
 */
export function generatePlayerId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'PLR_';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Validate player handle format
 * Must be 3-20 characters, alphanumeric + underscore only
 * @param {string} handle
 * @returns {boolean}
 */
export function validateHandle(handle) {
  if (!handle || typeof handle !== 'string') {
    return false;
  }

  // Check length (3-20 characters)
  if (handle.length < 3 || handle.length > 20) {
    return false;
  }

  // Check format (alphanumeric + underscore only, no @ symbol)
  const handleRegex = /^[a-zA-Z0-9_]+$/;
  return handleRegex.test(handle);
}

/**
 * Validate player creation data
 * @param {object} data Player data
 * @returns {object} { valid: boolean, error?: string }
 */
export function validatePlayerData(data) {
  // Required fields
  if (!data.handle) {
    return { valid: false, error: 'Missing required field: handle' };
  }
  if (!data.displayName) {
    return { valid: false, error: 'Missing required field: displayName' };
  }
  if (!data.emoji) {
    return { valid: false, error: 'Missing required field: emoji' };
  }
  if (!data.playStyle) {
    return { valid: false, error: 'Missing required field: playStyle' };
  }
  if (!data.tagline) {
    return { valid: false, error: 'Missing required field: tagline' };
  }

  // Validate handle format
  if (!validateHandle(data.handle)) {
    return {
      valid: false,
      error: 'Invalid handle format. Must be 3-20 characters, alphanumeric and underscore only'
    };
  }

  // Validate play style (must be one of 8 predefined)
  const validPlayStyles = [
    'gambler', 'chill', 'scapegoat', 'tilt',
    'steady', 'yolo', 'secondPlace', 'mystery'
  ];
  if (!validPlayStyles.includes(data.playStyle)) {
    return {
      valid: false,
      error: `Invalid play style. Must be one of: ${validPlayStyles.join(', ')}`
    };
  }

  // Validate tagline length (max 50 characters)
  if (data.tagline.length > 50) {
    return { valid: false, error: 'Tagline must be 50 characters or less' };
  }

  return { valid: true };
}

/**
 * Initialize fresh player stats object
 * @returns {object} Stats object with all honors at 0
 */
export function initializePlayerStats() {
  return {
    // Session-level stats (complete games)
    sessionsPlayed: 0,
    sessionsWon: 0,
    sessionWinRate: 0,
    avgRankingPerSession: 0,
    avgRoundsPerSession: 0,
    longestSessionRounds: 0,    // Most rounds in a single session
    
    // Round-level stats (individual rounds)
    roundsPlayed: 0,
    avgRankingPerRound: 0,
    
    // Time tracking
    totalPlayTimeSeconds: 0,      // Total time spent playing (all sessions)
    longestSessionSeconds: 0,     // Longest single session
    avgSessionSeconds: 0,         // Average session duration
    
    // Legacy fields (deprecated but kept for compatibility)
    gamesPlayed: 0,
    wins: 0,
    winRate: 0,
    avgRanking: 0,
    
    recentRankings: [],
    honors: {
      '吕布': 0,
      '阿斗': 0,
      '石佛': 0,
      '波动王': 0,
      '奋斗王': 0,
      '辅助王': 0,
      '翻车王': 0,
      '赌徒': 0,
      '大满贯': 0,
      '连胜王': 0,
      '佛系玩家': 0,
      '守门员': 0,
      '慢热王': 0,
      '闪电侠': 0
    },
    currentWinStreak: 0,
    longestWinStreak: 0,
    currentLossStreak: 0,
    longestLossStreak: 0
  };
}
