/**
 * Tea-Table Console — feature manifest.
 *
 * Phase 5 ship — fifth registered theme. Contemplative scholar's-table
 * aesthetic with deep warm-graphite background, vermillion seal accent,
 * Noto Serif SC display + Noto Sans SC body. The unique-to-this-theme
 * affordance is real ink-brush honor portraits (gpt-image-2 generated,
 * stored under public/themes/teatable/honors/<honor-id>.jpg) — every
 * other theme renders honors with placeholder gradients or text labels.
 *
 * Demo source: docs/design/demos/demo-teatable-v3.html (desktop) +
 * demo-teatable-mobile-v2.html (390px). CSS-only restyle + asset
 * injection; DOM unchanged from the other 4 themes.
 */

/** @type {import('../_shared/featureManifest.js').FeatureManifest} */
export default Object.freeze({
  navigation: 'top-tabs',
  rankingInteraction: 'drag-drop',
  victorySurface: 'inline-hero',
  sparklines: false,
  commandPalette: false,
  honorPortraits: 'photo',  // real ink-brush JPG assets, not CSS gradient
  customRulesUI: 'editorial',
  liveCalcStrip: 'editorial'
});
