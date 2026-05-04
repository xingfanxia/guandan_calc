/**
 * Trading Terminal — barrel.
 *
 * Phase 3 ships token + component-level restyle. The DOM is unchanged from
 * Broadcast / Linear; the visual language pivots to a Bloomberg / Reuters
 * console — JetBrains Mono everywhere, amber HUD on near-black, sharp
 * 1px borders, ASCII bracketing, grid background overlay.
 *
 * Phase 3.5 (2026-05-04) shipped the sparkline renderer at
 * src/themes/_shared/sparkline.js and flipped featureManifest.sparklines
 * to true — the stats-table now renders a 近况 (recent rank trajectory)
 * column under Trading. Other themes inherit the renderer behind the
 * feature flag (currently false elsewhere).
 */

import featureManifest from './featureManifest.js';

export const name = 'trading';
export const displayName = '终端 (Trading Terminal)';
export const description = '近黑底色 · 琥珀 HUD · JetBrains Mono · 1px 锐边 · ASCII 装饰';

/** Path to the theme stylesheet (loaded via <link> in HTML). */
export const stylesheet = '/src/themes/trading/theme.css';

export { featureManifest };

export const layout = {
  async mount(_rootEl, _ctx) {
    // Phase 3: token + component-level restyle only. Status-bar navigation and
    // sparkline rendering are deferred — current renderers are reused as-is.
  },
  async unmount(_rootEl) {
    // No-op
  },
  update() {
    // No-op — shared renderers handle updates.
  }
};
