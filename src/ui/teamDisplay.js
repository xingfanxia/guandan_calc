/**
 * Team Display - Team UI Utilities
 * Extracted from app.js lines 1342-1408, 1467-1475
 * Handles team styling and display
 */

import { $ } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return {
    r: parseInt(h.substr(0, 2), 16),
    g: parseInt(h.substr(2, 2), 16),
    b: parseInt(h.substr(4, 2), 16)
  };
}

/**
 * Convert hex to rgba
 */
export function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

/**
 * Apply team styles to UI elements
 */
export function applyTeamStyles() {
  const t1Chip = $('t1NameChip');
  const t2Chip = $('t2NameChip');
  const hT1 = $('hT1');
  const hT2 = $('hT2');

  const t1Config = config.getTeam('t1');
  const t2Config = config.getTeam('t2');

  if (t1Chip) {
    t1Chip.style.background = t1Config.color;
    t1Chip.style.color = '#fff';
    t1Chip.innerHTML = `<b>${t1Config.name}</b>`;
  }

  if (t2Chip) {
    t2Chip.style.background = t2Config.color;
    t2Chip.style.color = '#fff';
    t2Chip.innerHTML = `<b>${t2Config.name}</b>`;
  }

  if (hT1) hT1.textContent = t1Config.name;
  if (hT2) hT2.textContent = t2Config.name;

  // Update winner display if set
  const winnerDisplay = $('winnerDisplay');
  if (winnerDisplay) {
    const winner = state.getWinner();
    const winnerName = winner === 't1' ? t1Config.name : t2Config.name;
    const winnerColor = winner === 't1' ? t1Config.color : t2Config.color;
    winnerDisplay.textContent = winnerName;
    winnerDisplay.style.color = winnerColor;
  }
}

/**
 * Render team status (levels, A-failures, rounds)
 */
export function renderTeams() {
  const t1Lvl = $('t1Lvl');
  const t2Lvl = $('t2Lvl');
  const t1A = $('t1A');
  const t2A = $('t2A');
  const t1AState = $('t1AState');
  const t2AState = $('t2AState');
  const curRoundLvl = $('curRoundLvl');
  const nextRoundPreview = $('nextRoundPreview');

  const t1Level = state.getTeamLevel('t1');
  const t2Level = state.getTeamLevel('t2');
  const t1AFail = state.getTeamAFail('t1');
  const t2AFail = state.getTeamAFail('t2');
  const roundLevel = state.getRoundLevel();
  const roundOwner = state.getRoundOwner();
  const nextRoundBase = state.getNextRoundBase();

  if (t1Lvl) t1Lvl.textContent = t1Level;
  if (t2Lvl) t2Lvl.textContent = t2Level;
  if (t1A) t1A.textContent = t1AFail || 0;
  if (t2A) t2A.textContent = t2AFail || 0;

  if (t1AState) {
    t1AState.textContent = t1Level === 'A' ? `A${t1AFail}/3` : '—';
  }
  if (t2AState) {
    t2AState.textContent = t2Level === 'A' ? `A${t2AFail}/3` : '—';
  }

  // Show round with team name
  let roundTeamName = '';
  if (String(roundLevel) === String(t1Level) && String(roundLevel) !== String(t2Level)) {
    roundTeamName = ` (${config.getTeamName('t1')})`;
  } else if (String(roundLevel) === String(t2Level) && String(roundLevel) !== String(t1Level)) {
    roundTeamName = ` (${config.getTeamName('t2')})`;
  }

  if (curRoundLvl) {
    curRoundLvl.textContent = roundLevel + roundTeamName;
  }

  // Show next round preview
  const nextRound = nextRoundBase || roundLevel || '-';
  let nextTeamName = '';
  if (nextRoundBase) {
    if (nextRoundBase === t1Level && nextRoundBase !== t2Level) {
      nextTeamName = ` (${config.getTeamName('t1')})`;
    } else if (nextRoundBase === t2Level && nextRoundBase !== t1Level) {
      nextTeamName = ` (${config.getTeamName('t2')})`;
    }
  }

  if (nextRoundPreview) {
    nextRoundPreview.textContent = nextRound + nextTeamName;
  }
}

/**
 * Update rule hint text
 * @param {string} mode - Game mode
 */
export function updateRuleHint(mode) {
  const ruleHint = $('ruleHint');
  if (!ruleHint) return;

  const cfg = config.getAll();

  if (mode === '4') {
    ruleHint.textContent = `4人：固定表 (${cfg.c4['1,2']},${cfg.c4['1,3']},${cfg.c4['1,4']})`;
  } else if (mode === '6') {
    ruleHint.textContent = `6人：分差≥${cfg.t6.g3} 升3；≥${cfg.t6.g2} 升2；≥${cfg.t6.g1} 升1`;
  } else {
    ruleHint.textContent = `8人：分差≥${cfg.t8.g3} 升3；≥${cfg.t8.g2} 升2；≥${cfg.t8.g1} 升1`;
  }
}

/**
 * Refresh preview display without full recalculation
 * Extracted from app.js lines 1467-1475
 */
export function refreshPreviewOnly() {
  const nextRoundPreview = $('nextRoundPreview');
  if (!nextRoundPreview) return;

  const nextRoundBase = state.getNextRoundBase();
  const roundLevel = state.getRoundLevel();

  if (nextRoundBase) {
    nextRoundPreview.textContent = nextRoundBase;
  } else {
    nextRoundPreview.textContent = roundLevel || '-';
  }
}
