/**
 * Team Display - Team UI Utilities
 * Handles team styling, level cards, and the editorial active-game header.
 */

import { $ } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { normalizePlayerCountMode } from '../core/playerCountMode.js';

// Card-rank order. Index of the level → "RANK NN/13" position.
const LEVELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function pad2(n) {
  const x = Number(n);
  if (Number.isFinite(x)) return String(x).padStart(2, '0');
  return String(n);
}

function rankPositionFor(level) {
  const idx = LEVELS.indexOf(String(level));
  if (idx < 0) return '—';
  return `${pad2(idx + 1)}/${LEVELS.length}`;
}

/**
 * Write a level digit, replaying the 240ms flip animation when the value
 * actually changes — the app's single orchestrated animation (DESIGN.md §7).
 */
function setLevelDigit(el, value) {
  if (!el) return;
  const next = String(value ?? '');
  if (el.textContent === next) return;
  el.textContent = next;
  const card = el.closest('.board__level');
  if (!card) return;
  card.classList.remove('board__level--flip');
  void card.offsetWidth; // restart the CSS animation
  card.classList.add('board__level--flip');
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.substr(0, 2), 16),
    g: parseInt(h.substr(2, 2), 16),
    b: parseInt(h.substr(4, 2), 16)
  };
}

export function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

/**
 * Apply team styles to chips, history headers, and the winner display.
 * Team-name chips are rendered safely with textContent.
 */
export function applyTeamStyles() {
  const t1Chip = $('t1NameChip');
  const t2Chip = $('t2NameChip');
  const hT1 = $('hT1');
  const hT2 = $('hT2');

  const t1Config = config.getTeam('t1');
  const t2Config = config.getTeam('t2');

  // Board team names render as plain text — color comes from the
  // .board__team--blue/--red CSS tokens so both light/dark modes resolve
  // correctly (config colors only feed inline-styled surfaces like the
  // stats-table tint and canvas exports).
  if (t1Chip) {
    t1Chip.replaceChildren();
    const b = document.createElement('b');
    b.textContent = t1Config.name;
    t1Chip.appendChild(b);
  }

  if (t2Chip) {
    t2Chip.replaceChildren();
    const b = document.createElement('b');
    b.textContent = t2Config.name;
    t2Chip.appendChild(b);
  }

  if (hT1) hT1.textContent = t1Config.name;
  if (hT2) hT2.textContent = t2Config.name;

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
 * Render team status — level cards, RANK NN/13 subtitle, A-state chip,
 * VS column round number, editorial active-game header line.
 */
export function renderTeams() {
  const t1Lvl = $('t1Lvl');
  const t2Lvl = $('t2Lvl');
  const t1A = $('t1A');
  const t2A = $('t2A');
  const t1AState = $('t1AState');
  const t2AState = $('t2AState');
  const t1AChip = $('t1AChip');
  const t2AChip = $('t2AChip');
  const t1Rank = $('t1Rank');
  const t2Rank = $('t2Rank');
  const curRoundLvl = $('curRoundLvl');
  const nextRoundPreview = $('nextRoundPreview');
  const versusRound = $('versusRound');

  const t1Level = state.getTeamLevel('t1');
  const t2Level = state.getTeamLevel('t2');
  const t1AFail = state.getTeamAFail('t1');
  const t2AFail = state.getTeamAFail('t2');
  const roundLevel = state.getRoundLevel();
  const roundOwner = state.getRoundOwner();
  const nextRoundBase = state.getNextRoundBase();
  const history = state.getHistory();
  const roundCount = history.length + 1; // current round = past rounds + 1

  const aFailEnabled = config.getPreference('strictA');

  setLevelDigit(t1Lvl, t1Level);
  setLevelDigit(t2Lvl, t2Level);

  // Board hero state classes: gold digits at A-level, accent underline on
  // the roundOwner side (DESIGN.md §5).
  const t1LvlCard = $('t1LvlCard');
  const t2LvlCard = $('t2LvlCard');
  if (t1LvlCard) t1LvlCard.classList.toggle('board__level--gold', String(t1Level) === 'A');
  if (t2LvlCard) t2LvlCard.classList.toggle('board__level--gold', String(t2Level) === 'A');

  const boardTeam1 = $('boardTeam1');
  const boardTeam2 = $('boardTeam2');
  if (boardTeam1) boardTeam1.classList.toggle('board__team--owner', roundOwner === 't1');
  if (boardTeam2) boardTeam2.classList.toggle('board__team--owner', roundOwner === 't2');
  if (t1A) t1A.textContent = t1AFail || 0;
  if (t2A) t2A.textContent = t2AFail || 0;

  // RANK NN/13 subtitle below each level glyph (replaces "A状态：—")
  if (t1Rank) t1Rank.textContent = `RANK ${rankPositionFor(t1Level)}`;
  if (t2Rank) t2Rank.textContent = `RANK ${rankPositionFor(t2Level)}`;

  // Team-status pill — only shown for 4-player A-state. Hidden in 6/8 modes.
  if (t1AChip) t1AChip.style.display = aFailEnabled ? '' : 'none';
  if (t2AChip) t2AChip.style.display = aFailEnabled ? '' : 'none';

  if (t1AState) {
    if (t1Level !== 'A') {
      t1AState.textContent = '—';
    } else {
      t1AState.textContent = aFailEnabled ? `A${t1AFail}/3` : '通关中';
    }
  }
  if (t2AState) {
    if (t2Level !== 'A') {
      t2AState.textContent = '—';
    } else {
      t2AState.textContent = aFailEnabled ? `A${t2AFail}/3` : '通关中';
    }
  }

  // Versus column — natural round number ("第5局"). Pre-2026-05 used
  // "本局 05" but unpadded "第N局" reads better in Chinese.
  if (versusRound) versusRound.textContent = `第${roundCount}局`;

  // Round level mirror (active-game header glyph) + label
  let roundTeamName = '';
  let roundTeamSide = ''; // 'red' or 'blue' for accent color
  if (roundOwner === 't1' || roundOwner === 't2') {
    roundTeamName = config.getTeamName(roundOwner);
    roundTeamSide = roundOwner === 't1' ? 'blue' : 'red';
  } else if (String(roundLevel) === String(t1Level) && String(roundLevel) !== String(t2Level)) {
    roundTeamName = config.getTeamName('t1');
    roundTeamSide = 'blue';
  } else if (String(roundLevel) === String(t2Level) && String(roundLevel) !== String(t1Level)) {
    roundTeamName = config.getTeamName('t2');
    roundTeamSide = 'red';
  }

  if (curRoundLvl) {
    curRoundLvl.textContent = roundLevel || '-';
  }

  const nextRound = nextRoundBase || roundLevel || '-';
  if (nextRoundPreview) {
    nextRoundPreview.textContent = nextRound;
  }

  // Editorial active-game header: "本局：4 · 红队的级"
  renderActiveGameHeaderLine(roundLevel, roundTeamName, roundTeamSide);

  // Next-round mirror in active-game header meta
  const nextRoundMirror = $('nextRoundMirror');
  if (nextRoundMirror) {
    nextRoundMirror.textContent = nextRoundBase ? String(nextRoundBase) : '待结算';
  }
}

/**
 * Build the .activegame__head-line content with accent glyph + colored team name.
 *
 * Demo markup:
 *   本局：<span class="glyph accent">4</span> · <span class="accent">红队的级</span>
 */
function renderActiveGameHeaderLine(roundLevel, ownerTeamName, ownerSide) {
  const headLine = $('activegameHeadLine');
  if (!headLine) return;

  headLine.replaceChildren();

  // 牌桌行话 eyebrow: 「本局打 X · 蓝队的级」
  headLine.appendChild(document.createTextNode('本局打 '));

  const glyph = document.createElement('span');
  glyph.className = 'glyph accent';
  glyph.id = 'curRoundLvlMirror';
  glyph.textContent = roundLevel || '—';
  headLine.appendChild(glyph);

  // Optional " · 红队的级" suffix when round level matches one team's level
  if (ownerTeamName) {
    headLine.appendChild(document.createTextNode(' · '));
    const ownerSpan = document.createElement('span');
    ownerSpan.className = `accent accent--${ownerSide}`;
    ownerSpan.textContent = `${ownerTeamName}的级`;
    headLine.appendChild(ownerSpan);
  }
}

/**
 * Update rule hint text in the rules drawer or settings.
 */
export function updateRuleHint(mode) {
  const ruleHint = $('ruleHint');
  if (!ruleHint) return;

  const cfg = config.getAll();
  const modeKey = normalizePlayerCountMode(mode);

  if (modeKey === 4) {
    ruleHint.textContent = `4人：固定表 (${cfg.c4['1,2']},${cfg.c4['1,3']},${cfg.c4['1,4']})`;
  } else if (modeKey === 6) {
    ruleHint.textContent = `6人：分差≥${cfg.t6.g3} 升3；≥${cfg.t6.g2} 升2；≥${cfg.t6.g1} 升1`;
  } else if (modeKey === 8) {
    ruleHint.textContent = `8人：分差≥${cfg.t8.g3} 升3；≥${cfg.t8.g2} 升2；≥${cfg.t8.g1} 升1`;
  } else {
    ruleHint.textContent = '模式无效，请重新选择游戏人数';
  }
}

/**
 * Refresh next-round preview without full recalculation.
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
