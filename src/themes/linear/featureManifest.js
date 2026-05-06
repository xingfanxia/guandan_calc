/**
 * Linear / Vercel Console — feature manifest.
 *
 * Diverges from Broadcast in three ways: navigation is sidebar-shaped (real
 * sidebar layout shipped Phase 2.5 via `layout.mount/unmount`), live calc
 * strip uses monospace not editorial, command palette is enabled.
 */

/** @type {import('../_shared/featureManifest.js').FeatureManifest} */
export default Object.freeze({
  navigation: 'sidebar',
  rankingInteraction: 'drag-drop',
  victorySurface: 'inline-hero',
  sparklines: false,
  commandPalette: true,
  honorPortraits: 'tagged',
  customRulesUI: 'broadcast-cards',
  liveCalcStrip: 'monospace'
});
