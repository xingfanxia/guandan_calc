/**
 * Mobile PNG Export - EXACT REPLICATION of original detailed version
 * 600px width with comprehensive sections
 */

import { $ } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { getPlayers, getPlayersByTeam } from '../player/playerManager.js';
import { now } from '../core/utils.js';
// Don't import calculateHonors - causes circular dependency

export function exportMobilePNG() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const W = 600;
  const history = state.getHistory();
  const n = history.length;

  // Start with large height
  let H = 2000 + n * 250;

  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, W, H);

  let currentY = 70;

  // === HEADER ===
  ctx.fillStyle = '#f5f6f8';
  ctx.font = 'bold 48px Arial';
  ctx.fillText('掼蛋战绩总览', 40, currentY);
  currentY += 45;

  // Check if there's an A-level victory
  const latestGame = history.length > 0 ? history[history.length - 1] : null;
  const hasVictory = latestGame && latestGame.aNote && latestGame.aNote.includes('通关');

  if (hasVictory) {
    // Show victory team
    ctx.fillStyle = latestGame.winKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');
    ctx.font = 'bold 32px Arial';
    ctx.fillText(`🏆 ${latestGame.win} A级通关！`, 40, currentY);
    currentY += 50;

    // Show team roster
    const winnerTeam = latestGame.winKey === 't1' ? 1 : 2;
    const teamPlayers = players.filter(p => p.team === winnerTeam);

    ctx.font = '20px Arial';
    ctx.fillStyle = '#b4b8bf';
    const roster = teamPlayers.map(p => `${p.emoji}${p.name}`).join(' ');
    ctx.fillText(`冠军队伍: ${roster}`, 40, currentY);
    currentY += 40;
  }

  ctx.font = '18px Arial';
  ctx.fillStyle = '#b4b8bf';
  ctx.fillText(`级牌：${state.getRoundLevel()} | 下局：${state.getNextRoundBase() || '—'}`, 40, currentY);
  currentY += 26;
  ctx.fillText(`A级：${config.getPreference('strictA') ? '严格模式' : '宽松模式'}`, 40, currentY);
  currentY += 28;

  const teamInfo = `${config.getTeamName('t1')} ${state.getTeamLevel('t1')} | ${config.getTeamName('t2')} ${state.getTeamLevel('t2')}`;
  ctx.fillText(teamInfo, 40, currentY);
  currentY += 23;

  ctx.font = '16px Arial';
  ctx.fillText(`时间：${now()}`, 40, currentY);
  currentY += 50;

  // === HONORS SECTION ===
  ctx.font = 'bold 36px Arial';
  ctx.fillStyle = '#f5f6f8';
  ctx.fillText('🏆 荣誉提名', 40, currentY);
  currentY += 50;

  // Team MVPs
  const team1Players = getPlayersByTeam(1);
  const team2Players = getPlayersByTeam(2);
  const playerStats = state.getPlayerStats();

  const findMVPBurden = (teamPlayers) => {
    let mvp = null, burden = null;
    let bestAvg = 999, worstAvg = 0;

    teamPlayers.forEach(player => {
      const stats = playerStats[player.id];
      if (stats && stats.games > 0) {
        const avg = stats.totalRank / stats.games;
        if (avg < bestAvg) {
          bestAvg = avg;
          mvp = player;
        }
        if (avg > worstAvg) {
          worstAvg = avg;
          burden = player;
        }
      }
    });

    return { mvp, burden };
  };

  const team1Result = findMVPBurden(team1Players);
  const team2Result = findMVPBurden(team2Players);

  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = config.getTeamColor('t1');
  ctx.fillText(config.getTeamName('t1'), 40, currentY);
  currentY += 35;

  ctx.font = '20px Arial';
  ctx.fillStyle = '#b4b8bf';
  ctx.fillText(`很C: ${team1Result.mvp ? team1Result.mvp.emoji + team1Result.mvp.name : '—'}`, 60, currentY);
  currentY += 30;
  ctx.fillText(`很闹: ${team1Result.burden ? team1Result.burden.emoji + team1Result.burden.name : '—'}`, 60, currentY);
  currentY += 45;

  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = config.getTeamColor('t2');
  ctx.fillText(config.getTeamName('t2'), 40, currentY);
  currentY += 35;

  ctx.font = '20px Arial';
  ctx.fillStyle = '#b4b8bf';
  ctx.fillText(`很C: ${team2Result.mvp ? team2Result.mvp.emoji + team2Result.mvp.name : '—'}`, 60, currentY);
  currentY += 30;
  ctx.fillText(`很闹: ${team2Result.burden ? team2Result.burden.emoji + team2Result.burden.name : '—'}`, 60, currentY);
  currentY += 50;

  // Special honors
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#f5f6f8';
  ctx.fillText('🎖️ 特殊荣誉', 40, currentY);
  currentY += 45;

  const honors = calculateHonors(getPlayers().length);

  const honorsList = [
    { key: 'mvp', name: '🥇吕布', desc: '最多第一名', color: '#d4af37' },
    { key: 'burden', name: '😅阿斗', desc: '最多垫底', color: '#8b4513' },
    { key: 'stable', name: '🗿石佛', desc: '排名最稳定', color: '#708090' },
    { key: 'rollercoaster', name: '🌊波动王', desc: '排名波动最大', color: '#ff4500' },
    { key: 'comeback', name: '📈奋斗王', desc: '排名稳步提升', color: '#32cd32' },
    { key: 'fanche', name: '🎪翻车王', desc: '前3掉垫底', color: '#dc143c' },
    { key: 'complete', name: '👑大满贯', desc: '体验所有排名', color: '#ffd700' },
    { key: 'streak', name: '🔥连胜王', desc: '连续好排名', color: '#ff6347' },
    { key: 'median', name: '🧘佛系玩家', desc: '总是中游', color: '#9370db' },
    { key: 'slowStart', name: '🐌慢热王', desc: '后期发力', color: '#ff1493' },
    { key: 'frequent', name: '⚡闪电侠', desc: '变化频繁', color: '#ffa500' },
    { key: 'fatigue', name: '📉疲劳选手', desc: '后期疲软', color: '#8b008b' }
  ];

  ctx.font = 'bold 22px Arial';
  honorsList.forEach(honor => {
    const winner = honors[honor.key];
    const winnerText = winner ? winner.player.emoji + winner.player.name : '—';

    ctx.fillStyle = honor.color;
    ctx.fillText(honor.name, 60, currentY);

    ctx.fillStyle = '#f5f6f8';
    ctx.fillText(winnerText, 200, currentY);

    ctx.fillStyle = '#888';
    ctx.font = '16px Arial';
    ctx.fillText(`(${honor.desc})`, 280, currentY);

    ctx.font = 'bold 22px Arial';
    currentY += 40;
  });

  currentY += 60;

  // === PLAYER STATS ===
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#f5f6f8';
  ctx.fillText('📊 玩家排名统计', 40, currentY);
  currentY += 40;

  const players = getPlayers();
  const playerData = [];

  players.forEach(player => {
    const stats = playerStats[player.id];
    if (stats && stats.games > 0) {
      playerData.push({
        player,
        stats,
        avgRank: stats.totalRank / stats.games
      });
    }
  });

  playerData.sort((a, b) => {
    if (a.player.team !== b.player.team) {
      return (a.player.team || 999) - (b.player.team || 999);
    }
    return a.avgRank - b.avgRank;
  });

  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#b4b8bf';
  ctx.fillText('玩家', 50, currentY);
  ctx.fillText('场次', 220, currentY);
  ctx.fillText('平均', 300, currentY);
  ctx.fillText('第一', 380, currentY);
  ctx.fillText('垫底', 460, currentY);
  currentY += 35;

  ctx.font = '18px Arial';
  playerData.forEach(data => {
    const { player, stats, avgRank } = data;
    const teamColor = player.team === 1 ? config.getTeamColor('t1') : config.getTeamColor('t2');

    ctx.fillStyle = teamColor + '15';
    ctx.fillRect(30, currentY - 25, W - 60, 35);

    ctx.fillStyle = teamColor;
    ctx.fillText(`${player.emoji}${player.name}`, 50, currentY);

    ctx.fillStyle = '#f5f6f8';
    ctx.fillText(stats.games, 230, currentY);
    ctx.fillText(avgRank.toFixed(2), 300, currentY);
    ctx.fillText(stats.firstPlaceCount || 0, 390, currentY);
    ctx.fillText(stats.lastPlaceCount || 0, 470, currentY);

    currentY += 40;
  });

  currentY += 40;

  // === VIEWER VOTES (read from DOM) ===
  const mvpStatsTable = document.getElementById('mvpStatsTable');
  const burdenStatsTable = document.getElementById('burdenStatsTable');

  if (mvpStatsTable && mvpStatsTable.textContent && !mvpStatsTable.textContent.includes('暂无')) {
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#f5f6f8';
    ctx.fillText('🗳️ 观众投票', 40, currentY);
    currentY += 40;

    // MVP votes (parse from DOM)
    ctx.font = '18px Arial';
    ctx.fillStyle = '#22c55e';
    ctx.fillText('MVP:', 40, currentY);
    currentY += 30;

    ctx.font = '14px Arial';
    ctx.fillStyle = '#b4b8bf';
    const mvpText = mvpStatsTable.textContent.trim();
    if (mvpText && mvpText !== '暂无数据') {
      // Simple display
      ctx.fillText(mvpText, 60, currentY);
      currentY += 60;
    }

    // Burden votes
    if (burdenStatsTable && burdenStatsTable.textContent && !burdenStatsTable.textContent.includes('暂无')) {
      ctx.font = '18px Arial';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('最闹:', 40, currentY);
      currentY += 30;

      ctx.font = '14px Arial';
      ctx.fillStyle = '#b4b8bf';
      const burdenText = burdenStatsTable.textContent.trim();
      if (burdenText && burdenText !== '暂无数据') {
        ctx.fillText(burdenText, 60, currentY);
        currentY += 60;
      }
    }

    currentY += 20;
  }

  // === GAME HISTORY ===
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#f5f6f8';
  ctx.fillText('📜 比赛历史', 40, currentY);
  currentY += 40;

  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#e6b800';
  ctx.fillText('#', 50, currentY);
  ctx.fillText('组合', 100, currentY);
  ctx.fillText('升级', 220, currentY);
  ctx.fillText('胜队', 320, currentY);
  ctx.fillText('级牌', 420, currentY);
  currentY += 35;

  ctx.font = '14px Arial';
  history.forEach((h, i) => {
    const winColor = h.winKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');

    ctx.fillStyle = winColor + '15';
    ctx.fillRect(30, currentY - 25, W - 60, 80);

    ctx.fillStyle = '#e6b800';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${i + 1}`, 50, currentY);

    ctx.fillStyle = '#f5f6f8';
    ctx.font = '14px Arial';
    ctx.fillText(h.combo || '', 100, currentY);

    const upgradeText = h.up ? `${h.win}升${h.up}级` : '不升级';
    ctx.fillText(upgradeText, 220, currentY);

    ctx.fillStyle = winColor;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(h.win, 320, currentY);

    ctx.fillStyle = '#999';
    ctx.font = '13px Arial';
    ctx.fillText(`${h.t1}|${h.t2}`, 420, currentY);
    currentY += 25;

    // Player rankings
    if (h.playerRankings) {
      ctx.fillStyle = '#b4b8bf';
      ctx.font = '12px Arial';

      const rankingText = Object.keys(h.playerRankings)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(rank => {
          const p = h.playerRankings[rank];
          return `${rank}.${p.emoji}${p.name}`;
        })
        .join(' ');

      // Wrap text if too long
      const maxWidth = W - 80;
      const words = rankingText.split(' ');
      let line = '';
      let lineCount = 0;

      for (let w = 0; w < words.length; w++) {
        const testLine = line + words[w] + ' ';
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && line) {
          ctx.fillText(line, 50, currentY);
          line = words[w] + ' ';
          currentY += 18;
          lineCount++;
          if (lineCount >= 2) break; // Max 2 lines
        } else {
          line = testLine;
        }
      }

      if (line) {
        ctx.fillText(line, 50, currentY);
        currentY += 18;
      }
    }

    currentY += 25;
  });

  const finalContentY = currentY + 30;

  // Footer
  ctx.fillStyle = '#666';
  ctx.font = '12px Arial';
  ctx.fillText('闹麻家族掼蛋计分器 - 手机版 v9.0', 40, finalContentY);

  // Create optimally-sized final canvas
  const optimalHeight = finalContentY + 50;
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = W;
  finalCanvas.height = optimalHeight;
  const finalCtx = finalCanvas.getContext('2d');

  // Copy content
  finalCtx.drawImage(canvas, 0, 0, W, optimalHeight, 0, 0, W, optimalHeight);

  // Download
  const a = document.createElement('a');
  a.href = finalCanvas.toDataURL('image/png');
  a.download = '掼蛋战绩_手机版_v9.png';
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
