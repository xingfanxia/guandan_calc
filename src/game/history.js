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
import { isClearingANote } from './gameStatus.js';
import { normalizePlayerCountMode } from '../core/playerCountMode.js';
import { isValidRoomSnapshotPayload } from '../../shared/roomSnapshotValidation.js';

const RANK_NAMES = {
  4: ['头游', '二游', '三游', '末游'],
  6: ['头游', '二游', '三游', '四游', '五游', '末游'],
  8: ['头游', '二游', '三游', '四游', '五游', '六游', '七游', '末游']
};
const VALID_LEVELS = new Set(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']);
const VALID_TEAM_KEYS = new Set(['t1', 't2']);

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

/** Build a "<rank>.<emoji><nameChar>" chip for one ranked player.
 *  variants: array of modifier suffixes — e.g. ['win','blue'] or ['loss']. */
function makePlayerChip(rank, p, variants) {
  const chip = document.createElement('span');
  const cls = ['history__combo-chip'];
  (variants || []).forEach((v) => cls.push(`history__combo-chip--${v}`));
  chip.className = cls.join(' ');

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

function getEntryWinnerKey(entry) {
  return entry.winKey || entry.gameStatus?.winnerKey || null;
}

function getEntryWinnerName(entry) {
  const explicitName = typeof entry.win === 'string' ? entry.win.trim() : '';
  if (explicitName) return explicitName;

  const statusName = typeof entry.gameStatus?.winnerName === 'string'
    ? entry.gameStatus.winnerName.trim()
    : '';
  if (statusName) return statusName;

  const winnerKey = getEntryWinnerKey(entry);
  return winnerKey ? config.getTeamName(winnerKey) : '';
}

/**
 * Build the 组合 cell — sequential rank 1..N, with each chip carrying its
 * own team-color modifier (winners get accent, losers get dim). Reads
 * naturally: "1.🐸超 2.🍎塔 3.🐰小 4.🐢大 …" rather than reorganizing the
 * round into winners-then-losers. Falls back to digit-only when
 * playerRankings is absent (older pre-v10 history rows).
 */
function makeComboCell(entry) {
  const cell = document.createElement('span');
  cell.className = 'history__combo';

  const mode = normalizePlayerCountMode(entry.mode) || 0;
  const winnerKey = getEntryWinnerKey(entry);
  const winnerSide = winnerKey === 't1' ? 1 : winnerKey === 't2' ? 2 : null;
  const winnerColor = winnerKey === 't1' ? 'blue' : 'red';

  // Prefer rich playerRankings (carries team membership + name + emoji per rank).
  if (entry.playerRankings && mode) {
    const group = makeSpan('history__combo-group history__combo-group--seq');
    let any = false;
    for (let r = 1; r <= mode; r++) {
      const p = entry.playerRankings[r];
      if (!p) continue;
      const variants = Number(p.team) === winnerSide ? ['win', winnerColor] : ['loss'];
      group.appendChild(makePlayerChip(r, p, variants));
      any = true;
    }
    if (any) {
      cell.appendChild(group);
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
  if (entry.gameStatus?.ended || isClearingANote(aNote)) {
    return { text: `${getEntryWinnerName(entry) || '胜方'}通关`, modifier: 'history__upgrade--win' };
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

function isValidLevel(value) {
  return VALID_LEVELS.has(String(value));
}

function normalizeRollbackAFail(value) {
  if (value === undefined || value === null) return 0;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 && count <= 2 ? count : null;
}

function normalizeRollbackOwner(value) {
  if (value === undefined || value === null) return null;
  return VALID_TEAM_KEYS.has(value) ? value : undefined;
}

function normalizeRollbackWinner(value) {
  if (value === undefined || value === null) return undefined;
  return VALID_TEAM_KEYS.has(value) ? value : null;
}

function isValidRollbackGameStatus(status) {
  if (status === undefined || status === null) return true;
  if (typeof status !== 'object' || Array.isArray(status)) return false;
  if (status.ended !== undefined && typeof status.ended !== 'boolean') return false;
  if (status.winnerName !== undefined && status.winnerName !== null && typeof status.winnerName !== 'string') return false;
  if (status.reason !== undefined && status.reason !== null && typeof status.reason !== 'string') return false;

  if (status.ended !== true) {
    return status.winnerKey == null &&
      status.winnerName == null &&
      status.reason == null;
  }

  return VALID_TEAM_KEYS.has(status.winnerKey);
}

function isValidRollbackPlayerStats(playerStats) {
  if (playerStats === undefined) return true;
  return isValidRoomSnapshotPayload({
    players: state.getPlayers(),
    playerStats
  });
}

function buildRollbackSnapshot(entry, history, index) {
  if (
    !entry ||
    !isValidLevel(entry.prevT1Lvl) ||
    !isValidLevel(entry.prevT2Lvl) ||
    !isValidLevel(entry.prevRound)
  ) {
    return null;
  }

  const prevT1A = normalizeRollbackAFail(entry.prevT1A);
  const prevT2A = normalizeRollbackAFail(entry.prevT2A);
  if (prevT1A === null || prevT2A === null) return null;

  let prevRoundOwner;
  if (entry.prevRoundOwner !== undefined) {
    prevRoundOwner = normalizeRollbackOwner(entry.prevRoundOwner);
    if (prevRoundOwner === undefined) return null;
  } else if (index > 0) {
    const previousWinner = history[index - 1]?.winKey;
    prevRoundOwner = VALID_TEAM_KEYS.has(previousWinner) ? previousWinner : null;
  } else {
    prevRoundOwner = null;
  }

  const prevNextRoundBase = entry.prevNextRoundBase ?? null;
  if (prevNextRoundBase !== null && !isValidLevel(prevNextRoundBase)) return null;
  if (!isValidRollbackGameStatus(entry.prevGameStatus)) return null;
  if (!isValidRollbackPlayerStats(entry.prevPlayerStats)) return null;

  const explicitPrevWinner = normalizeRollbackWinner(entry.prevWinner);
  if (explicitPrevWinner === null) return null;
  const priorHistoryWinner = index > 0 ? history[index - 1]?.winKey : null;
  const prevWinner = explicitPrevWinner ||
    (VALID_TEAM_KEYS.has(priorHistoryWinner) ? priorHistoryWinner : 't1');

  return {
    prevT1Lvl: String(entry.prevT1Lvl),
    prevT1A,
    prevT2Lvl: String(entry.prevT2Lvl),
    prevT2A,
    prevRound: String(entry.prevRound),
    prevRoundOwner,
    prevNextRoundBase: prevNextRoundBase === null ? null : String(prevNextRoundBase),
    prevWinner,
    prevGameStatus: entry.prevGameStatus || {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    },
    prevPlayerStats: entry.prevPlayerStats
  };
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
    const winnerKey = getEntryWinnerKey(entry);
    const winnerColorClass = winnerKey === 't1' ? 'blue' : winnerKey === 't2' ? 'red' : '';
    const winnerBadge = makeSpan(
      `history__winner ${winnerColorClass ? `history__winner--${winnerColorClass}` : ''}`.trim(),
      getEntryWinnerName(entry) || '—'
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
  const snapshot = buildRollbackSnapshot(entry, history, index);
  if (!snapshot) {
    console.warn('Cannot rollback history entry without a valid rollback snapshot:', { index, entry });
    alert('这条历史记录缺少回滚快照，无法安全回滚。');
    return { success: false, reason: 'missing_snapshot' };
  }

  state.setTeamLevel('t1', snapshot.prevT1Lvl);
  state.setTeamAFail('t1', snapshot.prevT1A);
  state.setTeamLevel('t2', snapshot.prevT2Lvl);
  state.setTeamAFail('t2', snapshot.prevT2A);
  state.setRoundLevel(snapshot.prevRound);
  state.setRoundOwner(snapshot.prevRoundOwner);
  state.setNextRoundBase(snapshot.prevNextRoundBase);
  state.setWinner(snapshot.prevWinner);
  state.setGameStatus(snapshot.prevGameStatus);
  if (snapshot.prevPlayerStats !== undefined) {
    state.setPlayerStats(snapshot.prevPlayerStats);
  }
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

  state.setSessionStartTime(Date.now());
  emit('game:reset', { preservePlayers });

  return {
    success: true,
    message: preservePlayers ? '已重置比赛（保留玩家设置）' : '已重置整场比赛'
  };
}
