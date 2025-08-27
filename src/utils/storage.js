// LocalStorage management utilities
// UTF-8 encoding for Chinese characters

/**
 * Load data from localStorage with fallback
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if load fails
 * @returns {*} - Loaded data or default
 */
export function load(key, defaultValue) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch(e) {
    console.warn(`Failed to load from localStorage key: ${key}`, e);
    return defaultValue;
  }
}

/**
 * Save data to localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} value - Data to save
 * @returns {boolean} - Success status
 */
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch(e) {
    console.warn(`Failed to save to localStorage key: ${key}`, e);
    return false;
  }
}

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} - Success status
 */
export function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch(e) {
    console.warn(`Failed to remove from localStorage key: ${key}`, e);
    return false;
  }
}

/**
 * Clear all localStorage data
 * @returns {boolean} - Success status
 */
export function clear() {
  try {
    localStorage.clear();
    return true;
  } catch(e) {
    console.warn('Failed to clear localStorage', e);
    return false;
  }
}