/**
 * Rules Drawer Sync — render the compact rule-chip strip in the collapsed
 * <summary> of the custom-rules drawer.
 *
 * Demo (docs/design/demos/demo-broadcast-v3.html lines 688-697):
 *   c4: 3 - 2 - 1 · t6: 7 / 4 / 1 · p6: 5 - 4 - 3 - 3 - 1 - 0 · t8: 11 / 5 / 0 · flags: ...
 *
 * Updates whenever config changes (config:settingChanged event) so chips
 * always reflect current rule values.
 */

import { $ } from '../core/utils.js';
import { on as onEvent } from '../core/events.js';
import config from '../core/config.js';
import { normalizePlayerCountMode } from '../core/playerCountMode.js';

function currentMode() {
  const el = $('mode');
  return normalizePlayerCountMode(el ? el.value : 4);
}

function makeChip(keyText, valText) {
  const chip = document.createElement('span');
  chip.className = 'rule-chip';

  const key = document.createElement('span');
  key.className = 'rule-chip__key';
  key.textContent = keyText;
  chip.appendChild(key);

  const val = document.createElement('span');
  val.className = 'rule-chip__val';
  val.textContent = valText;
  chip.appendChild(val);

  return chip;
}

/**
 * Render only the chips relevant to the current player-count mode, plus flags.
 * 4-player: c4 (combination table) + flags
 * 6-player: t6 (thresholds) + p6 (points) + flags
 * 8-player: t8 (thresholds) + p8 (points) + flags
 */
export function renderRulesDrawerChips() {
  const target = $('rulesDrawerChips');
  if (!target) return;

  const mode = currentMode();
  target.replaceChildren();

  if (!mode) {
    target.appendChild(makeChip('mode:', '无效'));
    target.appendChild(makeChip('rules:', '请重新选择模式'));
    return;
  }

  if (mode === 4) {
    const c4 = config.get4PlayerRules();
    target.appendChild(makeChip('c4:', `${c4['1,2']} - ${c4['1,3']} - ${c4['1,4']}`));
  } else if (mode === 6) {
    const six = config.get6PlayerRules();
    target.appendChild(makeChip('t6:', `${six.thresholds.g3} / ${six.thresholds.g2} / ${six.thresholds.g1}`));
    target.appendChild(makeChip('p6:', [1, 2, 3, 4, 5, 6].map(r => six.points[r]).join(' - ')));
  } else {
    const eight = config.get8PlayerRules();
    target.appendChild(makeChip('t8:', `${eight.thresholds.g3} / ${eight.thresholds.g2} / ${eight.thresholds.g1}`));
    target.appendChild(makeChip('p8:', [1, 2, 3, 4, 5, 6, 7, 8].map(r => eight.points[r]).join(' - ')));
  }

  // Active automation flags (always shown, regardless of mode)
  const flags = [];
  if (config.getPreference('autoApply')) flags.push('autoApply');
  if (config.getPreference('autoNext')) flags.push('autoNext');
  if (config.getPreference('strictA')) flags.push('strictA');
  if (config.getPreference('must1')) flags.push('must1');
  target.appendChild(makeChip('flags:', flags.length ? flags.join(' · ') : '默认'));

  // Mode-context chip (which mode's rules are showing)
  const modeChip = makeChip('mode:', `${mode}人`);
  target.insertBefore(modeChip, target.firstChild);
}

export function initRulesDrawerSync() {
  renderRulesDrawerChips();
  onEvent('config:settingChanged', renderRulesDrawerChips);
  onEvent('config:rulesUpdated', renderRulesDrawerChips);
  onEvent('config:preferenceChanged', renderRulesDrawerChips);
  onEvent('config:preferencesChanged', renderRulesDrawerChips);
  onEvent('ui:modeChanged', renderRulesDrawerChips);

  // Native change listener as fallback when the harness sets mode before controllers wire up
  const modeEl = document.getElementById('mode');
  if (modeEl) modeEl.addEventListener('change', renderRulesDrawerChips);
}
