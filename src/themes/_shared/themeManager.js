/**
 * Theme manager — orchestrates theme registration, mounting, and persistence.
 *
 * Multi-theme manager for registration, switching, and first-paint fallback
 * alignment. Phase 2 will wire state.getSnapshot() / state.restore() around
 * theme swaps (per docs/design/THEME-ARCHITECTURE.md Section 3).
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
 * Accepts either a module's named-export namespace (`import * as broadcast`)
 * or an `export default` shape — both unwrap to the same theme object.
 *
 * @param {object} theme  Module shape: `{ name, displayName, description?, stylesheet, featureManifest, layout? }`
 */
export function register(theme) {
  // Normalize: tolerate `export default { ... }` modules whose namespace
  // exposes the theme under `.default` rather than as named exports.
  const t = theme && theme.default && typeof theme.default === 'object' && typeof theme.default.name === 'string'
    ? theme.default
    : theme;
  if (!t || typeof t.name !== 'string') {
    throw new Error('themeManager.register: theme must have a string `name`');
  }
  themes.set(t.name, t);
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
export function resolveBootTheme(defaultName = 'linear') {
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
 * Mount a theme. The theme's stylesheet is loaded via a static <link> in the
 * HTML for the single-theme phase; this function sets the data-theme attribute,
 * unmounts the prior theme's layout (if any), mounts the new layout, and emits
 * `theme:changed`.
 *
 * Async by contract: a theme's `layout.mount()` may need to await stylesheet
 * readiness (e.g. `link.onload` for dynamically injected CSS) so downstream
 * `getComputedStyle` / `verifyTokensPresent` reads from a fully-resolved
 * cascade. Themes whose layouts are no-ops await immediately.
 *
 * **Unmount-before-mount invariant**: any DOM injected by the previous theme's
 * `layout.mount()` (e.g. Linear's sidebar) MUST be removed before swapping —
 * otherwise theme switches leak ghost elements from prior themes.
 */
export async function mount(themeName) {
  const theme = themes.get(themeName);
  if (!theme) {
    throw new Error(`themeManager.mount: unknown theme "${themeName}"`);
  }

  const rootEl = document.getElementById('app') || document.body;

  // Unmount the previous theme's layout (if any) before swapping. Without
  // this, themes that inject DOM in mount() leave orphans on switch.
  if (current?.layout?.unmount) {
    await current.layout.unmount(rootEl);
  }

  // Activate the theme's CSS scope.
  document.documentElement.dataset.theme = theme.name;

  // Allow the theme to do any extra mounting work.
  if (theme.layout?.mount) {
    await theme.layout.mount(rootEl, {
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
