/**
 * LocalStorage Wrapper
 * Extracted from app.js lines 64-83
 * Updated to use gd_v9_* keys
 */

// Storage key prefix
const KEY_PREFIX = 'gd_v9_';

// Storage keys
export const KEYS = {
  CONFIG: `${KEY_PREFIX}config`,
  STATE: `${KEY_PREFIX}state`,
  PLAYERS: `${KEY_PREFIX}players`,
  STATS: `${KEY_PREFIX}stats`
};

/**
 * Load data from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} Parsed data or default value
 */
export function load(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.warn(`Failed to load from localStorage key "${key}":`, e);
    return defaultValue;
  }
}

/**
 * Save data to localStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to save (will be JSON.stringified)
 * @returns {boolean} True if save succeeded, false otherwise
 */
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Failed to save to localStorage key "${key}":`, e);
    return false;
  }
}

/**
 * Remove data from localStorage
 * @param {string} key - Storage key
 */
export function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`Failed to remove localStorage key "${key}":`, e);
    return false;
  }
}

/**
 * Clear all gd_v9_* keys from localStorage
 */
export function clearAll() {
  try {
    Object.values(KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (e) {
    console.error('Failed to clear localStorage:', e);
    return false;
  }
}

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
export function isAvailable() {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}
