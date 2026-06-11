/**
 * Mobile PNG Export
 * Exports game data as mobile-optimized long image
 */

import { $, now } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { getPlayers, getPlayersByTeam, normalizeTeamNumber } from '../player/playerManager.js';
import { resolveAvatarPhoto } from '../player/photoRenderer.js';
import { readOptionalJsonResponse } from '../api/httpResponse.js';
import { findMVPAndBurden } from '../stats/mvpBurden.js';
import { getActiveThemePalette } from '../themes/_shared/themePalette.js';
import { getRoomInfo } from '../share/roomManager.js';
import { findPlayerByVoteId, normalizeVoteApiResults } from '../share/voteResults.js';
import { EXPORT_FILE_SUFFIX, EXPORT_VERSION_LABEL } from './exportVersion.js';
import {
  getHistoryWinnerKey,
  getHistoryWinnerName,
  isVictoryEntry
} from './historyEntryDisplay.js';
import {
  buildHonorExportRows,
  calculateHonorsFromData,
  resolveHonorPlayerCount
} from '../stats/honors.js';

function resolveExportHonorPlayerCount(players, history) {
  const currentMode = typeof document !== 'undefined'
    ? document.getElementById('mode')?.value
    : undefined;
  const latestMode = history.length > 0 ? history[history.length - 1]?.mode : undefined;
  return resolveHonorPlayerCount(currentMode || latestMode, players.length);
}

function rankCountForHistory(entry) {
  return resolveHonorPlayerCount(entry?.mode, 8);
}

/**
 * Load image from base64 data URL
 * @param {string} dataUrl - Base64 data URL
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Draw player avatar (photo or emoji) to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} player - Player object
 * @param {number} x - X position
 * @param {number} y - Y position (baseline for text, or center for image)
 * @param {number} size - Size for photo (ignored for emoji)
 */
async function drawPlayerAvatar(ctx, player, x, y, size = 40, borderColor = '#444444') {
  const avatarPhoto = resolveAvatarPhoto(player);
  if (avatarPhoto) {
    try {
      const img = await loadImage(avatarPhoto);
      
      // Save context
      ctx.save();
      
      // Draw circular photo
      ctx.beginPath();
      ctx.arc(x + size/2, y - size/2, size/2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, x, y - size, size, size);
      
      // Restore and draw border
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x + size/2, y - size/2, size/2, 0, Math.PI * 2);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      return size + 10; // Return width used (photo + margin)
    } catch (error) {
      console.warn('Failed to draw photo, using emoji:', error);
    }
  }
  
  // Fallback to emoji
  ctx.fillText(player.emoji, x, y);
  return 0; // No extra width
}

export async function exportMobilePNG() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Read active theme's palette so the export matches whatever theme the
  // user is looking at — avoids the "Atelier on screen, Broadcast in the
  // exported PNG" disconnect that shipped pre-2026-05-05.
  const palette = getActiveThemePalette();

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
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);

  let currentY = 70;

  // === HEADER ===
  ctx.fillStyle = palette.ink;
  ctx.font = 'bold 48px Arial';
  ctx.fillText('掼蛋战绩总览', 40, currentY);
  currentY += 45;

  // Check if there's an A-level victory
  const latestGame = history.length > 0 ? history[history.length - 1] : null;
  const hasVictory = isVictoryEntry(latestGame);

  if (hasVictory) {
    const winnerKey = getHistoryWinnerKey(latestGame);
    const winnerName = getHistoryWinnerName(latestGame);

    // Show victory team
    ctx.fillStyle = winnerKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');
    ctx.font = 'bold 32px Arial';
    ctx.fillText(`🏆 ${winnerName} A级通关！`, 40, currentY);
    currentY += 50;

    // Show team roster
    const winnerTeam = winnerKey === 't1' ? 1 : 2;
    const teamPlayers = players.filter(p => normalizeTeamNumber(p.team) === winnerTeam);

    ctx.font = '20px Arial';
    ctx.fillStyle = palette.inkDim;
    const roster = teamPlayers.map(p => `${p.emoji}${p.name}`).join(' ');
    ctx.fillText(`冠军队伍: ${roster}`, 40, currentY);
    currentY += 40;

    // Show MVP tagline if available (lowest average ranking)
    let mvpPlayer = null;
    let bestAvg = Infinity;

    teamPlayers.forEach(player => {
      const stats = playerStats[player.id];
      if (stats && stats.games > 0) {
        const avgRank = stats.totalRank / stats.games;
        if (avgRank < bestAvg) {
          bestAvg = avgRank;
          mvpPlayer = player;
        }
      }
    });

    // Fetch current profile data for MVP (with fallback to stored data)
    if (mvpPlayer) {
      const { getPlayerDisplayData } = await import('../api/playerApi.js');
      mvpPlayer = await getPlayerDisplayData(mvpPlayer);
    }

    if (mvpPlayer && mvpPlayer.tagline) {
      // Draw MVP photo centered on its own row (larger)
      const mvpAvatarPhoto = resolveAvatarPhoto(mvpPlayer);
      if (mvpAvatarPhoto) {
        const photoSize = 320;  // 4x larger for prominence
        const photoX = (W - photoSize) / 2;  // Center horizontally
        await drawPlayerAvatar(ctx, mvpPlayer, photoX, currentY + photoSize, photoSize, palette.rule);
        currentY += photoSize + 30;
      }
      
      // Draw MVP text
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = palette.accent;
      ctx.textAlign = 'center';
      ctx.fillText(`MVP ${mvpAvatarPhoto ? '' : mvpPlayer.emoji + ' '}${mvpPlayer.name}`, W/2, currentY);
      currentY += 30;

      ctx.font = 'italic 20px Arial';
      ctx.fillStyle = palette.inkDimmer;
      ctx.fillText(`平均 ${bestAvg.toFixed(2)} 名`, W/2, currentY);
      currentY += 35;

      ctx.font = 'italic 22px Arial';
      ctx.fillStyle = palette.accent;
      ctx.fillText(`"${mvpPlayer.tagline}"`, W/2, currentY);
      currentY += 45;
      
      // Reset text alignment
      ctx.textAlign = 'left';
    }

    // Show session duration
    const sessionDuration = latestGame.sessionDuration || state.getSessionDuration();
    if (sessionDuration > 0) {
      const hours = Math.floor(sessionDuration / 3600);
      const mins = Math.floor((sessionDuration % 3600) / 60);
      const timeStr = hours > 0 ? `${hours}小时${mins}分` : `${mins}分钟`;
      ctx.fillText(`游戏时长: ${timeStr}`, 40, currentY);
      currentY += 40;
    }
  }

  ctx.font = '18px Arial';
  ctx.fillStyle = palette.inkDim;
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
  ctx.fillStyle = palette.ink;
  ctx.fillText('🏆 荣誉提名', 40, currentY);
  currentY += 50;

  // Team MVPs
  const team1Players = getPlayersByTeam(1);
  const team2Players = getPlayersByTeam(2);
  // playerStats already declared at top

  const team1Result = findMVPAndBurden(team1Players, playerStats);
  const team2Result = findMVPAndBurden(team2Players, playerStats);

  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = config.getTeamColor('t1');
  ctx.fillText(config.getTeamName('t1'), 40, currentY);
  currentY += 35;

  ctx.font = '20px Arial';
  ctx.fillStyle = palette.inkDim;
  ctx.fillText(`很C: ${team1Result.mvp ? team1Result.mvp.emoji + team1Result.mvp.name : '—'}`, 60, currentY);
  currentY += 30;
  ctx.fillText(`很闹: ${team1Result.burden ? team1Result.burden.emoji + team1Result.burden.name : '—'}`, 60, currentY);
  currentY += 45;

  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = config.getTeamColor('t2');
  ctx.fillText(config.getTeamName('t2'), 40, currentY);
  currentY += 35;

  ctx.font = '20px Arial';
  ctx.fillStyle = palette.inkDim;
  ctx.fillText(`很C: ${team2Result.mvp ? team2Result.mvp.emoji + team2Result.mvp.name : '—'}`, 60, currentY);
  currentY += 30;
  ctx.fillText(`很闹: ${team2Result.burden ? team2Result.burden.emoji + team2Result.burden.name : '—'}`, 60, currentY);
  currentY += 50;

  // Special honors
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = palette.ink;
  ctx.fillText('🎖️ 特殊荣誉', 40, currentY);
  currentY += 45;

  const honorRows = buildHonorExportRows(
    calculateHonorsFromData(
      players,
      playerStats,
      resolveExportHonorPlayerCount(players, history)
    ),
    playerStats
  );

  ctx.font = 'bold 22px Arial';
  honorRows.forEach(honor => {
    ctx.fillStyle = honor.color;
    ctx.fillText(`${honor.glyph}${honor.title}`, 60, currentY);

    ctx.fillStyle = palette.ink;
    ctx.fillText(honor.playerText, 200, currentY);

    ctx.fillStyle = palette.inkDimmer;
    ctx.font = '16px Arial';
    ctx.fillText(`(${honor.metricText})`, 330, currentY);

    ctx.font = 'bold 22px Arial';
    currentY += 40;
  });

  currentY += 60;

  // === PLAYER STATS ===
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = palette.ink;
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
    const teamA = normalizeTeamNumber(a.player.team) || 999;
    const teamB = normalizeTeamNumber(b.player.team) || 999;
    if (teamA !== teamB) {
      return teamA - teamB;
    }
    return a.avgRank - b.avgRank;
  });

  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = palette.inkDim;
  ctx.fillText('玩家', 50, currentY);
  ctx.fillText('场次', 220, currentY);
  ctx.fillText('平均', 300, currentY);
  ctx.fillText('第一', 380, currentY);
  ctx.fillText('垫底', 460, currentY);
  currentY += 35;

  ctx.font = '18px Arial';
  playerData.forEach(data => {
    const { player, stats, avgRank } = data;
    const team = normalizeTeamNumber(player.team);
    const teamColor = team === 1
      ? config.getTeamColor('t1')
      : team === 2
        ? config.getTeamColor('t2')
        : palette.inkDim;

    ctx.fillStyle = teamColor + '15';
    ctx.fillRect(30, currentY - 25, W - 60, 35);

    ctx.fillStyle = teamColor;
    ctx.fillText(`${player.emoji}${player.name}`, 50, currentY);

    ctx.fillStyle = palette.ink;
    ctx.fillText(stats.games, 230, currentY);
    ctx.fillText(avgRank.toFixed(2), 300, currentY);
    ctx.fillText(stats.firstPlaceCount || 0, 390, currentY);
    ctx.fillText(stats.lastPlaceCount || 0, 470, currentY);

    currentY += 40;
  });

  currentY += 40;

  // === VIEWER VOTES (fetch from API for accuracy) ===
  const roomInfo = getRoomInfo();

  if (roomInfo.roomCode) {
    try {
      const response = await fetch(`/api/rooms/vote/${encodeURIComponent(roomInfo.roomCode)}`);
      const voteData = await readOptionalJsonResponse(response);

      if (voteData.success && voteData.votes) {
        const voteResults = normalizeVoteApiResults(voteData);
        const mvpVotes = Object.entries(voteResults.mvp.votes || {})
          .map(([id, count]) => {
            const player = findPlayerByVoteId(getPlayers(), id);
            return player ? { name: player.name, emoji: player.emoji, count } : null;
          })
          .filter(v => v)
          .sort((a, b) => b.count - a.count);

        const burdenVotes = Object.entries(voteResults.burden.votes || {})
          .map(([id, count]) => {
            const player = findPlayerByVoteId(getPlayers(), id);
            return player ? { name: player.name, emoji: player.emoji, count } : null;
          })
          .filter(v => v)
          .sort((a, b) => b.count - a.count);

        if (mvpVotes.length > 0 || burdenVotes.length > 0) {
          ctx.font = 'bold 28px Arial';
          ctx.fillStyle = palette.ink;
          ctx.fillText('🗳️ 观众投票', 40, currentY);
          currentY += 40;

          // MVP votes
          if (mvpVotes.length > 0) {
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = palette.win;
            ctx.fillText('MVP:', 40, currentY);
            currentY += 35;

            ctx.font = '16px Arial';
            ctx.fillStyle = palette.inkDim;

            mvpVotes.forEach(v => {
              ctx.fillText(`${v.emoji} ${v.name}: ${v.count}票`, 60, currentY);
              currentY += 28;
            });

            currentY += 15;
          }

          // Burden votes
          if (burdenVotes.length > 0) {
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = palette.loss;
            ctx.fillText('最闹:', 40, currentY);
            currentY += 35;

            ctx.font = '16px Arial';
            ctx.fillStyle = palette.inkDim;

            burdenVotes.forEach(v => {
              ctx.fillText(`${v.emoji} ${v.name}: ${v.count}票`, 60, currentY);
              currentY += 28;
            });

            currentY += 15;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch vote data for PNG export:', error);
    }
  }

  // === GAME HISTORY ===
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = palette.ink;
  ctx.fillText('📜 比赛历史', 40, currentY);
  currentY += 40;

  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = palette.accent;
  ctx.fillText('#', 50, currentY);
  ctx.fillText('组合', 100, currentY);
  ctx.fillText('升级', 240, currentY);
  ctx.fillText('胜队', 360, currentY);
  ctx.fillText('级牌', 450, currentY);
  currentY += 40;

  history.forEach((h, i) => {
    const winnerKey = getHistoryWinnerKey(h);
    const winnerName = getHistoryWinnerName(h);
    const winColor = winnerKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');

    ctx.fillStyle = winColor + '15';
    ctx.fillRect(30, currentY - 30, W - 60, 95);

    ctx.fillStyle = palette.accent;
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`${i + 1}`, 50, currentY);

    ctx.fillStyle = palette.ink;
    ctx.font = '18px Arial';
    ctx.fillText(h.combo || '', 100, currentY);

    const upgradeText = h.up ? `${winnerName}升${h.up}级` : (isVictoryEntry(h) ? `${winnerName}获胜` : '不升级');
    ctx.fillText(upgradeText, 240, currentY);

    ctx.fillStyle = winColor;
    ctx.font = 'bold 18px Arial';
    ctx.fillText(winnerName, 360, currentY);

    ctx.fillStyle = palette.inkDim;
    ctx.font = '17px Arial';
    ctx.fillText(`${h.t1}|${h.t2}`, 450, currentY);
    currentY += 30;

    // Player rankings
    if (h.playerRankings) {
      ctx.fillStyle = palette.inkDim;
      ctx.font = '15px Arial';

      const rankCount = rankCountForHistory(h);
      const rankingText = Array.from({ length: rankCount }, (_, index) => index + 1)
        .filter(rank => h.playerRankings[rank])
        .map(rank => {
          const p = h.playerRankings[rank];
          return `${rank}.${p.emoji || ''}${p.name || ''}`;
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
  ctx.fillStyle = palette.inkDimmer;
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`闹麻家族掼蛋计分器 - 手机版 ${EXPORT_VERSION_LABEL}`, W/2, finalContentY);
  ctx.fillText('Made with ❤️ by Xingfan Xia', W/2, finalContentY + 16);
  ctx.fillText('Claude Sonnet 4.5 1M Context & Claude Opus 4.5', W/2, finalContentY + 32);
  ctx.textAlign = 'left';

  // Create optimally-sized final canvas (extra space for 3-line footer)
  const optimalHeight = finalContentY + 80;
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = W;
  finalCanvas.height = optimalHeight;
  const finalCtx = finalCanvas.getContext('2d');

  // Copy content
  finalCtx.drawImage(canvas, 0, 0, W, optimalHeight, 0, 0, W, optimalHeight);

  // Download
  const a = document.createElement('a');
  a.href = finalCanvas.toDataURL('image/png');
  a.download = `掼蛋战绩_手机版_${EXPORT_FILE_SUFFIX}.png`;
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
