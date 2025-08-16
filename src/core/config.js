/**
 * Configuration and Constants
 * All game settings, rules, and default values
 */

export const CONFIG = {
  // Storage keys
  STORAGE_KEYS: {
    SETTINGS: 'gd_v8_settings',
    STATE: 'gd_v8_state',
    PLAYERS: 'gd_v8_players',
    STATS: 'gd_v8_stats',
    HISTORY: 'gd_v8_history'
  },

  // Game modes
  MODES: {
    FOUR: 4,
    SIX: 6,
    EIGHT: 8
  },

  // Level mappings (2-14 to card ranks)
  LEVELS: {
    2: 'A',
    3: 'K',
    4: 'Q',
    5: 'J',
    6: '10',
    7: '9',
    8: '8',
    9: '7',
    10: '6',
    11: '5',
    12: '4',
    13: '3',
    14: '2'
  },

  // Default team configuration
  TEAMS: {
    t1: {
      id: 't1',
      name: '蓝队',
      color: '#3b82f6',
      defaultLevel: 2,
      aFail: 0
    },
    t2: {
      id: 't2', 
      name: '红队',
      color: '#ef4444',
      defaultLevel: 2,
      aFail: 0
    }
  },

  // Default scoring rules for 4-player mode
  SCORING_4P: {
    '1,2': 3,  // Both teammates in 1st and 2nd
    '1,3': 2,  // Teammates in 1st and 3rd
    '1,4': 1,  // Teammates in 1st and 4th
    '2,3': 1   // Teammates in 2nd and 3rd
  },

  // Default scoring for 6-player mode
  SCORING_6P: {
    thresholds: {
      g3: 7,  // Score >= 7: upgrade 3 levels
      g2: 4,  // Score >= 4: upgrade 2 levels
      g1: 1   // Score >= 1: upgrade 1 level
    },
    points: {
      1: 5,   // Points for 1st place
      2: 4,   // Points for 2nd place
      3: 3,   // Points for 3rd place
      4: 3,   // Points for 4th place
      5: 1,   // Points for 5th place
      6: 0    // Points for 6th place
    }
  },

  // Default scoring for 8-player mode
  SCORING_8P: {
    thresholds: {
      g3: 11, // Score >= 11: upgrade 3 levels
      g2: 6,  // Score >= 6: upgrade 2 levels
      g1: 1   // Score >= 1: upgrade 1 level
    },
    points: {
      1: 7,   // Points for 1st place
      2: 6,   // Points for 2nd place
      3: 5,   // Points for 3rd place
      4: 4,   // Points for 4th place
      5: 3,   // Points for 5th place
      6: 2,   // Points for 6th place
      7: 1,   // Points for 7th place
      8: 0    // Points for 8th place
    }
  },

  // Special scoring patterns for 8-player mode (winner combinations)
  PATTERNS_8P: {
    '1 2': { score: 7, label: '四打一' },
    '1 2 3': { score: 6, label: '三打一' },
    '1 2 3 4': { score: 5, label: '双下' },
    '1 2 3 5': { score: 4, label: '过牌双下' },
    '1 2 4 5': { score: 3, label: '单下' },
    '1 2 4 6': { score: 2, label: '过牌' },
    '1 3 4 5': { score: 2, label: '过牌' },
    '1 2 5 6': { score: 2, label: '大过牌' },
    '1 3 4 6': { score: 1, label: '赢' },
    '1 3 5 7': { score: 1, label: '赢' },
    '2 3 4 5': { score: 1, label: '赢' }
  },

  // Game settings defaults
  SETTINGS: {
    must1: true,        // Must have rank 1 to win
    autoNext: true,     // Auto advance to next round
    autoApply: true,    // Auto apply results after calculation
    strictA: true,      // Strict A-level rules
    maxAFails: 3        // Max A-level failures before penalty
  },

  // Player emojis pool
  EMOJIS: [
    '🐺', '🦊', '🐳', '🐟', '🐠', '🦇', '🦆', '🦀',
    '🦅', '🦉', '🦩', '🦜', '🐢', '🦎', '🐍', '🐲',
    '🐉', '🦄', '🐴', '🦓', '🦌', '🦘', '🦡', '🦦',
    '🦥', '🦔', '🐿️', '🦫', '🐻', '🐨', '🐼', '🦁'
  ],

  // UI Constants
  UI: {
    DRAG_DELAY: 200,      // Touch drag delay in ms
    RIPPLE_DURATION: 600, // Ripple animation duration
    VIBRATE_DURATION: 50, // Haptic feedback duration
    MAX_HISTORY: 100,     // Max history entries to keep
    MAX_PLAYERS: 12,      // Maximum players allowed
    MIN_PLAYERS: 4        // Minimum players required
  },

  // Export formats
  EXPORT: {
    DATE_FORMAT: {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    },
    CANVAS: {
      WIDTH: 1200,
      HEIGHT: 1600,
      SCALE: 2,
      BG_COLOR: '#ffffff'
    }
  },

  // Color scheme
  COLORS: {
    bg: '#0b0b0c',
    card: '#16171b',
    ink: '#f5f6f8',
    muted: '#b4b8bf',
    stroke: '#2a2d35',
    chip: '#24262c',
    accent: '#e6b800',
    success: '#4ade80',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6'
  }
};

// Default player names by mode
export const DEFAULT_PLAYERS = {
  4: ['玩家1', '玩家2', '玩家3', '玩家4'],
  6: ['玩家1', '玩家2', '玩家3', '玩家4', '玩家5', '玩家6'],
  8: ['玩家1', '玩家2', '玩家3', '玩家4', '玩家5', '玩家6', '玩家7', '玩家8']
};

// Level progression rules
export const LEVEL_RULES = {
  MIN_LEVEL: 2,  // A
  MAX_LEVEL: 14, // 2
  A_LEVEL: 2,    // A is level 2
  RESET_LEVEL: 2, // Reset to level 2 after A3 failure
  
  // Check if level is A
  isALevel: (level) => level === 2,
  
  // Get display name for level
  getLevelDisplay: (level) => CONFIG.LEVELS[level] || '?',
  
  // Calculate new level after upgrade
  calculateNewLevel: (currentLevel, upgradeAmount) => {
    const newLevel = currentLevel + upgradeAmount;
    return Math.min(newLevel, LEVEL_RULES.MAX_LEVEL);
  },
  
  // Check if team has won (reached level 2 after A)
  hasWon: (level, previousLevel) => {
    return previousLevel === LEVEL_RULES.A_LEVEL && level > LEVEL_RULES.A_LEVEL;
  }
};

// Validation rules
export const VALIDATION = {
  isValidMode: (mode) => [4, 6, 8].includes(mode),
  isValidLevel: (level) => level >= LEVEL_RULES.MIN_LEVEL && level <= LEVEL_RULES.MAX_LEVEL,
  isValidTeam: (team) => team === 1 || team === 2,
  isValidRank: (rank, mode) => rank >= 1 && rank <= mode,
  isValidPlayerCount: (count) => count >= CONFIG.UI.MIN_PLAYERS && count <= CONFIG.UI.MAX_PLAYERS
};

export default CONFIG;