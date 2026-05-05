/**
 * Atelier Console — barrel.
 *
 * Phase 4 (2026-05-04). Editorial magazine theme — warm graphite oklch
 * surfaces with Anthropic-tan undertone, clay/caramel accent at hue 65°,
 * Fraunces serif as display font (300/400/500/700 + italic optical-size
 * variants), Inter as body, JetBrains Mono for tabular numerics. The
 * aesthetic is a craftsman's diary: gold thin rules between sections,
 * card-stock player tiles (cream paper bg over dark), italic Fraunces
 * captions, vintage-frame portrait treatment.
 *
 * Demo source: docs/design/demos/demo-atelier-v2.html (desktop) +
 * demo-atelier-mobile-v2.html (390px). CSS-only restyle; DOM unchanged
 * from Broadcast / Linear / Trading.
 */

import featureManifest from './featureManifest.js';

export const name = 'atelier';
export const displayName = '工坊 (Atelier Console)';
export const description = '暖灰底色 · 陶土橙强调 · Fraunces 衬线 · 编辑工坊气质';

/** Path to the theme stylesheet (loaded via <link> in HTML). */
export const stylesheet = '/src/themes/atelier/theme.css';

export { featureManifest };

export const layout = {
  async mount(_rootEl, _ctx) {
    // Phase 4: token + component-level restyle only — same DOM as siblings.
  },
  async unmount(_rootEl) {
    // No-op
  },
  update() {
    // No-op — shared renderers handle updates.
  }
};
