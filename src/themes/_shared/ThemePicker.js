/**
 * Theme picker — settings-drawer UI for selecting the active theme.
 *
 * Phase 1: single theme (Broadcast). The picker renders a status row plus
 * a placeholder for future themes. Phase 2+ replaces the placeholder with
 * a real radio-group of registered themes that calls themeManager.switchTo().
 *
 * All DOM is built with createElement + textContent (no innerHTML) so the
 * picker can never become an XSS vector even if a theme registers a malicious
 * name string.
 */

import { listThemes, getCurrent, switchTo, STORAGE_KEY } from './themeManager.js';
import { on as onEvent } from '../../core/events.js';

const PICKER_ID = 'themePicker';

// Held across mountPicker() calls so we can release the prior subscription
// before installing a fresh one — prevents listener accumulation if a future
// surface (settings drawer reopen, host/viewer swap) re-mounts the picker.
let unsubscribeChanged = null;

/**
 * Mount the picker into a container element. Idempotent — calling twice
 * removes the prior render, releases the prior theme:changed listener,
 * and re-attaches both fresh.
 */
export function mountPicker(containerEl) {
  if (!containerEl) return;

  if (unsubscribeChanged) {
    unsubscribeChanged();
    unsubscribeChanged = null;
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

/** Replace `wrapper`'s children with a fresh tree. */
function render(wrapper) {
  while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);

  const all = listThemes();
  const active = getCurrent()?.name ?? null;

  const head = document.createElement('div');
  head.className = 'theme-picker__head';
  const label = document.createElement('span');
  label.className = 'theme-picker__label';
  label.textContent = '主题 Theme';
  head.appendChild(label);

  if (all.length <= 1) {
    const activeBadge = document.createElement('span');
    activeBadge.className = 'theme-picker__active';
    activeBadge.textContent = activeDisplay(all, active);
    head.appendChild(activeBadge);
    wrapper.appendChild(head);

    const hint = document.createElement('div');
    hint.className = 'theme-picker__hint muted small';
    hint.textContent = '更多主题（Linear · Trading · Atelier · Tea-Table）即将上线';
    wrapper.appendChild(hint);
    return;
  }

  wrapper.appendChild(head);

  const group = document.createElement('div');
  group.className = 'theme-picker__group';
  for (const t of all) {
    group.appendChild(buildRadio(t, active));
  }
  wrapper.appendChild(group);
}

function buildRadio(theme, activeName) {
  const label = document.createElement('label');
  label.className = 'theme-picker__opt';

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'theme';
  radio.value = theme.name;
  if (theme.name === activeName) radio.checked = true;

  radio.addEventListener('change', e => {
    const next = e.target.value;
    if (!next) return;
    Promise.resolve(switchTo(next)).catch(err => {
      console.error('[theme-picker] switch failed:', err);
    });
  });

  const name = document.createElement('span');
  name.className = 'theme-picker__opt-name';
  name.textContent = theme.displayName;

  label.appendChild(radio);
  label.appendChild(name);
  return label;
}

function activeDisplay(all, activeName) {
  const match = all.find(t => t.name === activeName);
  if (match) return match.displayName;
  return activeName ?? '未挂载';
}

export { STORAGE_KEY };
