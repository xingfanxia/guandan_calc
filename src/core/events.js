/**
 * Event System (Pub/Sub Pattern)
 * New module for loosely coupled communication between modules
 */

// Store event listeners
const listeners = {};

/**
 * Subscribe to an event
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function on(event, callback) {
  if (typeof callback !== 'function') {
    console.warn(`on(): callback for event "${event}" is not a function`);
    return () => {};
  }

  if (!listeners[event]) {
    listeners[event] = [];
  }

  listeners[event].push(callback);

  // Return unsubscribe function
  return () => off(event, callback);
}

/**
 * Unsubscribe from an event
 * @param {string} event - Event name
 * @param {Function} callback - Callback function to remove
 */
export function off(event, callback) {
  if (!listeners[event]) return;

  listeners[event] = listeners[event].filter(cb => cb !== callback);

  // Clean up empty arrays
  if (listeners[event].length === 0) {
    delete listeners[event];
  }
}

/**
 * Emit an event
 * @param {string} event - Event name
 * @param {*} data - Data to pass to listeners
 */
export function emit(event, data) {
  if (!listeners[event] || listeners[event].length === 0) {
    // Silently ignore events with no listeners
    return;
  }

  // Call all listeners with the data
  listeners[event].forEach(callback => {
    try {
      callback(data);
    } catch (error) {
      console.error(`Error in event listener for "${event}":`, error);
    }
  });
}

/**
 * Subscribe to an event once
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function once(event, callback) {
  const wrapper = (data) => {
    callback(data);
    off(event, wrapper);
  };

  return on(event, wrapper);
}

/**
 * Clear all listeners for an event (or all events if no event specified)
 * @param {string} [event] - Optional event name to clear
 */
export function clear(event) {
  if (event) {
    delete listeners[event];
  } else {
    // Clear all events
    Object.keys(listeners).forEach(key => {
      delete listeners[key];
    });
  }
}

/**
 * Get count of listeners for an event
 * @param {string} event - Event name
 * @returns {number} Number of listeners
 */
export function listenerCount(event) {
  return listeners[event] ? listeners[event].length : 0;
}

/**
 * Get all registered event names
 * @returns {string[]} Array of event names
 */
export function eventNames() {
  return Object.keys(listeners);
}
