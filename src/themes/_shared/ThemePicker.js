/**
 * Theme picker — compact navbar dropdown.
 *
 * Renders as a `<details>`/`<summary>` dropdown so it works without JS for
 * the open/close mechanics. The summary shows the active theme's display
 * name + a caret. Clicking it opens a panel positioned absolutely below
 * with one row per registered theme. Selecting a row calls
 * `themeManager.switchTo()` and closes the dropdown.
 *
 * All DOM is built with createElement + textContent (no innerHTML) so the
 * picker can never become an XSS vector even if a theme registers a malicious
 * name string.
 *
 * The `theme:changed` event re-renders the trigger label so the visible
 * "active theme" stays in sync if a switch is initiated elsewhere.
 *
 * Outside-click handler closes the panel when the user taps anywhere outside
 * the dropdown — `<details>` doesn't auto-close on blur. Both listeners are
 * tracked at module scope so re-mounts (or future host/viewer surface swaps)
 * don't accumulate listeners.
 */

import { listThemes, getCurrent, switchTo, STORAGE_KEY } from './themeManager.js';
import { on as onEvent } from '../../core/events.js';

const PICKER_ID = 'themePicker';

let unsubscribeChanged = null;
let outsideClickHandler = null;

/**
 * Mount the picker into a container element. Idempotent — calling twice
 * removes the prior render, releases prior listeners, and re-attaches fresh.
 */
export function mountPicker(containerEl) {
  if (!containerEl) return;

  if (unsubscribeChanged) {
    unsubscribeChanged();
    unsubscribeChanged = null;
  }
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }

  const existing = containerEl.querySelector(`#${PICKER_ID}`);
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.id = PICKER_ID;
  wrapper.className = 'theme-picker';
  render(wrapper);
  containerEl.appendChild(wrapper);

  // Re-render whenever the active theme changes (via switchTo elsewhere).
  unsubscribeChanged = onEvent('theme:changed', () => render(wrapper));
}

function render(wrapper) {
  while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);

  const all = listThemes();
  const active = getCurrent()?.name ?? null;
  const activeMatch = all.find(t => t.name === active);

  // Phase-0 fallback — single theme registered → show the name as plain text,
  // no dropdown affordance.
  if (all.length <= 1) {
    const solo = document.createElement('span');
    solo.className = 'theme-picker__solo';
    solo.textContent = activeMatch?.displayName ?? '主题';
    wrapper.appendChild(solo);
    return;
  }

  const details = document.createElement('details');
  details.className = 'theme-picker__dropdown';

  const summary = document.createElement('summary');
  summary.className = 'theme-picker__trigger';
  summary.setAttribute('aria-label', '选择主题');

  const triggerIcon = document.createElement('span');
  triggerIcon.className = 'theme-picker__trigger-icon';
  triggerIcon.textContent = '🎨';
  triggerIcon.setAttribute('aria-hidden', 'true');

  const triggerLabel = document.createElement('span');
  triggerLabel.className = 'theme-picker__trigger-label';
  triggerLabel.textContent = activeMatch?.displayName ?? '主题';

  const triggerCaret = document.createElement('span');
  triggerCaret.className = 'theme-picker__trigger-caret';
  triggerCaret.textContent = '▾';
  triggerCaret.setAttribute('aria-hidden', 'true');

  summary.appendChild(triggerIcon);
  summary.appendChild(triggerLabel);
  summary.appendChild(triggerCaret);
  details.appendChild(summary);

  const panel = document.createElement('div');
  panel.className = 'theme-picker__panel';
  panel.setAttribute('role', 'menu');

  for (const t of all) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'theme-picker__row';
    row.setAttribute('role', 'menuitem');
    if (t.name === active) {
      row.classList.add('theme-picker__row--active');
      row.setAttribute('aria-current', 'true');
    }

    const rowName = document.createElement('span');
    rowName.className = 'theme-picker__row-name';
    rowName.textContent = t.displayName;
    row.appendChild(rowName);

    if (t.name === active) {
      const check = document.createElement('span');
      check.className = 'theme-picker__row-check';
      check.textContent = '✓';
      check.setAttribute('aria-hidden', 'true');
      row.appendChild(check);
    }

    row.addEventListener('click', () => {
      details.open = false;
      Promise.resolve(switchTo(t.name)).catch(err => {
        console.error('[theme-picker] switch failed:', err);
      });
    });
    panel.appendChild(row);
  }
  details.appendChild(panel);
  wrapper.appendChild(details);

  // Outside-click handler — `<details>` doesn't auto-close on blur.
  outsideClickHandler = (e) => {
    if (details.open && !details.contains(e.target)) {
      details.open = false;
    }
  };
  document.addEventListener('click', outsideClickHandler);
}

export { STORAGE_KEY };
