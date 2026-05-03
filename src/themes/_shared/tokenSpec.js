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
  // Scale keys are stored as strings so all token categories share one type
  // (tokenSpec consumers can iterate without type-juggling).
  scale: ['1', '2', '3', '4', '5', '6', '7', '8'],
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
 * Returns true if the active document has every token across every category
 * defined with a non-empty computed value. Useful as a runtime contract
 * check during theme mount — catches a theme that declared the palette
 * but forgot, e.g., `--font-body` or `--s4`.
 */
export function verifyTokensPresent(rootEl = document.documentElement) {
  const styles = getComputedStyle(rootEl);
  const missing = [];
  for (const category of ['color', 'font', 'scale', 'radius']) {
    for (const key of TOKEN_SPEC[category]) {
      const name = cssVar(category, key);
      const v = styles.getPropertyValue(name).trim();
      if (!v) missing.push(`${category}/${key}`);
    }
  }
  return { ok: missing.length === 0, missing };
}
