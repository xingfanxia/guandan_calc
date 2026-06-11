/**
 * Setup-section visibility — hide setup-only sections once the game has begun.
 *
 * "Game has begun" = at least one entry in history OR any rank position placed
 * for the current round. While true, hide:
 *   - 多人房间 / Multiplayer card (#roomControls + preceding section-rule)
 *   - 游戏模式 / Game Mode (.modeselect + preceding section-rule)
 *   - 玩家设置 / Roster (#playerSetupSection + preceding section-rule)
 *
 * Reset/undo restores them. Section-rules are siblings of their content blocks
 * in the index.html structure, so we hide both the rule and the content as a
 * unit using `previousElementSibling`.
 */

import { $ } from '../core/utils.js';
import { on as onEvent } from '../core/events.js';
import state from '../core/state.js';

function gameHasBegun() {
  if (typeof state.getHistory === 'function' && state.getHistory().length > 0) return true;
  if (typeof state.getCurrentRanking === 'function') {
    const ranking = state.getCurrentRanking();
    for (const k in ranking) {
      if (ranking[k] != null) return true;
    }
  }
  return false;
}

function pairToggle(content, hidden) {
  if (!content) return;
  // Hide the content
  content.style.display = hidden ? 'none' : '';
  // Hide the preceding section-rule too (the divider with label)
  const rule = content.previousElementSibling;
  if (rule && rule.classList && rule.classList.contains('section-rule')) {
    rule.style.display = hidden ? 'none' : '';
  }
}

function applyVisibility() {
  const hidden = gameHasBegun();
  pairToggle($('roomControls'), hidden);
  // .modeselect is a class-only element — query it
  const modeselect = document.querySelector('.modeselect');
  pairToggle(modeselect, hidden);
  pairToggle($('playerSetupSection'), hidden);
}

export function initSetupVisibility() {
  applyVisibility();

  // Re-evaluate on any state change that could flip game-has-begun
  const watched = [
    'state:hydrated',
    'state:historyAdded',
    'state:historyRolledBack',
    'state:historyCleared',
    'state:historySet',
    'state:gameReset',
    'state:allReset',
    'ranking:positionSet',
    'ranking:positionCleared',
    'ranking:cleared',
    'ranking:randomized',
    'ranking:updated',
    'state:currentRankingChanged',
    'game:rollback',
    'game:reset'
  ];
  watched.forEach(evt => onEvent(evt, applyVisibility));
}
