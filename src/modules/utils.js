/**
 * Utility functions for the Guandan Calculator
 */

/**
 * Get element by ID shorthand
 * @param {string} id - Element ID
 * @returns {HTMLElement} DOM element
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Add event listener with compatibility
 * @param {HTMLElement} el - Target element
 * @param {string} ev - Event name
 * @param {Function} fn - Handler function
 */
export function on(el, ev, fn) {
  if (el.addEventListener) {
    el.addEventListener(ev, fn);
  } else {
    el.attachEvent('on' + ev, fn);
  }
}

/**
 * Get current timestamp as locale string
 * @returns {string} Formatted timestamp
 */
export function now() {
  return new Date().toLocaleString();
}

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color string
 * @returns {Object} RGB values
 */
export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return {
    r: parseInt(h.substr(0, 2), 16),
    g: parseInt(h.substr(2, 2), 16),
    b: parseInt(h.substr(4, 2), 16)
  };
}

/**
 * Convert hex color to RGBA string
 * @param {string} hex - Hex color string
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

/**
 * Calculate sum of array
 * @param {number[]} arr - Array of numbers
 * @returns {number} Sum
 */
export function sum(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s += arr[i];
  }
  return s;
}

/**
 * Calculate score sum using mapping
 * @param {number[]} ranks - Array of ranks
 * @param {Object} map - Score mapping
 * @returns {number} Total score
 */
export function scoreSum(ranks, map) {
  let s = 0;
  for (let i = 0; i < ranks.length; i++) {
    s += (map[ranks[i]] || 0);
  }
  return s;
}

/**
 * Escape value for CSV export
 * @param {*} value - Value to escape
 * @returns {string} Escaped CSV value
 */
export function csvEscape(value) {
  let s = String(value).replace(/"/g, '""');
  if (s.search(/[",\n]/) >= 0) {
    s = '"' + s + '"';
  }
  return s;
}

/**
 * Add ripple effect to element
 * @param {Event} event - Click event
 * @param {HTMLElement} element - Target element
 * @param {string} color - Ripple color
 */
export function addRipple(event, element, color) {
  const ripple = document.createElement('span');
  const rect = element.getBoundingClientRect();
  const diameter = Math.max(rect.width, rect.height) * 1.4;
  
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = diameter + 'px';
  ripple.style.left = (event.clientX - rect.left - diameter / 2) + 'px';
  ripple.style.top = (event.clientY - rect.top - diameter / 2) + 'px';
  ripple.style.background = rgba(color, 0.35);
  
  element.appendChild(ripple);
  
  setTimeout(() => {
    if (ripple.parentNode) {
      ripple.parentNode.removeChild(ripple);
    }
  }, 650);
}