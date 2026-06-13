/**
 * Theme toggle — light/dark switcher (replaces the 2026-05 multi-theme
 * themeManager + ThemePicker, removed 2026-06-12 per DESIGN.md).
 *
 * - Persists to localStorage `gd_v9_theme` with values 'light' | 'dark'.
 *   (Same key as the old 5-theme system; old values are invalid and fall
 *   back to the system preference — handled by the inline bootstrap in
 *   each entry HTML before stylesheets load.)
 * - Sets `data-theme` on <html>; tokens.css keys dark values off
 *   `:root[data-theme="dark"]`.
 * - Emits 'theme:changed' on the shared event bus for live consumers.
 */

import { emit } from '../core/events.js';

export const STORAGE_KEY = 'gd_v9_theme';
const VALID = new Set(['light', 'dark']);

export function getActiveTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

export function applyTheme(name) {
  const theme = VALID.has(name) ? name : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / quota — theme still applies for the session.
  }
  emit('theme:changed', { theme });
  return theme;
}

export function toggleTheme() {
  return applyTheme(getActiveTheme() === 'dark' ? 'light' : 'dark');
}

/**
 * Mount the toggle button into a host element (topnav slot on every page).
 * Renders a single 44px touch-target button showing the mode it switches TO.
 */
export function mountThemeToggle(host) {
  if (!host) return null;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-toggle';

  const syncLabel = () => {
    const dark = getActiveTheme() === 'dark';
    btn.textContent = dark ? '☀️' : '🌙';
    btn.title = dark ? '切到浅色' : '切到深色';
    btn.setAttribute('aria-label', btn.title);
  };

  btn.addEventListener('click', () => {
    toggleTheme();
    syncLabel();
  });

  syncLabel();
  host.replaceChildren(btn);
  return btn;
}
