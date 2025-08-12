/**
 * Storage utility module
 * Handles all localStorage operations with error handling
 */

export const STORAGE_KEYS = {
  SETTINGS: 'gd_v7_5_1_settings',
  STATE: 'gd_v7_5_1_state',
  PLAYERS: 'gd_players',
  PLAYER_STATS: 'gd_player_stats'
};

export function load(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return defaultValue;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error('Failed to remove from localStorage:', e);
    return false;
  }
}

export function clear() {
  try {
    localStorage.clear();
    return true;
  } catch (e) {
    console.error('Failed to clear localStorage:', e);
    return false;
  }
}