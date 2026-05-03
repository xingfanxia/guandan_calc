/**
 * Theme manager — orchestrates theme registration, mounting, and persistence.
 *
 * Single-theme today (Broadcast); designed to support multi-theme switching
 * in Phase 2+. State preservation across switches is a no-op while only one
 * theme exists; Phase 2 will wire state.getSnapshot() / state.restore()
 * around the swap (per docs/design/THEME-ARCHITECTURE.md Section 3).
 */

import { emit } from '../../core/events.js';
import { verifyTokensPresent } from './tokenSpec.js';
import { resolveManifest } from './featureManifest.js';

/** localStorage key — matches the existing gd_v9_* convention. */
export const STORAGE_KEY = 'gd_v9_theme';

const themes = new Map();

/**
 * Register a theme so the manager can mount it later.
 *
 * @param {object} theme  Module shape: `{ name, displayName, description?, stylesheet, featureManifest, layout? }`
 */
export function register(theme) {
  if (!theme || typeof theme.name !== 'string') {
    throw new Error('themeManager.register: theme must have a string `name`');
  }
  themes.set(theme.name, theme);
}

/** All registered theme names, in registration order. */
export function listThemes() {
  return Array.from(themes.values()).map(t => ({
    name: t.name,
    displayName: t.displayName ?? t.name,
    description: t.description ?? '',
  }));
}

/** Returns the currently active theme module, or null before mount. */
let current = null;
export function getCurrent() { return current; }

/** Resolve which theme to mount on boot — localStorage > default. */
export function resolveBootTheme(defaultName = 'broadcast') {
  try {
    const saved = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null;
    if (saved && themes.has(saved)) return saved;
  } catch {
    // localStorage may throw in private mode / sandbox — fall through to default.
  }
  return defaultName;
}

/**
 * Mount a theme. The theme's stylesheet is already loaded via a static <link>
 * in the HTML for the single-theme phase; this function sets the data-theme
 * attribute and emits `theme:changed`. Future Phase 2+ adds dynamic CSS
 * loading and layout mount/unmount.
 */
export async function mount(themeName) {
  const theme = themes.get(themeName);
  if (!theme) {
    throw new Error(`themeManager.mount: unknown theme "${themeName}"`);
  }

  // Activate the theme's CSS scope.
  document.documentElement.dataset.theme = theme.name;

  // Allow the theme to do any extra mounting work (currently a no-op for Broadcast).
  if (theme.layout?.mount) {
    await theme.layout.mount(document.getElementById('app') || document.body, {
      featureManifest: resolveManifest(theme.featureManifest),
    });
  }

  current = theme;

  // Verify the token contract resolved — surface mismatches early.
  const check = verifyTokensPresent();
  if (!check.ok && typeof console !== 'undefined') {
    console.warn(`[theme] "${themeName}" missing tokens:`, check.missing);
  }

  // Persist + announce.
  try {
    localStorage.setItem(STORAGE_KEY, theme.name);
  } catch {
    // Ignore quota / private-mode failures — theme still works for the session.
  }
  emit('theme:changed', { theme: theme.name });
}

/**
 * Switch to a different theme at runtime. State preservation across the swap
 * lands in Phase 2 (today's no-op switch keeps state via the singleton).
 */
export async function switchTo(themeName) {
  if (current && current.name === themeName) return;
  await mount(themeName);
}

/** Read the active theme's resolved manifest. */
export function getManifest() {
  if (!current) return resolveManifest();
  return resolveManifest(current.featureManifest);
}
