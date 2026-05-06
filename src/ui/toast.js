/**
 * Generic toast notification manager.
 *
 * Stack-based, theme-aware (consumes CSS tokens, no per-theme JS).
 * Top-right on desktop, top-center on mobile. Max 3 visible; overflow queues.
 * Auto-dismiss after `duration` ms (default 5000). Click anywhere on the toast
 * (or the close button) dismisses immediately.
 *
 * Markup contract — themes style these classes:
 *   .toast-stack
 *   .toast
 *   .toast--achievement
 *   .toast__badge
 *   .toast__body / .toast__title / .toast__name / .toast__desc
 *   .toast__close
 *   .toast--leaving (transient state during dismiss animation)
 *
 * XSS-safe by construction: all dynamic content goes through textContent;
 * no innerHTML, no template strings interpolating user data into HTML.
 */

const STACK_ID = 'toastStack';
const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 5000;
const LEAVE_DURATION = 280;

const queue = [];
let visibleCount = 0;

function getStack() {
  let stack = document.getElementById(STACK_ID);
  if (stack) return stack;
  stack = document.createElement('div');
  stack.id = STACK_ID;
  stack.className = 'toast-stack';
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('role', 'region');
  stack.setAttribute('aria-label', '通知');
  document.body.appendChild(stack);
  return stack;
}

function dismiss(el) {
  if (!el || !el.isConnected || el.classList.contains('toast--leaving')) return;
  el.classList.add('toast--leaving');
  setTimeout(() => {
    if (el.isConnected) el.remove();
    visibleCount = Math.max(0, visibleCount - 1);
    pump();
  }, LEAVE_DURATION);
}

function makeChild(parent, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null && text !== '') node.textContent = String(text);
  parent.appendChild(node);
  return node;
}

function render(opts) {
  const stack = getStack();
  const el = document.createElement('div');
  el.className = `toast toast--${opts.variant || 'default'}`;
  el.setAttribute('role', 'status');

  if (opts.badge) makeChild(el, 'div', 'toast__badge', opts.badge);

  const body = makeChild(el, 'div', 'toast__body', null);
  if (opts.title) makeChild(body, 'div', 'toast__title', opts.title);
  if (opts.name) makeChild(body, 'div', 'toast__name', opts.name);
  if (opts.desc) makeChild(body, 'div', 'toast__desc', opts.desc);

  const close = makeChild(el, 'button', 'toast__close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '关闭通知');

  el.addEventListener('click', () => dismiss(el));
  stack.appendChild(el);
  visibleCount += 1;

  const duration = typeof opts.duration === 'number' ? opts.duration : DEFAULT_DURATION;
  setTimeout(() => dismiss(el), duration);
}

function pump() {
  while (visibleCount < MAX_VISIBLE && queue.length > 0) {
    render(queue.shift());
  }
}

/**
 * Show a toast.
 * @param {Object} opts
 * @param {string} [opts.variant='default'] - CSS variant suffix (e.g. 'achievement')
 * @param {string} [opts.badge] - Single character/emoji shown in the leading badge slot
 * @param {string} [opts.title] - Eyebrow line above the main text
 * @param {string} [opts.name] - Primary text (largest)
 * @param {string} [opts.desc] - Secondary descriptive line
 * @param {number} [opts.duration=5000] - ms before auto-dismiss
 */
export function showToast(opts) {
  if (!opts || typeof opts !== 'object') return;
  if (visibleCount < MAX_VISIBLE) {
    render(opts);
  } else {
    queue.push(opts);
  }
}

/**
 * Drop all toasts immediately. Used by tests and theme switches that
 * relayout the page; production code rarely calls this directly.
 */
export function clearToasts() {
  const stack = document.getElementById(STACK_ID);
  if (stack) {
    while (stack.firstChild) stack.removeChild(stack.firstChild);
  }
  queue.length = 0;
  visibleCount = 0;
}
