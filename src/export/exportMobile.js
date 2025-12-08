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
  const players = getPlayers();
  const playerStats = state.getPlayerStats();
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
  // playerStats already declared at top

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

  // Get ALL 13 honors by reading from DOM
  const honorElements = [
    { id: 'lyubu', name: '🥇吕布', desc: '最多第一', color: '#d4af37' },
    { id: 'adou', name: '😅阿斗', desc: '最多垫底', color: '#8b4513' },
    { id: 'shifo', name: '🗿石佛', desc: '最稳定', color: '#708090' },
    { id: 'bodongwang', name: '🌊波动王', desc: '波动最大', color: '#ff4500' },
    { id: 'fendouwang', name: '📈奋斗王', desc: '稳步提升', color: '#32cd32' },
    { id: 'fanchewang', name: '🎪翻车王', desc: '前3掉底', color: '#dc143c' },
    { id: 'damanguan', name: '👑大满贯', desc: '所有排名', color: '#ffd700' },
    { id: 'lianshengewang', name: '🔥连胜王', desc: '连续好排', color: '#ff6347' },
    { id: 'foxiwanjia', name: '🧘佛系', desc: '总是中游', color: '#9370db' },
    { id: 'shandianxia', name: '⚡闪电侠', desc: '变化频繁', color: '#ffa500' },
    { id: 'liyuwang', name: '🐟鲤鱼王', desc: '惊天逆转', color: '#f97316' },
    { id: 'buzhanguo', name: '🍳不粘锅', desc: '不沾底', color: '#10b981' },
    { id: 'ranjinwang', name: '🔥燃尽王', desc: '持续低迷', color: '#b91c1c' }
  ];

  ctx.font = 'bold 22px Arial';
  honorElements.forEach(honor => {
    const el = document.getElementById(honor.id);
    const winnerText = el && el.textContent !== '—' ? el.textContent : '—';

    ctx.fillStyle = honor.color;
    ctx.fillText(honor.name, 60, currentY);

    ctx.fillStyle = '#f5f6f8';
    ctx.fillText(winnerText, 200, currentY);

    ctx.fillStyle = '#888';
    ctx.font = '16px Arial';
    ctx.fillText(`(${honor.desc})`, 330, currentY);

    ctx.font = 'bold 22px Arial';
    currentY += 40;
  });

  currentY += 60;

  // === PLAYER STATS ===
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#f5f6f8';
  ctx.fillText('📊 玩家排名统计', 40, currentY);
  currentY += 40;

  // players already declared at top
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

  // === VIEWER VOTES (parse divs properly) ===
  const mvpStatsTable = document.getElementById('mvpStatsTable');
  const burdenStatsTable = document.getElementById('burdenStatsTable');

  if (mvpStatsTable && mvpStatsTable.children.length > 0) {
    const mvpDivs = Array.from(mvpStatsTable.children);
    const burdenDivs = burdenStatsTable ? Array.from(burdenStatsTable.children) : [];

    if (mvpDivs.length > 0 || burdenDivs.length > 0) {
      ctx.font = 'bold 28px Arial';
      ctx.fillStyle = '#f5f6f8';
      ctx.fillText('🗳️ 观众投票', 40, currentY);
      currentY += 40;

      // MVP votes (parse each div)
      if (mvpDivs.length > 0) {
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#22c55e';
        ctx.fillText('MVP:', 40, currentY);
        currentY += 35;

        ctx.font = '16px Arial';
        ctx.fillStyle = '#b4b8bf';

        mvpDivs.slice(0, 5).forEach(div => {
          const text = div.textContent.trim();
          if (text && text !== '暂无数据') {
            ctx.fillText(text, 60, currentY);
            currentY += 28;
          }
        });

        currentY += 15;
      }

      // Burden votes
      if (burdenDivs.length > 0) {
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('最闹:', 40, currentY);
        currentY += 35;

        ctx.font = '16px Arial';
        ctx.fillStyle = '#b4b8bf';

        burdenDivs.slice(0, 5).forEach(div => {
          const text = div.textContent.trim();
          if (text && text !== '暂无数据') {
            ctx.fillText(text, 60, currentY);
            currentY += 28;
          }
        });

        currentY += 15;
      }

      currentY += 20;
    }
  }

  // === GAME HISTORY ===
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#f5f6f8';
  ctx.fillText('📜 比赛历史', 40, currentY);
  currentY += 40;

  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#e6b800';
  ctx.fillText('#', 50, currentY);
  ctx.fillText('组合', 100, currentY);
  ctx.fillText('升级', 240, currentY);
  ctx.fillText('胜队', 360, currentY);
  ctx.fillText('级牌', 450, currentY);
  currentY += 40;

  history.forEach((h, i) => {
    const winColor = h.winKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');

    ctx.fillStyle = winColor + '15';
    ctx.fillRect(30, currentY - 30, W - 60, 95);

    ctx.fillStyle = '#e6b800';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`${i + 1}`, 50, currentY);

    ctx.fillStyle = '#f5f6f8';
    ctx.font = '18px Arial';
    ctx.fillText(h.combo || '', 100, currentY);

    const upgradeText = h.up ? `${h.win}升${h.up}级` : (h.aNote && h.aNote.includes('通关') ? `${h.win}获胜` : '不升级');
    ctx.fillText(upgradeText, 240, currentY);

    ctx.fillStyle = winColor;
    ctx.font = 'bold 18px Arial';
    ctx.fillText(h.win, 360, currentY);

    ctx.fillStyle = '#aaa';
    ctx.font = '17px Arial';
    ctx.fillText(`${h.t1}|${h.t2}`, 450, currentY);
    currentY += 30;

    // Player rankings
    if (h.playerRankings) {
      ctx.fillStyle = '#b4b8bf';
      ctx.font = '15px Arial';

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
          currentY += 22;
          lineCount++;
          if (lineCount >= 2) break; // Max 2 lines
        } else {
          line = testLine;
        }
      }

      if (line) {
        ctx.fillText(line, 50, currentY);
        currentY += 22;
      }
    }

    currentY += 30;
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
