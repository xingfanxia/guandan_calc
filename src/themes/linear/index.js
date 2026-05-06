/**
 * Linear / Vercel Console — barrel.
 *
 * Phase 2 ships the palette + density-first restyle of every shared component.
 * Phase 2.5 (2026-05-05) adds the sidebar layout via mount/unmount: the
 * existing `<nav class="topnav">` is moved into an `<aside class="linear-sidebar">`
 * wrapper at mount and restored to its original position at unmount. Move
 * (not clone) preserves all wired event listeners and the theme picker mount
 * point inside the topnav.
 */

import featureManifest from './featureManifest.js';

export const name = 'linear';
export const displayName = '控制台 (Linear / Vercel)';
export const description = '深邃中性背景 · 单一 Linear 紫强调色 · Geist 字族 · 密度优先';

/** Path to the theme stylesheet (loaded via <link> in HTML). */
export const stylesheet = '/src/themes/linear/theme.css';

export { featureManifest };

/**
 * Module-scope state for restoring the topnav to its original DOM position on
 * unmount. We move the live topnav node (not a clone) so existing event
 * listeners + the `#themePickerMount` slot stay wired across the swap.
 */
let mountedSidebar = null;
let topnavRef = null;
let topnavOriginalParent = null;
let topnavOriginalNextSibling = null;

const SIDEBAR_ACTIVE_CLASS = 'linear-sidebar-active';

export const layout = {
  /**
   * Mount: extract `.topnav` from its current parent, wrap it in
   * `<aside class="linear-sidebar">`, prepend the wrapper to `<body>`, and
   * activate the CSS hook on `<html>`. No-ops cleanly when no topnav exists
   * (e.g. an HTML page that never rendered one).
   */
  async mount(_rootEl, _ctx) {
    if (mountedSidebar) {
      // Already mounted (defensive: theme.mount called twice without unmount).
      return;
    }

    const topnav = document.querySelector('.topnav');
    if (!topnav) {
      // Page has no topnav — sidebar mount becomes a no-op. Active class
      // is intentionally NOT set so CSS layout offsets don't kick in.
      return;
    }

    // Capture restore-point before detaching.
    topnavRef = topnav;
    topnavOriginalParent = topnav.parentNode;
    topnavOriginalNextSibling = topnav.nextSibling;

    // Build sidebar wrapper and move topnav inside.
    const sidebar = document.createElement('aside');
    sidebar.className = 'linear-sidebar';
    sidebar.setAttribute('role', 'complementary');
    sidebar.setAttribute('aria-label', '侧栏导航');
    sidebar.appendChild(topnav);

    // Prepend wrapper so it precedes all other body children visually.
    document.body.insertBefore(sidebar, document.body.firstChild);

    // Activate CSS scope (hides default topnav-row layout, applies sidebar layout).
    document.documentElement.classList.add(SIDEBAR_ACTIVE_CLASS);

    mountedSidebar = sidebar;
  },

  /**
   * Unmount: deactivate the CSS hook, return the topnav to its original
   * parent at its original position, and remove the wrapper. Idempotent.
   */
  async unmount(_rootEl) {
    document.documentElement.classList.remove(SIDEBAR_ACTIVE_CLASS);

    if (topnavRef && topnavOriginalParent) {
      // Restore at original index. If the next-sibling is gone (rare — DOM
      // mutated by another module), fall back to appending.
      if (topnavOriginalNextSibling && topnavOriginalNextSibling.parentNode === topnavOriginalParent) {
        topnavOriginalParent.insertBefore(topnavRef, topnavOriginalNextSibling);
      } else {
        topnavOriginalParent.appendChild(topnavRef);
      }
    }

    if (mountedSidebar) {
      mountedSidebar.remove();
      mountedSidebar = null;
    }

    topnavRef = null;
    topnavOriginalParent = null;
    topnavOriginalNextSibling = null;
  },

  update() {
    // No-op — sidebar contents are the live topnav node, so any state
    // changes that re-render topnav (active link, picker dropdown) flow
    // through automatically without sidebar intervention.
  }
};
