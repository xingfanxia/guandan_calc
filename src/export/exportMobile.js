/**
 * Mobile PNG Export - Optimized for Mobile Devices
 * 600px width matching desktop detail level
 * Based on original exportLongPNG but mobile-optimized
 */

import { $ } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { getPlayers } from '../player/playerManager.js';
import { now } from '../core/utils.js';
import { calculateHonors } from '../stats/honors.js';

/**
 * Export mobile-optimized PNG with full detail
 */
export function exportMobilePNG() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const history = state.getHistory();
  const players = getPlayers();
  const playerStats = state.getPlayerStats();
  const honors = calculateHonors(players.length);

  // Mobile dimensions
  const W = 600;
  const headerH = 200;
  const statsHeaderH = 50;
  const statsRowH = 40;
  const statsH = players.length * statsRowH + statsHeaderH + 20;
  const honorsH = 300; // Space for 14 honors in grid
  const historyHeaderH = 50;
  const historyRowH = 55;
  const historyH = Math.min(history.length * historyRowH + historyHeaderH + 20, 600); // Cap at 10 entries
  const footerH = 40;

  const H = headerH + statsH + honorsH + historyH + footerH;

  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, W, H);

  let yPos = 35;

  // === HEADER ===
  ctx.fillStyle = '#f5f6f8';
  ctx.font = 'bold 36px Arial';
  ctx.fillText('掼蛋战绩总览 v9.0', 20, yPos);
  yPos += 50;

  ctx.font = '15px Arial';
  ctx.fillStyle = '#b4b8bf';
  ctx.fillText(`当前级牌: ${state.getRoundLevel()} | 下局: ${state.getNextRoundBase() || '—'}`, 20, yPos);
  yPos += 30;

  ctx.fillText(`${config.getTeamName('t1')}: ${state.getTeamLevel('t1')} (A${state.getTeamAFail('t1')}/3) | ${config.getTeamName('t2')}: ${state.getTeamLevel('t2')} (A${state.getTeamAFail('t2')}/3)`, 20, yPos);
  yPos += 30;

  ctx.fillText(`规则: ${config.getPreference('strictA') ? '严格模式' : '宽松模式'} | 生成: ${now().substring(0, 16)}`, 20, yPos);
  yPos += 45;

  // === PLAYER STATS ===
  ctx.fillStyle = '#e6b800';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('📊 玩家统计', 20, yPos);
  yPos += 40;

  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = '#b4b8bf';
  ctx.fillText('玩家', 30, yPos);
  ctx.fillText('场次', 220, yPos);
  ctx.fillText('平均', 300, yPos);
  ctx.fillText('🥇', 380, yPos);
  ctx.fillText('😅', 450, yPos);
  ctx.fillText('队伍', 520, yPos);
  yPos += 30;

  ctx.font = '14px Arial';
  players.forEach(player => {
    const stats = playerStats[player.id];
    if (stats && stats.games > 0) {
      const avgRank = (stats.totalRank / stats.games).toFixed(2);
      const teamColor = player.team === 1 ? config.getTeamColor('t1') : config.getTeamColor('t2');

      // Row background
      ctx.fillStyle = teamColor + '15';
      ctx.fillRect(15, yPos - 25, W - 30, 35);

      // Text
      ctx.fillStyle = '#f5f6f8';
      ctx.fillText(`${player.emoji} ${player.name}`, 30, yPos);
      ctx.fillText(`${stats.games}`, 230, yPos);
      ctx.fillText(avgRank, 305, yPos);
      ctx.fillText(`${stats.firstPlaceCount || 0}`, 390, yPos);
      ctx.fillText(`${stats.lastPlaceCount || 0}`, 460, yPos);

      ctx.fillStyle = teamColor;
      ctx.fillText(player.team === 1 ? config.getTeamName('t1') : config.getTeamName('t2'), 520, yPos);

      yPos += 40;
    }
  });

  yPos += 25;

  // === HONORS ===
  ctx.fillStyle = '#e6b800';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('🏆 特殊荣誉', 20, yPos);
  yPos += 40;

  ctx.font = 'bold 14px Arial';

  const honorsList = [
    { key: 'mvp', name: 'MVP王', color: '#d4af37' },
    { key: 'burden', name: '拖油瓶', color: '#8b4513' },
    { key: 'stable', name: '稳如泰山', color: '#708090' },
    { key: 'rollercoaster', name: '波动王', color: '#ff4500' },
    { key: 'comeback', name: '逆袭王', color: '#32cd32' },
    { key: 'fatigue', name: '疲劳选手', color: '#ff1493' }
  ];

  let honorX = 20;
  let honorY = yPos;

  honorsList.forEach((honor, index) => {
    const data = honors[honor.key];

    if (data && data.player) {
      // Badge background
      ctx.fillStyle = honor.color;
      ctx.fillRect(honorX, honorY - 20, 180, 35);

      // Text
      ctx.fillStyle = '#fff';
      ctx.fillText(`${honor.name}: ${data.player.emoji}${data.player.name}`, honorX + 10, honorY);
    } else {
      // Empty badge
      ctx.fillStyle = '#2a2b2c';
      ctx.fillRect(honorX, honorY - 20, 180, 35);

      ctx.fillStyle = '#666';
      ctx.fillText(`${honor.name}: —`, honorX + 10, honorY);
    }

    // Move to next position (2 columns)
    honorX += 200;
    if ((index + 1) % 2 === 0) {
      honorX = 20;
      honorY += 50;
    }
  });

  yPos = honorY + (honorsList.length % 2 === 0 ? 30 : 80);

  // === HISTORY ===
  ctx.fillStyle = '#e6b800';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('📜 比赛历史', 20, yPos);
  yPos += 40;

  ctx.font = '12px Arial';

  if (history.length > 0) {
    const recentHistory = history.slice(-10); // Last 10 games

    recentHistory.forEach((h, index) => {
      const winColor = h.winKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');

      // Row background
      ctx.fillStyle = winColor + '15';
      ctx.fillRect(15, yPos - 22, W - 30, 50);

      // Game number
      ctx.fillStyle = '#e6b800';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`#${history.length - 10 + index + 1}`, 25, yPos);

      // Combo
      ctx.fillStyle = '#f5f6f8';
      ctx.font = '13px Arial';
      ctx.fillText(h.combo || '', 60, yPos);

      // Upgrade
      const upgradeText = h.up ? `${h.win}升${h.up}` : '不升级';
      ctx.fillText(upgradeText, 150, yPos);

      // Winner
      ctx.fillStyle = winColor;
      ctx.font = 'bold 13px Arial';
      ctx.fillText(h.win, 260, yPos);

      // Levels
      ctx.fillStyle = '#999';
      ctx.font = '12px Arial';
      ctx.fillText(`${h.t1} | ${h.t2}`, 350, yPos);

      // Round
      ctx.fillText(`@${h.round}`, 450, yPos);

      // Player rankings (if available)
      if (h.playerRankings && Object.keys(h.playerRankings).length > 0) {
        yPos += 20;
        ctx.fillStyle = '#b4b8bf';
        ctx.font = '11px Arial';

        const rankingText = Object.keys(h.playerRankings)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .slice(0, 4) // First 4 positions
          .map(rank => {
            const p = h.playerRankings[rank];
            return `${p.emoji}${p.name}`;
          })
          .join(' ');

        ctx.fillText(rankingText, 25, yPos);
        yPos += 25;
      } else {
        yPos += 55;
      }
    });
  } else {
    ctx.fillStyle = '#666';
    ctx.fillText('暂无历史记录', 25, yPos);
    yPos += 30;
  }

  // Footer
  yPos = H - 20;
  ctx.fillStyle = '#666';
  ctx.font = '11px Arial';
  ctx.fillText('闹麻家族掼蛋计分器 - 手机版 v9.0', 20, yPos);

  // Download
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `掼蛋战绩_手机版_v9.png`;
  a.click();

  // Show message
  const exportTip = $('exportTip');
  if (exportTip) {
    exportTip.textContent = '已导出手机版PNG';
    setTimeout(() => {
      exportTip.textContent = '';
    }, 1200);
  }
}
