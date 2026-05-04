/**
 * Trading Terminal — feature manifest.
 *
 * Bloomberg / Reuters terminal aesthetic. Every text surface is monospace,
 * the live-calc strip leans on tabular numerals, victory states render as a
 * sample reference block (not an inline hero). Sparklines shipped Phase 3.5
 * (2026-05-04) — wired into the stats-table 近况 column via the shared
 * SVG renderer at src/themes/_shared/sparkline.js.
 */

/** @type {import('../_shared/featureManifest.js').FeatureManifest} */
export default Object.freeze({
  navigation: 'top-status-bar',
  rankingInteraction: 'drag-drop',
  victorySurface: 'sample-only',
  sparklines: true,
  commandPalette: false,
  honorPortraits: 'tagged',
  customRulesUI: 'env-style',
  liveCalcStrip: 'monospace'
});
