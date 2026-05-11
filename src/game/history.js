/**
 * Game History — editorial flexbox renderer.
 *
 * Replaces the old <table> rendering. Each completed round renders as a
 * `.history__row` with: round number, level-card glyph (Fraunces), winner
 * badge (red/blue colored), combo summary, upgrade label, per-team level cards.
 *
 * Markup matches docs/design/demos/demo-broadcast-v3.html lines 708-758.
 */

import { $ } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';

const RANK_NAMES = {
  4: ['头游', '二游', '三游', '末游'],
  6: ['头游', '二游', '三游', '四游', '五游', '末游'],
  8: ['头游', '二游', '三游', '四游', '五游', '六游', '七游', '末游']
};

function pad2(n) {
  const x = Number(n);
  if (Number.isFinite(x)) return String(x).padStart(2, '0');
  return String(n);
}

function makeSpan(className, text) {
  const span = document.createElement('span');
  if (className) span.className = className;
  if (text != null) span.textContent = text;
  return span;
}

/**
 * First displayable character of a player.name — strips whitespace, then
 * returns Array.from(name)[0] so emoji-name first chars and CJK both work.
 * Falls back to '?' on empty/missing name.
 */
function firstNameChar(p) {
  if (!p) return '?';
  const n = (p.name || '').trim();
  if (!n) return '?';
  // Skip "玩家1"/"玩家2" prefix → keep the digit (matches playerRenderer).
  const digit = n.match(/^玩家(\d+)$/);
  if (digit) return digit[1];
  return Array.from(n)[0];
}

/** Build a "<rank>.<emoji><nameChar>" chip for one ranked player. */
function makePlayerChip(rank, p) {
  const chip = document.createElement('span');
  chip.className = 'history__combo-chip';

  const rankSpan = document.createElement('span');
  rankSpan.className = 'history__combo-rank';
  rankSpan.textContent = `${rank}.`;
  chip.appendChild(rankSpan);

  if (p?.emoji) {
    const emoji = document.createElement('span');
    emoji.className = 'history__combo-emoji';
    emoji.textContent = p.emoji;
    chip.appendChild(emoji);
  }

  const name = document.createElement('span');
  name.className = 'history__combo-name';
  name.textContent = firstNameChar(p);
  chip.appendChild(name);

  return chip;
}

/**
 * Build the 组合 cell — winners-then-losers, with each ranked player shown
 * as "<rank>.<emoji?><nameChar>" so the round reads narratively (e.g.
 * "1.🐸超 2.🐯豪 4.🐝夫 7.🍎塔 │ 3.🐬帆 5.🐰小 6.🐠鱼 8.🐢大") instead of
 * just position digits. Restores parity with the legacy single-file version
 * that the v10 refactor lost (numbers-only). Falls back to digit-only when
 * playerRankings is absent (older history rows pre-v10).
 */
function makeComboCell(entry) {
  const cell = document.createElement('span');
  cell.className = 'history__combo';

  const mode = parseInt(entry.mode) || 0;
  const winnerSide = entry.winKey === 't1' ? 1 : 2;
  const winnerColor = entry.winKey === 't1' ? 'blue' : 'red';

  // Prefer rich playerRankings (carries team membership + name + emoji per rank).
  if (entry.playerRankings && mode) {
    const winners = [];
    const losers = [];
    for (let r = 1; r <= mode; r++) {
      const p = entry.playerRankings[r];
      if (!p) continue;
      (Number(p.team) === winnerSide ? winners : losers).push({ rank: r, player: p });
    }
    if (winners.length || losers.length) {
      if (winners.length) {
        const winGroup = makeSpan(
          `history__combo-group history__combo-group--win history__combo-group--${winnerColor}`
        );
        winners.forEach(({ rank, player }) => winGroup.appendChild(makePlayerChip(rank, player)));
        cell.appendChild(winGroup);
      }
      if (losers.length) {
        cell.appendChild(makeSpan('history__combo-sep', '│'));
        const lossGroup = makeSpan('history__combo-group history__combo-group--loss');
        losers.forEach(({ rank, player }) => lossGroup.appendChild(makePlayerChip(rank, player)));
        cell.appendChild(lossGroup);
      }
      return cell;
    }
  }

  // Fallback: only winner position digits are known (combo string or ranks array).
  let winnerDigits = [];
  if (entry.combo) {
    winnerDigits = entry.combo.replace(/[^\d,]/g, '').split(',').filter(Boolean);
  } else if (Array.isArray(entry.ranks) && entry.ranks.length) {
    winnerDigits = entry.ranks.map(String);
  }
  if (winnerDigits.length) {
    cell.appendChild(
      makeSpan(`history__combo-group history__combo-group--win history__combo-group--${winnerColor}`,
        winnerDigits.join('·'))
    );
    return cell;
  }

  cell.textContent = '—';
  return cell;
}

function upgradeCellFor(entry) {
  const aNote = entry.aNote || '';
  if (aNote.includes('A级通关')) {
    return { text: `${entry.win}通关`, modifier: 'history__upgrade--win' };
  }
  if (entry.up) {
    return { text: `升 ${entry.up} 级`, modifier: '' };
  }
  // Zero-upgrade rounds — surface the reason if known
  let suffix = '';
  if (aNote.includes('must1')) suffix = ' · must1 未达';
  else if (aNote.includes('差距')) suffix = ' · 差距 < 阈值';
  return { text: `升 0 级${suffix}`, modifier: 'history__upgrade--zero' };
}

function makeRollbackButton(index) {
  const btn = document.createElement('button');
  btn.className = 'history__rollback';
  btn.type = 'button';
  btn.textContent = '回滚';
  btn.title = `回滚到第 ${index + 1} 局之前`;
  btn.onclick = () => rollbackTo(index);
  return btn;
}

/**
 * Render history rows in editorial flexbox layout.
 */
export function renderHistory() {
  const histBody = $('histBody');
  if (!histBody) {
    console.warn('histBody element not found');
    return;
  }

  histBody.replaceChildren();

  const history = state.getHistory();

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history__empty';
    empty.textContent = '暂无历史记录';
    histBody.appendChild(empty);
    return;
  }

  history.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'history__row';

    // 本局 (round number)
    row.appendChild(makeSpan('history__round', `R${pad2(index + 1)}`));

    // 级牌 (round level when this round was played)
    row.appendChild(makeSpan('history__levelcard', entry.round || '—'));

    // 胜方 (winner badge)
    const winnerCell = makeSpan('history__winner-cell');
    const winnerBadge = makeSpan(
      `history__winner history__winner--${entry.winKey === 't1' ? 'blue' : 'red'}`,
      entry.win || '—'
    );
    winnerCell.appendChild(winnerBadge);
    row.appendChild(winnerCell);

    // 组合 (combo / ranking summary) — winner positions accent + loser dim
    row.appendChild(makeComboCell(entry));

    // 升级
    const up = upgradeCellFor(entry);
    row.appendChild(makeSpan(`history__upgrade ${up.modifier}`.trim(), up.text));

    // 红/蓝 levels (after this round)
    // entry.t1 / entry.t2 are POST-round levels; entry uses team labels per config.
    // t1 = blue (蓝), t2 = red (红) — match scoreboard ordering by showing red first.
    row.appendChild(makeSpan('history__lvl history__lvl--red', entry.t2 || '—'));
    row.appendChild(makeSpan('history__lvl history__lvl--blue', entry.t1 || '—'));

    // Action cell
    const actionCell = document.createElement('span');
    actionCell.className = 'history__rollback-cell';
    actionCell.appendChild(makeRollbackButton(index));
    row.appendChild(actionCell);

    histBody.appendChild(row);
  });
}

/**
 * Rollback to a specific history index.
 */
export function rollbackTo(index) {
  const history = state.getHistory();

  if (index < 0 || index >= history.length) {
    console.error('Invalid rollback index:', index, 'history.length:', history.length);
    alert(`无效的回滚索引：${index}`);
    return { success: false };
  }

  if (!confirm(`回滚到第 ${index + 1} 局之前？这将删除此局及之后的所有记录。`)) {
    return { success: false };
  }

  const entry = history[index];

  state.setTeamLevel('t1', entry.prevT1Lvl);
  state.setTeamAFail('t1', entry.prevT1A || 0);
  state.setTeamLevel('t2', entry.prevT2Lvl);
  state.setTeamAFail('t2', entry.prevT2A || 0);
  state.setRoundLevel(entry.prevRound || '2');

  if (entry.prevRoundOwner !== undefined) {
    state.setRoundOwner(entry.prevRoundOwner);
  } else if (index > 0) {
    state.setRoundOwner(history[index - 1].winKey);
  } else {
    state.setRoundOwner(null);
  }

  state.setNextRoundBase(entry.prevNextRoundBase ?? null);
  state.rollbackToIndex(index);

  emit('game:rollback', { index, entry });

  return { success: true, message: '已回滚。' };
}

export function undoLast() {
  const history = state.getHistory();
  if (history.length === 0) {
    alert('没有可撤销的记录');
    return { success: false };
  }
  return rollbackTo(history.length - 1);
}

export function resetAll(preservePlayers = true) {
  if (!confirm('重置整场比赛？' + (preservePlayers ? '（保留玩家姓名和队伍分配）' : ''))) {
    return { success: false };
  }

  if (preservePlayers) {
    state.resetGame();
    state.setPlayerStats({});
  } else {
    state.resetAll();
  }

  emit('game:reset', { preservePlayers });

  return {
    success: true,
    message: preservePlayers ? '已重置比赛（保留玩家设置）' : '已重置整场比赛'
  };
}
