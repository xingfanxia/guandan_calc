/**
 * Theme bootstrap — sets `data-theme` on <html> from localStorage before any
 * stylesheet computes layout. Inlined into every entry HTML so there's no
 * FOUC when navigating between pages.
 *
 * Loaded as a module from each page's <head>. Keeps logic in one place even
 * though it runs on multiple pages.
 */

const STORAGE_KEY = 'gd_v9_theme';
const VALID = new Set(['broadcast', 'linear', 'trading', 'atelier']);

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && VALID.has(saved)) {
    document.documentElement.setAttribute('data-theme', saved);
  }
} catch (_) {
  // localStorage may throw in private mode — ignore, fall through to whatever
  // data-theme was hardcoded on <html>.
}
