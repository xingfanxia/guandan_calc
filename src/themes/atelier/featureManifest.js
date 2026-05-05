/**
 * Atelier Console — feature manifest.
 *
 * Editorial magazine aesthetic with warm graphite + clay accent, Fraunces
 * serif display, card-stock motifs (vintage paper textures inside dark
 * surfaces). Honor portraits use the demo's "ink" treatment — serif
 * captions over warm tinted plates. Live calc strip stays editorial
 * (italic Fraunces) to match the diary framing.
 *
 * Phase 4 ship — first theme that is editorial AND warm-toned (Broadcast
 * is editorial-cool, Linear is density-cool, Trading is mono-cold).
 */

/** @type {import('../_shared/featureManifest.js').FeatureManifest} */
export default Object.freeze({
  navigation: 'top-tabs',
  rankingInteraction: 'drag-drop',
  victorySurface: 'inline-hero',
  sparklines: false,
  commandPalette: false,
  honorPortraits: 'ink',
  customRulesUI: 'broadcast-cards',
  liveCalcStrip: 'editorial'
});
