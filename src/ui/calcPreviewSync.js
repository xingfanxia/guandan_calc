/**
 * Calc Preview Sync — editorial segments for the LIVE CALC strip.
 *
 * Demo (docs/design/demos/demo-broadcast-v3.html lines 634-651):
 *   [LIVE CALC] | 红 [1,?,?]=5+?+?=? · 蓝 [2,?,?]=4+?+?=? · 差距 待结算 · 阈值 +3≥7 · +2≥4 · +1≥1 → 等待最后 4 位
 *
 * For 4-player: each team holds 2 slots (combination → upgrade per c4 table).
 * For 6-player: each team holds 3 slots (score-diff → upgrade per t6 thresholds).
 * For 8-player: each team holds 4 slots (score-diff → upgrade per t8 thresholds).
 *
 * Subscribes to ranking events; idempotent re-renders.
 */

import { $ } from '../core/utils.js';
import { on as onEvent } from '../core/events.js';
import { getRanking } from '../ranking/rankingManager.js';
import { getPlayerById } from '../player/playerManager.js';
import config from '../core/config.js';
import state from '../core/state.js';
import { normalizePlayerCountMode } from '../core/playerCountMode.js';

function modeNumber() {
  const modeEl = $('mode');
  return normalizePlayerCountMode(modeEl ? modeEl.value : 4);
}

function teamSlotsFor(mode) {
  return mode / 2;
}

function pointsFor(mode) {
  if (mode === 4) {
    return null; // 4-player uses combination table, not score
  }
  if (mode === 6) {
    return config.get6PlayerRules().points;
  }
  return config.get8PlayerRules().points;
}

function thresholdsFor(mode) {
  if (mode === 4) return null;
  if (mode === 6) return config.get6PlayerRules().thresholds;
  return config.get8PlayerRules().thresholds;
}

/**
 * Build the rank array for a given team — placed ranks ascending, '?' for empty.
 * Returns { display: '[1, ?, ?]', placed: [1], allPlaced: false, scoreSum: 5 (or null) }
 */
function teamRankInfo(teamSide, ranking, mode, points) {
  const slots = teamSlotsFor(mode);
  const placed = [];

  for (let rank = 1; rank <= mode; rank++) {
    const playerId = ranking[rank];
    if (playerId == null) continue;
    const player = getPlayerById(playerId);
    if (!player) continue;
    if (Number(player.team) === teamSide) {
      placed.push(rank);
    }
  }
  placed.sort((a, b) => a - b);

  const items = [];
  for (let i = 0; i < slots; i++) {
    items.push(placed[i] != null ? String(placed[i]) : '?');
  }
  const display = `[${items.join(', ')}]`;

  let scoreSum = 0;
  let scoreParts = [];
  if (points) {
    placed.forEach(r => {
      const v = points[r] || 0;
      scoreSum += v;
      scoreParts.push(String(v));
    });
    while (scoreParts.length < slots) scoreParts.push('?');
  }

  return {
    display,
    placed,
    allPlaced: placed.length === slots,
    scoreParts,
    scoreSum
  };
}

function thresholdHintText(mode, thresholds) {
  if (mode === 4) {
    const c4 = config.get4PlayerRules();
    return `阈值 (1,2)=${c4['1,2']} · (1,3)=${c4['1,3']} · (1,4)=${c4['1,4']}`;
  }
  return `阈值 +3≥${thresholds.g3} · +2≥${thresholds.g2} · +1≥${thresholds.g1}`;
}

function makeSegment(keyText, valueNodes, segClass) {
  const seg = document.createElement('div');
  seg.className = `calcpreview__seg ${segClass || ''}`.trim();
  const key = document.createElement('span');
  key.className = 'key';
  key.textContent = keyText;
  seg.appendChild(key);
  const val = document.createElement('span');
  val.className = 'val';
  valueNodes.forEach(n => val.appendChild(n));
  seg.appendChild(val);
  return seg;
}

function makeSeparator() {
  const sep = document.createElement('span');
  sep.className = 'calcpreview__sep';
  sep.textContent = '·';
  return sep;
}

function makeColored(text, colorClass) {
  const span = document.createElement('span');
  span.className = colorClass;
  span.textContent = text;
  return span;
}

function makeText(text) {
  return document.createTextNode(text);
}

/**
 * Render the editorial calc preview segments based on current ranking state.
 */
export function renderCalcPreview() {
  const container = $('calcpreviewContent');
  if (!container) return;

  const ranking = getRanking();
  const mode = modeNumber();
  if (!mode) {
    container.replaceChildren(makeColored('模式无效，请重新选择模式', 'pending'));
    const hint = $('calcpreviewHint');
    if (hint) {
      hint.textContent = '请重新选择模式';
    }
    return;
  }

  const points = pointsFor(mode);
  const thresholds = thresholdsFor(mode);

  // t1 == blue (蓝队 default), t2 == red (红队 default).
  // Demo orders 红 first, 蓝 second — so we show t2 first then t1.
  const redInfo = teamRankInfo(2, ranking, mode, points); // t2 = red
  const blueInfo = teamRankInfo(1, ranking, mode, points); // t1 = blue

  container.replaceChildren();

  // Segment 1: 红 [...] = sum
  const redValueNodes = [makeColored(redInfo.display, 'red')];
  if (points) {
    redValueNodes.push(makeText(' = '));
    redValueNodes.push(makeText(redInfo.scoreParts.join(' + ')));
    redValueNodes.push(makeText(' = '));
    redValueNodes.push(makeColored(redInfo.allPlaced ? String(redInfo.scoreSum) : '?', redInfo.allPlaced ? 'red' : 'pending'));
  }
  container.appendChild(makeSegment('红', redValueNodes, 'calcpreview__seg--red'));
  container.appendChild(makeSeparator());

  // Segment 2: 蓝 [...] = sum
  const blueValueNodes = [makeColored(blueInfo.display, 'blue')];
  if (points) {
    blueValueNodes.push(makeText(' = '));
    blueValueNodes.push(makeText(blueInfo.scoreParts.join(' + ')));
    blueValueNodes.push(makeText(' = '));
    blueValueNodes.push(makeColored(blueInfo.allPlaced ? String(blueInfo.scoreSum) : '?', blueInfo.allPlaced ? 'blue' : 'pending'));
  }
  container.appendChild(makeSegment('蓝', blueValueNodes, 'calcpreview__seg--blue'));
  container.appendChild(makeSeparator());

  // Segment 3: 差距 [pending or computed] · 阈值 ...
  const gapNodes = [];
  if (mode === 4) {
    // 4-player: show combination + upgrade lookup
    if (redInfo.allPlaced && blueInfo.allPlaced) {
      const winningTeam = redInfo.placed.includes(1) ? '红' : (blueInfo.placed.includes(1) ? '蓝' : null);
      const winningRanks = winningTeam === '红' ? redInfo.placed : blueInfo.placed;
      if (winningTeam) {
        const c4 = config.get4PlayerRules();
        const key = `${winningRanks[0]},${winningRanks[1]}`;
        const upgrade = c4[key] || 0;
        gapNodes.push(makeText(`${winningTeam}方 (${key}) → 升 `));
        gapNodes.push(makeColored(`${upgrade} 级`, upgrade > 0 ? (winningTeam === '红' ? 'red' : 'blue') : 'pending'));
      } else {
        gapNodes.push(makeColored('待结算', 'pending'));
      }
    } else {
      gapNodes.push(makeColored('待结算', 'pending'));
    }
    gapNodes.push(makeText(' · '));
    gapNodes.push(makeText(thresholdHintText(mode, thresholds)));
  } else {
    // 6/8-player: show score difference + threshold hint
    if (redInfo.allPlaced && blueInfo.allPlaced) {
      const diff = redInfo.scoreSum - blueInfo.scoreSum;
      const absDiff = Math.abs(diff);
      const winningSide = diff > 0 ? 'red' : (diff < 0 ? 'blue' : null);
      gapNodes.push(makeText('分差 '));
      gapNodes.push(makeColored(absDiff === 0 ? '平' : `+${absDiff}`, winningSide || 'pending'));
    } else {
      gapNodes.push(makeColored('待结算', 'pending'));
    }
    gapNodes.push(makeText(' · '));
    gapNodes.push(makeText(thresholdHintText(mode, thresholds)));
  }
  container.appendChild(makeSegment('差距', gapNodes, 'calcpreview__seg--gap'));

  // Hint on the right: filled count
  const hint = $('calcpreviewHint');
  if (hint) {
    const filled = Object.keys(ranking).filter(k => ranking[k] != null).length;
    if (filled === 0) {
      hint.textContent = `等待第一位排名`;
    } else if (filled === mode) {
      hint.textContent = `已就绪 · ${mode}/${mode}`;
    } else {
      hint.textContent = `等待最后 ${mode - filled} 位`;
    }
  }
}

export function initCalcPreviewSync() {
  renderCalcPreview();
  onEvent('ranking:positionSet', renderCalcPreview);
  onEvent('ranking:positionCleared', renderCalcPreview);
  onEvent('ranking:cleared', renderCalcPreview);
  onEvent('ranking:randomized', renderCalcPreview);
  onEvent('ranking:updated', renderCalcPreview);
  onEvent('state:currentRankingChanged', renderCalcPreview);
  onEvent('config:settingChanged', renderCalcPreview);
  onEvent('config:rulesUpdated', renderCalcPreview);
  onEvent('ui:modeChanged', renderCalcPreview);
  onEvent('state:hydrated', renderCalcPreview);
  onEvent('state:gameReset', renderCalcPreview);
  onEvent('state:allReset', renderCalcPreview);

  // Also listen to native change on #mode for cases where the harness sets the value
  // before the JS controllers had a chance to wire up.
  const modeEl = document.getElementById('mode');
  if (modeEl) {
    modeEl.addEventListener('change', renderCalcPreview);
  }
}
