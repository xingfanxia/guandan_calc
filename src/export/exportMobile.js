/**
 * Mobile PNG Export - Optimized for Mobile Devices
 * 600px width with larger fonts and better layout
 */

import { $ } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { getPlayers } from '../player/playerManager.js';
import { now } from '../core/utils.js';

/**
 * Export mobile-optimized PNG
 */
export function exportMobilePNG() {
  // Create a temporary canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const history = state.getHistory();
  const players = getPlayers();
  const playerStats = state.getPlayerStats();

  // Canvas dimensions (mobile-optimized)
  const W = 600;
  const headerH = 180;
  const statsH = players.length * 35 + 60; // Player stats section
  const historyRowH = 50;
  const historyH = Math.max(history.length * historyRowH + 80, 100);
  const footerH = 60;

  const H = headerH + statsH + historyH + footerH;

  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, W, H);

  let yPos = 30;

  // Header
  ctx.fillStyle = '#f5f6f8';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('掼蛋战绩 v9.0', 20, yPos);
  yPos += 45;

  ctx.font = '16px Arial';
  ctx.fillStyle = '#b4b8bf';
  ctx.fillText(`当前级牌: ${state.getRoundLevel()} | ${config.getTeamName('t1')}: ${state.getTeamLevel('t1')} | ${config.getTeamName('t2')}: ${state.getTeamLevel('t2')}`, 20, yPos);
  yPos += 30;

  ctx.fillText(`生成时间: ${now()}`, 20, yPos);
  yPos += 50;

  // Player Stats Section
  ctx.fillStyle = '#e6b800';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('玩家统计', 20, yPos);
  yPos += 35;

  ctx.font = '14px Arial';
  ctx.fillStyle = '#f5f6f8';

  players.forEach(player => {
    const stats = playerStats[player.id];
    if (stats && stats.games > 0) {
      const avgRank = (stats.totalRank / stats.games).toFixed(2);
      const teamColor = player.team === 1 ? config.getTeamColor('t1') : config.getTeamColor('t2');

      ctx.fillStyle = teamColor + '20';
      ctx.fillRect(10, yPos - 20, W - 20, 30);

      ctx.fillStyle = '#f5f6f8';
      ctx.fillText(`${player.emoji} ${player.name}`, 20, yPos);
      ctx.fillText(`${stats.games}场`, 250, yPos);
      ctx.fillText(`平均${avgRank}`, 330, yPos);
      ctx.fillText(`🥇${stats.firstPlaceCount || 0}`, 430, yPos);
      ctx.fillText(`😅${stats.lastPlaceCount || 0}`, 520, yPos);

      yPos += 35;
    }
  });

  yPos += 20;

  // History Section
  ctx.fillStyle = '#e6b800';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('比赛历史', 20, yPos);
  yPos += 35;

  ctx.font = '12px Arial';

  if (history.length > 0) {
    history.slice(-10).forEach((h, i) => { // Last 10 games
      const winColor = h.winKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');

      ctx.fillStyle = winColor + '15';
      ctx.fillRect(10, yPos - 18, W - 20, 45);

      ctx.fillStyle = '#f5f6f8';
      ctx.fillText(`#${history.length - 10 + i + 1}`, 20, yPos);
      ctx.fillText(h.combo, 60, yPos);
      ctx.fillText(h.up ? `${h.win}升${h.up}级` : '不升级', 150, yPos);

      ctx.fillStyle = winColor;
      ctx.fillText(h.win, 280, yPos);

      ctx.fillStyle = '#999';
      ctx.fillText(`${h.t1} | ${h.t2}`, 380, yPos);

      yPos += 50;
    });
  } else {
    ctx.fillStyle = '#666';
    ctx.fillText('暂无历史记录', 20, yPos);
    yPos += 30;
  }

  // Footer
  yPos = H - 30;
  ctx.fillStyle = '#666';
  ctx.font = '11px Arial';
  ctx.fillText('闹麻家族掼蛋计分器 - 手机版导出', 20, yPos);

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
