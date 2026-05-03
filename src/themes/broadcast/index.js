/**
 * Broadcast Editorial — barrel.
 *
 * Future Phase 1.5 PR adds a `layout` export with mount/unmount/update
 * functions per docs/design/THEME-ARCHITECTURE.md Section 3. For now we
 * only export the manifest; the existing index.html DOM serves as the
 * Broadcast layout until the restructure lands.
 */

import featureManifest from './featureManifest.js';

export const name = 'broadcast';
export const displayName = 'A · 广播 (Broadcast Editorial)';
export const description = '编辑型暗色 · 编辑级标题、酒红与琥珀强调色、Fraunces 衬线';

/** Path to the theme stylesheet (loaded via <link> in HTML for now). */
export const stylesheet = '/src/themes/broadcast/theme.css';

export { featureManifest };

/**
 * Layout placeholder. The Phase 1.5 PR will replace this with a real mount
 * function that builds the DOM scaffold per the demo. Until then, calling
 * mount() is a no-op confirming the active document is the Broadcast layout.
 */
export const layout = {
  async mount(_rootEl, _ctx) {
    // No-op: index.html DOM is the Broadcast layout until Phase 1.5.
  },
  async unmount(_rootEl) {
    // No-op: nothing to tear down.
  },
  update() {
    // No-op: the existing app's render functions handle updates.
  },
};
