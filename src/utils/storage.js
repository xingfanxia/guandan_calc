/**
 * LocalStorage utility functions
 */

export function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
    return false;
  }
}

export function load(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return defaultValue;
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