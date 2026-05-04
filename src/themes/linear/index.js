/**
 * Linear / Vercel Console — barrel.
 *
 * Phase 2 ships the palette + density-first restyle of every shared
 * component. Phase 2.5 will add the sidebar layout via mount/unmount.
 */

import featureManifest from './featureManifest.js';

export const name = 'linear';
export const displayName = '控制台 (Linear / Vercel)';
export const description = '深邃中性背景 · 单一 Linear 紫强调色 · Geist 字族 · 密度优先';

/** Path to the theme stylesheet (loaded via <link> in HTML). */
export const stylesheet = '/src/themes/linear/theme.css';

export { featureManifest };

export const layout = {
  async mount(_rootEl, _ctx) {
    // Phase 2: token+component-level restyle only. Sidebar mount lands in Phase 2.5.
  },
  async unmount(_rootEl) {
    // No-op
  },
  update() {
    // No-op — shared renderers handle updates.
  }
};
