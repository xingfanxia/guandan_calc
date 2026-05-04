/**
 * Linear / Vercel Console — feature manifest.
 *
 * Diverges from Broadcast in three ways: navigation is sidebar-shaped (still
 * top-tabs in DOM until Phase 2.5 adds a full sidebar layout), live calc
 * strip uses monospace not editorial, command palette is enabled.
 */

/** @type {import('../_shared/featureManifest.js').FeatureManifest} */
export default Object.freeze({
  navigation: 'top-tabs', // Phase 2.5 will wire a real sidebar layout
  rankingInteraction: 'drag-drop',
  victorySurface: 'inline-hero',
  sparklines: false,
  commandPalette: true,
  honorPortraits: 'tagged',
  customRulesUI: 'broadcast-cards',
  liveCalcStrip: 'monospace'
});
