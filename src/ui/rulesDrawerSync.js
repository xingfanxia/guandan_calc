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

export function renderRulesDrawerChips() {
  const target = $('rulesDrawerChips');
  if (!target) return;

  const c4 = config.get4PlayerRules();
  const six = config.get6PlayerRules();
  const eight = config.get8PlayerRules();

  // Compose values
  const c4Val = `${c4['1,2']} - ${c4['1,3']} - ${c4['1,4']}`;
  const t6Val = `${six.thresholds.g3} / ${six.thresholds.g2} / ${six.thresholds.g1}`;
  const p6Val = [1, 2, 3, 4, 5, 6].map(r => six.points[r]).join(' - ');
  const t8Val = `${eight.thresholds.g3} / ${eight.thresholds.g2} / ${eight.thresholds.g1}`;

  // Active automation flags
  const flags = [];
  if (config.getPreference('autoApply')) flags.push('autoApply');
  if (config.getPreference('autoNext')) flags.push('autoNext');
  if (config.getPreference('strictA')) flags.push('strictA');
  if (config.getPreference('must1')) flags.push('must1');
  const flagsVal = flags.length ? flags.join(' · ') : '默认';

  target.replaceChildren();
  target.appendChild(makeChip('c4:', c4Val));
  target.appendChild(makeChip('t6:', t6Val));
  target.appendChild(makeChip('p6:', p6Val));
  target.appendChild(makeChip('t8:', t8Val));
  target.appendChild(makeChip('flags:', flagsVal));
}

export function initRulesDrawerSync() {
  renderRulesDrawerChips();
  onEvent('config:settingChanged', renderRulesDrawerChips);
  onEvent('config:rulesUpdated', renderRulesDrawerChips);
  onEvent('config:preferenceChanged', renderRulesDrawerChips);
  onEvent('config:preferencesChanged', renderRulesDrawerChips);
}
