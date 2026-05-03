/**
 * Token name contract — every theme provides values for these names.
 * Themes may opt out of any token (the unused --var simply isn't referenced).
 *
 * Source of truth for: docs/design/THEME-ARCHITECTURE.md Section 5
 *
 * Adding a new token? Update this list AND every active theme's theme.css.
 * Do NOT inline-hex hardcode color values in components — always reference the var.
 */

export const TOKEN_SPEC = Object.freeze({
  color: [
    'bg', 'bg-deep',
    'surface', 'surface-2', 'surface-3',
    'ink', 'ink-dim', 'ink-dimmer',
    'accent', 'accent-soft', 'accent-line', 'accent-glow',
    'team-red', 'team-red-soft', 'team-red-line',
    'team-blue', 'team-blue-soft', 'team-blue-line',
    'win', 'loss',
    'rule', 'rule-soft',
  ],
  font: ['display', 'body', 'mono'],
  scale: [1, 2, 3, 4, 5, 6, 7, 8],
  radius: ['none', 'sm', 'md', 'lg', 'xl'],
});

/**
 * Build a CSS custom-property name from category + key.
 * e.g. cssVar('color', 'bg') === '--bg'  (color tokens are unprefixed by convention)
 *      cssVar('scale', 4) === '--s4'
 *      cssVar('font', 'body') === '--font-body'
 */
export function cssVar(category, key) {
  switch (category) {
    case 'color':  return `--${key}`;
    case 'font':   return `--font-${key}`;
    case 'scale':  return `--s${key}`;
    case 'radius': return `--radius-${key}`;
    default: throw new Error(`Unknown token category: ${category}`);
  }
}

/**
 * Returns true if the active document has every required color token defined
 * with a non-empty computed value. Useful as a runtime contract check during
 * theme mount.
 */
export function verifyTokensPresent(rootEl = document.documentElement) {
  const styles = getComputedStyle(rootEl);
  const missing = [];
  for (const name of TOKEN_SPEC.color) {
    const v = styles.getPropertyValue(`--${name}`).trim();
    if (!v) missing.push(name);
  }
  return { ok: missing.length === 0, missing };
}
