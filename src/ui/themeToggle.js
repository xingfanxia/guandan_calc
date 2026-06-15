/**
 * Theme toggle — tri-state auto / light / dark (ported from the wxapp
 * core/theme.js, 2026-06-15). Replaces the binary light/dark switcher.
 *
 * - Persists the PREFERENCE to localStorage `gd_v9_theme`: 'auto' | 'light' | 'dark'.
 *   'auto' follows the OS (prefers-color-scheme) live. 'light'/'dark' are
 *   explicit overrides. Anything else (legacy 5-theme names, no value) resolves
 *   to 'auto'. The inline bootstrap in each entry HTML applies the same
 *   resolution before stylesheets load — keep the two in sync.
 * - `data-theme` on <html> is ALWAYS the EFFECTIVE mode ('light' | 'dark'), so
 *   tokens.css (keyed on :root[data-theme="dark"]) needs no change.
 * - In 'auto' mode a matchMedia listener re-applies on OS theme change, so the
 *   page — and the canvas/chart consumers listening on 'theme:changed' — track
 *   the system live without a reload.
 * - Emits 'theme:changed' { theme, pref } on the shared event bus.
 */

import { emit, on } from '../core/events.js';

export const STORAGE_KEY = 'gd_v9_theme';
const PREFS = ['auto', 'light', 'dark'];
// Cycle order for the single toggle button: 跟随系统 → 浅色 → 深色 → 跟随系统.
const NEXT_PREF = { auto: 'light', light: 'dark', dark: 'auto' };
const PREF_META = {
  auto: { icon: '🌗', label: '跟随系统' },
  light: { icon: '☀️', label: '浅色' },
  dark: { icon: '🌙', label: '深色' }
};

let mediaListenerBound = false;

export function systemTheme() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

export function getThemePref() {
  let value = null;
  try {
    value = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode — no stored pref; fall through to default.
  }
  return PREFS.includes(value) ? value : 'auto';
}

/** Preference → the light/dark actually rendered ('auto' resolves to the OS). */
export function effectiveTheme(pref = getThemePref()) {
  return pref === 'auto' ? systemTheme() : pref;
}

/** The light/dark currently on <html> (back-compat shape for live consumers). */
export function getActiveTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// In 'auto', re-apply data-theme on OS theme change so the page + canvas
// consumers (themePalette / chartPalette) track the system without a reload.
function ensureMediaListener() {
  if (mediaListenerBound) return;
  try {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getThemePref() !== 'auto') return;
      const eff = systemTheme();
      document.documentElement.setAttribute('data-theme', eff);
      emit('theme:changed', { theme: eff, pref: 'auto' });
    };
    // addEventListener is the modern API; addListener covers Safari < 14.
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
    mediaListenerBound = true;
  } catch {
    // matchMedia unavailable — 'auto' falls back to a one-time static resolve.
  }
}

/**
 * Apply a PREFERENCE (auto/light/dark): persist it, set data-theme to the
 * resolved light/dark, and emit 'theme:changed'. Returns the pref applied.
 */
export function applyTheme(pref) {
  const nextPref = PREFS.includes(pref) ? pref : 'auto';
  const eff = effectiveTheme(nextPref);
  document.documentElement.setAttribute('data-theme', eff);
  try {
    localStorage.setItem(STORAGE_KEY, nextPref);
  } catch {
    // Private mode / quota — applies for this session only.
  }
  ensureMediaListener();
  emit('theme:changed', { theme: eff, pref: nextPref });
  return nextPref;
}

/** Advance the preference one step around the cycle. Returns the new pref. */
export function cycleTheme() {
  return applyTheme(NEXT_PREF[getThemePref()] || 'auto');
}

/**
 * Mount the toggle button into a host element (topnav slot on every page).
 * One 44px touch-target button cycling 跟随系统 → 浅色 → 深色; the icon shows the
 * CURRENT preference (🌗 auto / ☀️ light / 🌙 dark).
 */
export function mountThemeToggle(host) {
  if (!host) return null;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-toggle';

  const syncLabel = () => {
    const pref = getThemePref();
    const meta = PREF_META[pref] || PREF_META.auto;
    btn.textContent = meta.icon;
    const title = pref === 'auto'
      ? `外观：跟随系统（当前${effectiveTheme('auto') === 'dark' ? '深色' : '浅色'}）`
      : `外观：${meta.label}`;
    btn.title = title;
    btn.setAttribute('aria-label', title);
  };

  btn.addEventListener('click', cycleTheme);

  // Bind the OS listener now (not just on first click) so 'auto' tracks live.
  // Keep the button label in sync via the shared bus — 'theme:changed' fires on
  // both cycleTheme clicks AND the matchMedia re-apply under 'auto', so a single
  // subscription covers both (no separate matchMedia listener to leak).
  ensureMediaListener();
  on('theme:changed', syncLabel);

  syncLabel();
  host.replaceChildren(btn);
  return btn;
}
