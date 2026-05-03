/**
 * Broadcast Editorial — feature manifest.
 *
 * The default manifest already mirrors Broadcast's choices (since Broadcast is
 * the default theme), but we still export an explicit object so future edits
 * can diverge from defaults without surprising other themes.
 */

/** @type {import('../_shared/featureManifest.js').FeatureManifest} */
export default Object.freeze({
  navigation: 'top-tabs',
  rankingInteraction: 'drag-drop',
  victorySurface: 'inline-hero',
  sparklines: false,
  commandPalette: false,
  honorPortraits: 'gradient',
  customRulesUI: 'broadcast-cards',
  liveCalcStrip: 'editorial',
});
