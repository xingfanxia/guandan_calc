/**
 * Trading Terminal — feature manifest.
 *
 * Bloomberg / Reuters terminal aesthetic. Every text surface is monospace,
 * the live-calc strip leans on tabular numerals, victory states render as a
 * sample reference block (not an inline hero), and sparklines are flagged
 * for a future Phase 3.5 once the chart renderer ships.
 */

/** @type {import('../_shared/featureManifest.js').FeatureManifest} */
export default Object.freeze({
  navigation: 'top-status-bar',
  rankingInteraction: 'drag-drop',
  victorySurface: 'sample-only',
  sparklines: false,
  commandPalette: false,
  honorPortraits: 'tagged',
  customRulesUI: 'env-style',
  liveCalcStrip: 'monospace'
});
