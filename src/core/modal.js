/**
 * Modal accessibility helpers.
 *
 * Both player modals (create, edit) need the same a11y wiring: ARIA roles,
 * Escape-to-close, focus trap, body scroll lock, initial focus. Centralized
 * here so adding a third modal doesn't mean three places to update.
 *
 * Usage:
 *   const cleanup = setupModalAccessibility(modalElement, closeModal);
 *   // ... in closeModal:
 *   cleanup();
 */

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Wire ARIA, scroll lock, focus trap, Escape-to-close on a modal overlay.
 *
 * @param {HTMLElement} modalElement - The overlay element (already in DOM)
 * @param {Function} closeModal - Function that tears the modal down
 * @returns {Function} cleanup — caller MUST invoke this in closeModal so
 *   listeners and scroll lock don't outlive the modal
 */
export function setupModalAccessibility(modalElement, closeModal) {
  if (!modalElement) return () => {};

  // 1. ARIA — communicates "this is a modal dialog" to AT/keyboard users.
  modalElement.setAttribute('role', 'dialog');
  modalElement.setAttribute('aria-modal', 'true');

  // 2. Scroll lock — prevents the page underneath from scrolling on iOS Safari
  // (where backdrop tap fights with the URL bar) and keeps focus in the modal.
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // 3. Escape closes — listener on document so Escape works regardless of
  // where focus is (form fields, buttons, body itself).
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // 4. Focus trap — Tab and Shift+Tab cycle within the modal so keyboard
  // users can't accidentally tab into the now-inert page underneath.
  const trapHandler = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = modalElement.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  modalElement.addEventListener('keydown', trapHandler);

  // 5. Initial focus — defer one tick so the appendChild has settled.
  // Skip the search if no focusable element exists (e.g., modals with only
  // text content); the user can still Escape out.
  setTimeout(() => {
    const firstFocusable = modalElement.querySelector(FOCUSABLE_SELECTOR);
    if (firstFocusable && typeof firstFocusable.focus === 'function') {
      firstFocusable.focus();
    }
  }, 0);

  return function cleanup() {
    document.removeEventListener('keydown', escapeHandler);
    modalElement.removeEventListener('keydown', trapHandler);
    document.body.style.overflow = previousOverflow;
  };
}
