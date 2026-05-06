/**
 * Tea-Table Console — barrel.
 *
 * Phase 5 (2026-05-06). Contemplative scholar's-table theme — deep
 * warm graphite oklch surfaces with vermillion seal accent at hue 25°,
 * Noto Serif SC as display font (300/400/500/700) and Noto Sans SC as
 * body, italic captions in Serif. The aesthetic is a tea-house at dusk:
 * warm low-key lighting, ink-brush portraits as real assets (not CSS
 * placeholders), red-ink seals where other themes use color blocks,
 * generous letter-spacing for the editorial Chinese typography rhythm.
 *
 * Demo source: docs/design/demos/demo-teatable-v3.html (desktop) +
 * demo-teatable-mobile-v2.html (390px). CSS-only restyle (no DOM
 * mutation in mount/unmount); the theme's distinctive feature is the
 * ink portraits which the honors renderer reads via the feature
 * manifest's `honorPortraits: 'photo'` flag.
 */

import featureManifest from './featureManifest.js';

export const name = 'teatable';
export const displayName = '茶席 (Tea-Table)';
export const description = '暖石墨底色 · 朱砂印章强调 · 思源宋体 · 茶席沉静气质';

/** Path to the theme stylesheet (loaded via <link> in HTML). */
export const stylesheet = '/src/themes/teatable/theme.css';

export { featureManifest };

export const layout = {
  async mount(_rootEl, _ctx) {
    // Phase 5: token + component-level restyle only — no DOM mutation.
    // Honor portrait assets are referenced by the honors renderer when it
    // reads featureManifest.honorPortraits === 'photo'.
  },
  async unmount(_rootEl) {
    // No-op
  },
  update() {
    // No-op — shared renderers handle updates.
  }
};
