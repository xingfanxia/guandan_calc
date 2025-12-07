/**
 * Honors System - Redesigned with Better Metrics
 * Statistical analysis to identify player achievements
 */

import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';

/**
 * Calculate standard deviation
 */
function stdDev(arr) {
  if (!arr || arr.length === 0) return 0;

  const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
  const squareDiffs = arr.map(val => Math.pow(val - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / arr.length;

  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate MVP score (weighted performance)
 */
function calculateMVPScore(stats) {
  const firstPlaces = stats.firstPlaceCount || 0;
  const lastPlaces = stats.lastPlaceCount || 0;
  const avgRank = stats.totalRank / stats.games;

  // Top 3 finishes (ranks 1, 2, 3)
  const top3Count = stats.rankings.filter(r => r <= 3).length;

  return (firstPlaces * 3) + (top3Count * 1) - (lastPlaces * 2) - (avgRank * 0.5);
}

/**
 * Calculate burden score (reverse weighted)
 */
function calculateBurdenScore(stats, totalPlayers) {
  const lastPlaces = stats.lastPlaceCount || 0;
  const firstPlaces = stats.firstPlaceCount || 0;
  const avgRank = stats.totalRank / stats.games;

  // Bottom 3 finishes
  const bottom3Count = stats.rankings.filter(r => r >= totalPlayers - 2).length;

  return (lastPlaces * 3) + (bottom3Count * 1) - (firstPlaces * 2) + (avgRank * 0.5);
}

/**
 * Calculate improvement trend score
 */
function calculateImprovementScore(rankings) {
  if (rankings.length < 15) return 0;

  const third = Math.floor(rankings.length / 3);
  const early = rankings.slice(0, third);
  const late = rankings.slice(-third);

  const earlyAvg = early.reduce((sum, r) => sum + r, 0) / early.length;
  const lateAvg = late.reduce((sum, r) => sum + r, 0) / late.length;

  // Positive score = improvement (lower rank is better, so early - late)
  return earlyAvg - lateAvg;
}

/**
 * Calculate all honors
 * @param {number} totalPlayers - Total players in game
 * @returns {Object} Honor assignments
 */
export function calculateHonors(totalPlayers = 8) {
  const players = getPlayers();
  const allStats = state.getPlayerStats();

  const honors = {
    mvp: null,
    burden: null,
    stable: null,
    rollercoaster: null,
    comeback: null,
    fatigue: null,
    teamPillar: null,
    clutch: null
  };

  // Filter players with minimum games
  const eligible = players.filter(p => {
    const stats = allStats[p.id];
    return stats && stats.games >= 10;
  });

  if (eligible.length === 0) {
    return honors; // No one eligible
  }

  // Calculate MVP
  let maxMVP = -Infinity;
  eligible.forEach(player => {
    const stats = allStats[player.id];
    const score = calculateMVPScore(stats);

    if (score > maxMVP) {
      maxMVP = score;
      honors.mvp = { player, score: score.toFixed(1) };
    }
  });

  // Calculate Burden
  let maxBurden = -Infinity;
  eligible.forEach(player => {
    const stats = allStats[player.id];
    const score = calculateBurdenScore(stats, totalPlayers);

    if (score > maxBurden) {
      maxBurden = score;
      honors.burden = { player, score: score.toFixed(1) };
    }
  });

  // Calculate Stable (low std dev + middle range)
  const eligibleStable = eligible.filter(p => allStats[p.id].games >= 15);
  let minStdDev = Infinity;

  eligibleStable.forEach(player => {
    const stats = allStats[player.id];
    const sd = stdDev(stats.rankings);
    const avgRank = stats.totalRank / stats.games;
    const middleRange = totalPlayers * 0.35 <= avgRank && avgRank <= totalPlayers * 0.65;

    if (sd < minStdDev && sd < 1.5 && middleRange) {
      minStdDev = sd;
      honors.stable = { player, score: sd.toFixed(2) };
    }
  });

  // Calculate Rollercoaster (high variance + extremes)
  let maxVariance = -Infinity;

  eligibleStable.forEach(player => {
    const stats = allStats[player.id];
    const sd = stdDev(stats.rankings);
    const hasFirst = stats.firstPlaceCount > 0;
    const hasLast = stats.lastPlaceCount > 0;

    if (sd > 2.5 && hasFirst && hasLast && sd > maxVariance) {
      maxVariance = sd;
      honors.rollercoaster = { player, score: sd.toFixed(2) };
    }
  });

  // Calculate Comeback (improving trend)
  const eligibleTrend = eligible.filter(p => allStats[p.id].games >= 20);
  let maxImprovement = -Infinity;

  eligibleTrend.forEach(player => {
    const stats = allStats[player.id];
    const improvement = calculateImprovementScore(stats.rankings);

    if (improvement > 1.5 && improvement > maxImprovement) {
      maxImprovement = improvement;
      honors.comeback = { player, score: `+${improvement.toFixed(1)}` };
    }
  });

  // Calculate Fatigue (declining trend)
  let maxDecline = -Infinity;

  eligibleTrend.forEach(player => {
    const stats = allStats[player.id];
    const decline = -calculateImprovementScore(stats.rankings); // Negative improvement

    if (decline > 1.5 && decline > maxDecline) {
      maxDecline = decline;
      honors.fatigue = { player, score: `-${decline.toFixed(1)}` };
    }
  });

  // Team Pillar: Sacrifice during team wins (TODO: needs team win data)
  // Clutch: Better in close games (TODO: needs close game data)

  return honors;
}

/**
 * Render honors display
 */
export function renderHonors() {
  const players = getPlayers();
  const totalPlayers = players.length;
  const allStats = state.getPlayerStats();

  console.log('Rendering honors:', {
    totalPlayers,
    playersWithStats: Object.keys(allStats).length,
    sampleStats: allStats[1]
  });

  const honors = calculateHonors(totalPlayers);

  console.log('Calculated honors:', honors);

  // Update honor elements
  updateHonorDisplay('lyubu', honors.mvp, '🥇 MVP王');
  updateHonorDisplay('adou', honors.burden, '😅 拖油瓶');
  updateHonorDisplay('shifo', honors.stable, '🗿 稳如泰山');
  updateHonorDisplay('bodong', honors.rollercoaster, '🌊 过山车');
  updateHonorDisplay('fendou', honors.comeback, '📈 逆袭王');
  updateHonorDisplay('pilao', honors.fatigue, '📉 疲劳选手');
  // teamPillar and clutch placeholders
  updateHonorDisplay('fuzhu', null, '🛡️ 团队之光');
  updateHonorDisplay('guanjian', null, '🎯 关键先生');
}

/**
 * Update individual honor display
 */
function updateHonorDisplay(elementId, honorData, honorName) {
  const el = document.getElementById(elementId);

  console.log(`Updating ${elementId}:`, { found: !!el, honorData });

  if (!el) {
    console.warn(`Element #${elementId} not found`);
    return;
  }

  if (honorData && honorData.player) {
    const p = honorData.player;
    el.innerHTML = `${p.emoji}${p.name} <span style="font-size: 11px; opacity: 0.7;">(${honorData.score})</span>`;
    el.title = `${honorName}: ${p.name} - 得分 ${honorData.score}`;
    el.style.color = '#22c55e';
  } else {
    el.textContent = '—';
    el.title = `${honorName}: 暂无数据（需要10+场比赛）`;
    el.style.color = '#666';
  }
}
