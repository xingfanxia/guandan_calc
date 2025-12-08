/**
 * Game History Management
 * Extracted from app.js lines 1478-1523, 1664-1713
 * Handles history rendering, rollback, and reset functionality
 */

import { $ } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';

/**
 * Render game history table
 */
export function renderHistory() {
  const histBody = $('histBody');
  if (!histBody) {
    console.warn('histBody element not found');
    return;
  }

  histBody.innerHTML = '';

  const history = state.getHistory();
  const t1Color = config.getTeamColor('t1');
  const t2Color = config.getTeamColor('t2');

  history.forEach((entry, index) => {
    const tr = document.createElement('tr');
    tr.className = 'tinted';

    // Add color coding based on winning team
    const winColor = entry.winKey === 't1' ? t1Color : t2Color;
    tr.style.background = `linear-gradient(90deg, ${winColor}10, transparent)`;

    // Upgrade display - show "X队获胜" for A-level wins (通关)
    let upgradeText;
    if (entry.up) {
      upgradeText = `${entry.win} 升${entry.up}级`;
    } else if (entry.aNote && entry.aNote.includes('通关')) {
      upgradeText = `${entry.win}获胜`;
    } else {
      upgradeText = '不升级';
    }

    // Build player ranking display if available
    let rankingDisplay = '';
    if (entry.playerRankings) {
      const rankingParts = [];
      for (let rank = 1; rank <= parseInt(entry.mode); rank++) {
        if (entry.playerRankings[rank]) {
          const p = entry.playerRankings[rank];
          const teamColor = p.team === 1 ? t1Color : t2Color;
          rankingParts.push(`<span style="color:${teamColor}">${p.emoji}${p.name}</span>`);
        }
      }
      if (rankingParts.length > 0) {
        rankingDisplay = rankingParts.join(' ');
      }
    }

    // Combo display
    const comboDisplay = entry.combo || '';

    // Build row HTML
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${entry.ts}</td>
      <td>${entry.mode}</td>
      <td>${comboDisplay}</td>
      <td>${rankingDisplay}</td>
      <td>${upgradeText}</td>
      <td style="color:${winColor};font-weight:bold">${entry.win}</td>
      <td>${entry.t1}</td>
      <td>${entry.t2}</td>
      <td>${entry.round}</td>
      <td>${entry.aNote || ''}</td>
    `;

    // Add rollback button
    const td = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = '回滚至此前';
    btn.onclick = () => rollbackTo(index);
    td.appendChild(btn);
    tr.appendChild(td);

    histBody.appendChild(tr);
  });

  if (history.length === 0) {
    histBody.innerHTML = '<tr><td colspan="12" class="muted small">暂无历史记录</td></tr>';
  }
}

/**
 * Rollback to a specific history index
 * @param {number} index - History index to rollback to (will rollback TO BEFORE this entry)
 */
export function rollbackTo(index) {
  const history = state.getHistory();


  // Validate index - should be within history bounds
  if (index < 0 || index >= history.length) {
    console.error('Invalid rollback index:', index, 'history.length:', history.length);
    alert(`无效的回滚索引：${index}`);
    return { success: false };
  }

  if (!confirm(`回滚到第 ${index + 1} 局之前？这将删除此局及之后的所有记录。`)) {
    return { success: false };
  }

  const entry = history[index];


  // Restore state from snapshot
  state.setTeamLevel('t1', entry.prevT1Lvl);
  state.setTeamAFail('t1', entry.prevT1A || 0);
  state.setTeamLevel('t2', entry.prevT2Lvl);
  state.setTeamAFail('t2', entry.prevT2A || 0);
  state.setRoundLevel(entry.prevRound || '2');

  // Restore round owner from previous history
  if (index > 0) {
    state.setRoundOwner(history[index - 1].winKey);
  } else {
    state.setRoundOwner(null); // First round has no owner
  }

  state.setNextRoundBase(null);

  // Trim history to before this entry
  state.rollbackToIndex(index);

  emit('game:rollback', { index, entry });


  return {
    success: true,
    message: '已回滚。'
  };
}

/**
 * Undo last game entry
 */
export function undoLast() {
  const history = state.getHistory();

  if (history.length === 0) {
    alert('没有可撤销的记录');
    return { success: false };
  }

  return rollbackTo(history.length - 1);
}

/**
 * Reset entire game (preserving player assignments per user request)
 * @param {boolean} preservePlayers - Whether to keep player data (default: true)
 */
export function resetAll(preservePlayers = true) {
  if (!confirm('重置整场比赛？' + (preservePlayers ? '（保留玩家姓名和队伍分配）' : ''))) {
    return { success: false };
  }

  if (preservePlayers) {
    // Reset game state and stats, but keep player names/teams
    state.resetGame();
    // Also clear player stats
    state.setPlayerStats({});
  } else {
    // Reset everything including players
    state.resetAll();
  }

  emit('game:reset', { preservePlayers });

  return {
    success: true,
    message: preservePlayers ? '已重置比赛（保留玩家设置）' : '已重置整场比赛'
  };
}
