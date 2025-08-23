/**
 * Storage management module for persisting game state and settings
 */

// Storage keys
export const KEYS = {
  SETTINGS: 'gd_v7_5_1_settings',
  STATE: 'gd_v7_5_1_state',
  PLAYERS: 'gd_players',
  PLAYER_STATS: 'gd_player_stats'
};

/**
 * Load data from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} Parsed data or default value
 */
export function load(key, defaultValue) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return defaultValue;
  }
}

/**
 * Save data to localStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to save
 */
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

/**
 * Clear specific key from localStorage
 * @param {string} key - Storage key to clear
 */
export function clear(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to clear from localStorage:', e);
  }
}

/**
 * Clear all game-related data from localStorage
 */
export function clearAll() {
  Object.values(KEYS).forEach(key => clear(key));
}

/**
 * Initialize default settings
 * @returns {Object} Default settings object
 */
export function getDefaultSettings() {
  return {
    // 4-player mode rules
    c4: { '1,2': 3, '1,3': 2, '1,4': 1 },
    
    // 6-player mode thresholds and points
    t6: { g3: 7, g2: 4, g1: 1 },
    p6: { 1: 5, 2: 4, 3: 3, 4: 3, 5: 1, 6: 0 },
    
    // 8-player mode thresholds and points
    t8: { g3: 11, g2: 6, g1: 1 },
    p8: { 1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0 },
    
    // Game preferences
    must1: true,
    autoNext: true,
    autoApply: true,
    strictA: true,
    
    // Team settings
    t1: { name: '蓝队', color: '#3b82f6' },
    t2: { name: '红队', color: '#ef4444' }
  };
}

/**
 * Initialize default game state
 * @returns {Object} Default state object
 */
export function getDefaultState() {
  return {
    t1: { lvl: '2', aFail: 0 },
    t2: { lvl: '2', aFail: 0 },
    hist: [],
    roundLevel: '2',
    nextRoundBase: null
  };
}

/**
 * Load settings with defaults
 * @returns {Object} Settings object
 */
export function loadSettings() {
  const settings = load(KEYS.SETTINGS, {});
  const defaults = getDefaultSettings();
  
  // Merge with defaults
  Object.keys(defaults).forEach(key => {
    if (!(key in settings)) {
      settings[key] = defaults[key];
    }
  });
  
  return settings;
}

/**
 * Load game state with defaults
 * @returns {Object} State object
 */
export function loadState() {
  const state = load(KEYS.STATE, {});
  const defaults = getDefaultState();
  
  // Merge with defaults
  Object.keys(defaults).forEach(key => {
    if (!(key in state)) {
      state[key] = defaults[key];
    }
  });
  
  return state;
}

/**
 * Save settings
 * @param {Object} settings - Settings to save
 */
export function saveSettings(settings) {
  save(KEYS.SETTINGS, settings);
}

/**
 * Save game state
 * @param {Object} state - State to save
 */
export function saveState(state) {
  save(KEYS.STATE, state);
}

/**
 * Save players
 * @param {Array} players - Players array
 */
export function savePlayers(players) {
  save(KEYS.PLAYERS, players);
}

/**
 * Load players
 * @returns {Array} Players array
 */
export function loadPlayers() {
  return load(KEYS.PLAYERS, []);
}

/**
 * Save player stats
 * @param {Object} stats - Player statistics
 */
export function savePlayerStats(stats) {
  save(KEYS.PLAYER_STATS, stats);
}

/**
 * Load player stats
 * @returns {Object} Player statistics
 */
export function loadPlayerStats() {
  return load(KEYS.PLAYER_STATS, {});
}