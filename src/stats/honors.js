/**
 * Honors System - EXACT REPLICATION of original calculations
 * Based on original statsManager.js logic
 */

import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';

/**
 * Calculate variance - ORIGINAL ALGORITHM
 */
function calculateVariance(rankings) {
  if (rankings.length < 2) return 0;

  const mean = rankings.reduce((sum, rank) => sum + rank, 0) / rankings.length;
  const squaredDiffs = rankings.map(rank => Math.pow(rank - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / rankings.length;
}

/**
 * Calculate improvement - ORIGINAL ALGORITHM
 */
function calculateImprovement(rankings) {
  if (rankings.length < 4) return 0;

  const mid = Math.floor(rankings.length / 2);
  const firstHalf = rankings.slice(0, mid);
  const secondHalf = rankings.slice(mid);

  const firstAvg = firstHalf.reduce((sum, rank) => sum + rank, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, rank) => sum + rank, 0) / secondHalf.length;

  // Lower rank = better, so firstAvg - secondAvg = improvement
  return firstAvg - secondAvg;
}

/**
 * Count support wins - ORIGINAL ALGORITHM
 */
function countSupportWins(player, totalPlayers) {
  const history = state.getHistory();
  if (!history || history.length === 0) return 0;

  let supportWins = 0;
  const lastPlace = totalPlayers;

  history.forEach(game => {
    if (game.playerRankings && game.winKey) {
      const playerTeam = player.team;
      const winnerTeamNumber = game.winKey === 't1' ? 1 : 2;

      if (playerTeam === winnerTeamNumber) {
        // Team won, check if this player finished last
        for (const rank in game.playerRankings) {
          const rankedPlayer = game.playerRankings[rank];
          if (rankedPlayer.id === player.id && parseInt(rank) === lastPlace) {
            supportWins++;
            break;
          }
        }
      }
    }
  });

  return supportWins;
}

/**
 * Find special honors - EXACT ORIGINAL ALGORITHM
 */
export function calculateHonors(totalPlayers = 8) {
  const players = getPlayers();
  const allStats = state.getPlayerStats();

  const honors = {
    mvp: null,          // 吕布
    burden: null,       // 阿斗
    stable: null,       // 石佛
    rollercoaster: null, // 波动王
    comeback: null,     // 奋斗王
    teamPillar: null    // 辅助王
  };

  let maxFirstPlace = 0;
  let maxLastPlace = 0;
  let minVariance = 999;
  let maxVariance = 0;
  let maxImprovement = -999;
  let maxSupportWins = 0;

  players.forEach(player => {
    const stats = allStats[player.id];

    if (stats && stats.games >= 3) { // Minimum 3 games
      // 吕布 - Most first places
      const firstPlaceCount = stats.firstPlaceCount || 0;
      if (firstPlaceCount > maxFirstPlace) {
        maxFirstPlace = firstPlaceCount;
        honors.mvp = { player, score: firstPlaceCount };
      }

      // 阿斗 - Most last places
      const lastPlaceCount = stats.lastPlaceCount || 0;
      if (lastPlaceCount > maxLastPlace) {
        maxLastPlace = lastPlaceCount;
        honors.burden = { player, score: lastPlaceCount };
      }

      // Calculate variance and improvement
      if (stats.rankings && stats.rankings.length >= 3) {
        const variance = calculateVariance(stats.rankings);

        // 石佛 - Most stable (lowest variance)
        if (variance < minVariance) {
          minVariance = variance;
          honors.stable = { player, score: variance.toFixed(2) };
        }

        // 波动王 - Most volatile (highest variance)
        if (variance > maxVariance) {
          maxVariance = variance;
          honors.rollercoaster = { player, score: variance.toFixed(2) };
        }

        // 奋斗王 - Best improvement trend
        const improvement = calculateImprovement(stats.rankings);
        if (improvement > maxImprovement) {
          maxImprovement = improvement;
          honors.comeback = { player, score: `+${improvement.toFixed(2)}` };
        }
      }

      // 辅助王 - Team wins while finishing last
      const supportWins = countSupportWins(player, totalPlayers);
      if (supportWins > maxSupportWins) {
        maxSupportWins = supportWins;
        honors.teamPillar = { player, score: supportWins };
      }
    }
  });

  return honors;
}

/**
 * Render honors display - ORIGINAL VERSION (6 honors only)
 */
export function renderHonors() {
  const totalPlayers = getPlayers().length;
  const honors = calculateHonors(totalPlayers);

  console.log('Calculated honors (original algorithm):', honors);

  // Update honor elements - ORIGINAL 6 HONORS
  updateHonorDisplay('lyubu', honors.mvp, '🥇 吕布');
  updateHonorDisplay('adou', honors.burden, '😅 阿斗');
  updateHonorDisplay('shifo', honors.stable, '🗿 石佛');
  updateHonorDisplay('bodongwang', honors.rollercoaster, '🌊 波动王');
  updateHonorDisplay('fendouwang', honors.comeback, '📈 奋斗王');
  updateHonorDisplay('fuzhuwang', honors.teamPillar, '🛡️ 辅助王');

  // Extra honors from HTML (not in original, set to null)
  updateHonorDisplay('fanchewang', null, '🎪 翻车王');
  updateHonorDisplay('damanguan', null, '👑 大满贯');
  updateHonorDisplay('lianshengewang', null, '🔥 连胜王');
  updateHonorDisplay('foxiwanjia', null, '🧘 佛系玩家');
  updateHonorDisplay('shoumenyuan', null, '🛡️ 守门员');
  updateHonorDisplay('manrewang', null, '🐌 慢热王');
  updateHonorDisplay('pilaowang', null, '📉 疲劳选手');
  updateHonorDisplay('shandianxia', null, '⚡ 闪电侠');
}

/**
 * Update individual honor display
 */
function updateHonorDisplay(elementId, honorData, honorName) {
  const el = document.getElementById(elementId);

  if (!el) {
    console.warn(`Element #${elementId} not found`);
    return;
  }

  if (honorData && honorData.player) {
    const p = honorData.player;
    el.innerHTML = `${p.emoji}${p.name} <span style="font-size: 11px; opacity: 0.8;">(${honorData.score})</span>`;
    el.title = `${honorName}: ${p.name} - 得分 ${honorData.score}`;
    el.style.color = '#fff';
    el.style.fontWeight = 'bold';
  } else {
    el.textContent = '—';
    el.title = `${honorName}: 暂无数据（需要3+场比赛）`;
    el.style.color = '#999';
    el.style.fontWeight = 'normal';
  }
}
