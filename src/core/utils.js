/**
 * DOM Utility Functions
 * Extracted from app.js lines 5-15
 */

/**
 * Get DOM element by ID
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} DOM element or null
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Attach event listener to element
 * @param {HTMLElement} el - Target element
 * @param {string} ev - Event name
 * @param {Function} fn - Event handler function
 */
export function on(el, ev, fn) {
  if (!el) {
    console.warn('on(): Element is null or undefined');
    return;
  }

  if (el.addEventListener) {
    el.addEventListener(ev, fn);
  } else if (el.attachEvent) {
    // IE8 fallback (unlikely needed but preserved from original)
    el.attachEvent('on' + ev, fn);
  }
}

/**
 * Get current timestamp as localized string
 * @returns {string} Formatted date/time string
 */
export function now() {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}
