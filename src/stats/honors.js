/**
 * Honors System - Redesigned with Better Metrics
 * Statistical analysis to identify player achievements
 */

import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';

/**
 * Calculate variance (not std dev - this is variance!)
 */
function calculateVariance(rankings) {
  if (!rankings || rankings.length === 0) return 0;

  const mean = rankings.reduce((sum, val) => sum + val, 0) / rankings.length;
  const squareDiffs = rankings.map(val => Math.pow(val - mean, 2));
  return squareDiffs.reduce((sum, val) => sum + val, 0) / rankings.length;
}

// Alias for compatibility
const stdDev = calculateVariance;

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

  // Filter players with minimum games (lowered to 5 for faster testing)
  const eligible = players.filter(p => {
    const stats = allStats[p.id];
    return stats && stats.games >= 5;
  });

  console.log('Eligible players:', eligible.length, 'out of', players.length);

  if (eligible.length === 0) {
    console.log('No players with 5+ games');
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

  // Calculate Stable (low variance + decent performance) - RELAXED
  const eligibleStable = eligible.filter(p => allStats[p.id].games >= 8);
  let minStdDev = Infinity;

  eligibleStable.forEach(player => {
    const stats = allStats[player.id];
    const variance = calculateVariance(stats.rankings);
    const avgRank = stats.totalRank / stats.games;

    console.log(`石佛 check ${player.name}:`, { avgRank, variance, qualifies: avgRank <= 4.5 && variance < 2.5 });

    // VERY RELAXED: avg 4.5 or better + variance < 4.5
    if (avgRank <= 4.5 && variance < 4.5 && variance < minStdDev) {
      minStdDev = variance;
      honors.stable = { player, score: variance.toFixed(2) };
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

  // Calculate Comeback (improving trend) - RELAXED
  const eligibleTrend = eligible.filter(p => allStats[p.id].games >= 8); // Lowered from 10
  let maxImprovement = -Infinity;

  eligibleTrend.forEach(player => {
    const stats = allStats[player.id];
    const improvement = calculateImprovementScore(stats.rankings);

    if (improvement > 1.0 && improvement > maxImprovement) { // Lowered from 1.5
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

  // Calculate 翻车王 (Dramatic drops) - Top 3 to last place
  let maxDrops = -Infinity;
  eligible.forEach(player => {
    const stats = allStats[player.id];
    let dropCount = 0;

    // Count games where went from top 3 one game to last place next game
    for (let i = 1; i < stats.rankings.length; i++) {
      if (stats.rankings[i - 1] <= 3 && stats.rankings[i] === totalPlayers) {
        dropCount++;
      }
    }

    if (dropCount > maxDrops && dropCount > 0) {
      maxDrops = dropCount;
      honors.fanche = { player, score: dropCount };
    }
  });

  // Calculate 大满贯 (Complete all positions) - Experience all ranks
  let maxCompleteion = 0;
  eligible.forEach(player => {
    const stats = allStats[player.id];
    const uniqueRanks = new Set(stats.rankings);
    const completionRate = uniqueRanks.size / totalPlayers;

    if (completionRate > maxCompleteion) {
      maxCompleteion = completionRate;
      honors.complete = { player, score: `${uniqueRanks.size}/${totalPlayers}` };
    }
  });

  // Calculate 连胜王 (Longest streak) - Consecutive top-half finishes
  let maxStreak = 0;
  const midPoint = Math.ceil(totalPlayers / 2);

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let currentStreak = 0;
    let longestStreak = 0;

    stats.rankings.forEach(rank => {
      if (rank <= midPoint) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    if (longestStreak > maxStreak && longestStreak >= 3) {
      maxStreak = longestStreak;
      honors.streak = { player, score: longestStreak };
    }
  });

  // Calculate 佛系玩家 (Median) - Closest to middle ranking
  const midRank = (totalPlayers + 1) / 2;
  let minDeviation = Infinity;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avgRank = stats.totalRank / stats.games;
    const deviation = Math.abs(avgRank - midRank);

    if (deviation < minDeviation) {
      minDeviation = deviation;
      honors.median = { player, score: avgRank.toFixed(2) };
    }
  });

  // Calculate 慢热王 (Slow start) - Poor start, strong finish (relaxed criteria)
  const eligibleSlowStart = eligible.filter(p => allStats[p.id].games >= 8); // Lowered from 10
  let maxSlowStart = -Infinity;

  eligibleSlowStart.forEach(player => {
    const stats = allStats[player.id];
    const third = Math.floor(stats.rankings.length / 3);
    const earlyAvg = stats.rankings.slice(0, third).reduce((sum, r) => sum + r, 0) / third;
    const lateAvg = stats.rankings.slice(-third).reduce((sum, r) => sum + r, 0) / third;

    const improvement = earlyAvg - lateAvg;

    if (improvement > 1.5 && earlyAvg > midRank && improvement > maxSlowStart) { // Lowered from 2.0
      maxSlowStart = improvement;
      honors.slowStart = { player, score: `+${improvement.toFixed(1)}` };
    }
  });

  // Calculate 闪电侠 (Frequent changes) - Most position changes
  let maxChanges = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let changes = 0;

    for (let i = 1; i < stats.rankings.length; i++) {
      if (stats.rankings[i] !== stats.rankings[i - 1]) {
        changes++;
      }
    }

    if (changes > maxChanges) {
      maxChanges = changes;
      honors.frequent = { player, score: changes };
    }
  });

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
  console.log('Honor details:', {
    totalPlayers,
    playersWithGames: players.filter(p => allStats[p.id]?.games > 0).length,
    minGames: Math.min(...players.map(p => allStats[p.id]?.games || 0).filter(g => g > 0))
  });

  // Update honor elements (match HTML IDs)
  updateHonorDisplay('lyubu', honors.mvp, '🥇 吕布');
  updateHonorDisplay('adou', honors.burden, '😅 阿斗');
  updateHonorDisplay('shifo', honors.stable, '🗿 石佛');
  updateHonorDisplay('bodongwang', honors.rollercoaster, '🌊 波动王');
  updateHonorDisplay('fendouwang', honors.comeback, '📈 奋斗王');
  updateHonorDisplay('fanchewang', honors.fanche, '🎪 翻车王');
  updateHonorDisplay('damanguan', honors.complete, '👑 大满贯'); // Fixed ID
  updateHonorDisplay('lianshengewang', honors.streak, '🔥 连胜王');
  updateHonorDisplay('foxiwanjia', honors.median, '🧘 佛系玩家');
  updateHonorDisplay('manrewang', honors.slowStart || null, '🐌 慢热王');
  updateHonorDisplay('shandianxia', honors.frequent, '⚡ 闪电侠');
  // Hide non-working honors for now
  const hideHonors = ['fuzhuwang', 'shoumenyuan', 'dutu', 'manrewang'];
  hideHonors.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement) {
      el.parentElement.style.display = 'none';
    }
  });
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
    el.innerHTML = `${p.emoji}${p.name} <span style="font-size: 11px; opacity: 0.8;">(${honorData.score})</span>`;
    el.title = `${honorName}: ${p.name} - 得分 ${honorData.score}`;
    el.style.color = '#fff'; // White text for better contrast on colored badges
    el.style.fontWeight = 'bold';
  } else {
    el.textContent = '—';
    el.title = `${honorName}: 暂无数据（需要5+场比赛）`;
    el.style.color = '#999'; // Lighter gray for empty state
    el.style.fontWeight = 'normal';
  }
}
