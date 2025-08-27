// DOM utility functions
// UTF-8 encoding for Chinese characters

/**
 * Get element by ID
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Add event listener with fallback for older browsers
 * @param {HTMLElement} el - Element
 * @param {string} ev - Event name
 * @param {Function} fn - Event handler
 */
export function on(el, ev, fn) {
  el.addEventListener ? el.addEventListener(ev, fn) : el.attachEvent('on' + ev, fn);
}

/**
 * Get current timestamp
 * @returns {string} - Formatted timestamp
 */
export function now() {
  return new Date().toLocaleString();
}

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color string
 * @returns {Object} RGB color object
 */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const expandedHex = h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h;
  return {
    r: parseInt(expandedHex.substr(0,2), 16),
    g: parseInt(expandedHex.substr(2,2), 16),
    b: parseInt(expandedHex.substr(4,2), 16)
  };
}

/**
 * Create RGBA color string
 * @param {string} hex - Hex color
 * @param {number} a - Alpha value
 * @returns {string} RGBA color string
 */
export function rgba(hex, a) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

/**
 * Add ripple effect to element
 * @param {Event} ev - Mouse event
 * @param {HTMLElement} el - Target element
 * @param {string} color - Ripple color
 */
export function addRipple(ev, el, color) {
  const r = document.createElement('span');
  const rect = el.getBoundingClientRect();
  const d = Math.max(rect.width, rect.height) * 1.4;
  
  r.className = 'ripple';
  r.style.width = r.style.height = d + 'px';
  r.style.left = (ev.clientX - rect.left - d/2) + 'px';
  r.style.top = (ev.clientY - rect.top - d/2) + 'px';
  r.style.background = rgba(color, 0.35);
  
  el.appendChild(r);
  setTimeout(() => {
    if (r.parentNode) r.parentNode.removeChild(r);
  }, 650);
}