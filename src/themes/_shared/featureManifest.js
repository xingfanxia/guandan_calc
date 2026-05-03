/**
 * Feature manifest contract.
 *
 * Each theme exports a manifest declaring how it renders cross-cutting features.
 * Components read the active manifest to decide which renderer to use, so adding
 * a feature once (in shared logic) doesn't require touching every theme.
 *
 * Source of truth: docs/design/THEME-ARCHITECTURE.md Section 4.
 */

/**
 * @typedef {Object} FeatureManifest
 * @property {'top-tabs'|'top-status-bar'|'sidebar'|'bottom-only'|'minimal-top'} navigation
 * @property {'drag-drop'|'tap-select'|'both'} rankingInteraction
 * @property {'inline-hero'|'modal'|'sample-only'} victorySurface
 * @property {boolean} sparklines
 * @property {boolean} commandPalette
 * @property {'gradient'|'ink'|'photo'|'tagged'} honorPortraits
 * @property {'broadcast-cards'|'env-style'|'monospace'|'editorial'|'standard'} customRulesUI
 * @property {'editorial'|'monospace'|'italic'|'ascii'|'minimal'} liveCalcStrip
 */

/**
 * Default manifest — used as a fallback for any theme that doesn't override
 * a particular feature. Mirrors Broadcast's choices since Broadcast is the
 * default theme.
 *
 * @type {FeatureManifest}
 */
export const DEFAULT_MANIFEST = Object.freeze({
  navigation: 'top-tabs',
  rankingInteraction: 'drag-drop',
  victorySurface: 'inline-hero',
  sparklines: false,
  commandPalette: false,
  honorPortraits: 'gradient',
  customRulesUI: 'broadcast-cards',
  liveCalcStrip: 'editorial',
});

/**
 * Merge a theme's manifest with DEFAULT_MANIFEST so missing keys fall through
 * to defaults. Returns a frozen copy.
 */
export function resolveManifest(themeManifest = {}) {
  return Object.freeze({ ...DEFAULT_MANIFEST, ...themeManifest });
}
