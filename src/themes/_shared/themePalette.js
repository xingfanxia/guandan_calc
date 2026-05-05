/**
 * Theme palette extractor — read the active theme's CSS custom properties
 * via getComputedStyle and return them as a flat object keyed by canonical
 * names, ready to drop into canvas `fillStyle` / `strokeStyle`.
 *
 * Why: PNG exports (`src/export/exportMobile.js`, `exportHandlers.js`) draw
 * to a detached canvas which doesn't inherit theme styling. Pre-2026-05-05
 * those exports hardcoded ~36 hex values that matched no theme's palette,
 * so a championship export under Atelier (clay accent + warm graphite) or
 * Linear (purple accent) looked identical to one under Broadcast (orange
 * accent on near-black) — the export was theme-deaf.
 *
 * Canvas color compatibility: modern browsers (Chrome 113+, Safari 15.4+,
 * Firefox 113+) accept oklch() directly in `fillStyle`/`strokeStyle`, so
 * values pass through verbatim. Fallbacks below match the historical
 * Broadcast palette so older browsers degrade to the prior look.
 */

import { cssVar } from './tokenSpec.js';

/**
 * Read the active theme's color tokens.
 *
 * @param {HTMLElement} [rootEl] — element on which the theme tokens are
 *   defined (defaults to `document.documentElement`, where `data-theme`
 *   is set by the theme manager).
 * @returns {{
 *   bg: string, bgDeep: string, surface: string,
 *   ink: string, inkDim: string, inkDimmer: string,
 *   accent: string, accentSoft: string,
 *   rule: string, win: string, loss: string,
 *   teamRed: string, teamBlue: string,
 * }}
 */
export function getActiveThemePalette(rootEl = document.documentElement) {
  const styles = getComputedStyle(rootEl);
  const get = (token, fallback) => {
    const v = styles.getPropertyValue(cssVar('color', token)).trim();
    return v || fallback;
  };
  return {
    bg:        get('bg',         '#0b0b0c'),
    bgDeep:    get('bg-deep',    '#08080a'),
    surface:   get('surface',    '#16171a'),
    ink:       get('ink',        '#f5f6f8'),
    inkDim:    get('ink-dim',    '#b4b8bf'),
    inkDimmer: get('ink-dimmer', '#888888'),
    accent:    get('accent',     '#fbbf24'),
    accentSoft: get('accent-soft', '#fcd34d'),
    rule:      get('rule',       '#444444'),
    win:       get('win',        '#10b981'),
    loss:      get('loss',       '#dc2626'),
    teamRed:   get('team-red',   '#ef4444'),
    teamBlue:  get('team-blue',  '#3b82f6'),
  };
}
