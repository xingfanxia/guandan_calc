/**
 * Honors System - Working honors with clickable explanations
 * Redesigned for 5-10 game threshold with dynamic updates
 */

import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';

/**
 * Calculate variance
 */
function calculateVariance(rankings) {
  if (!rankings || rankings.length === 0) return 0;

  const mean = rankings.reduce((sum, val) => sum + val, 0) / rankings.length;
  const squaredDiffs = rankings.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / rankings.length;
}

/**
 * Calculate improvement (first half vs second half)
 */
function calculateImprovementScore(rankings) {
  if (rankings.length < 6) return 0;

  const third = Math.floor(rankings.length / 3);
  const early = rankings.slice(0, third);
  const late = rankings.slice(-third);

  const earlyAvg = early.reduce((sum, r) => sum + r, 0) / early.length;
  const lateAvg = late.reduce((sum, r) => sum + r, 0) / late.length;

  return earlyAvg - lateAvg; // Positive = improvement
}

/**
 * Calculate honors
 */
export function calculateHonors(totalPlayers = 8) {
  const players = getPlayers();
  const allStats = state.getPlayerStats();

  const honors = {};

  const eligible = players.filter(p => {
    const stats = allStats[p.id];
    return stats && stats.games >= 5;
  });

  if (eligible.length === 0) return honors;

  // Simple honors
  let maxFirst = 0, maxLast = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];

    // 吕布
    if (stats.firstPlaceCount > maxFirst) {
      maxFirst = stats.firstPlaceCount;
      honors.mvp = { player, score: stats.firstPlaceCount };
    }

    // 阿斗
    if (stats.lastPlaceCount > maxLast) {
      maxLast = stats.lastPlaceCount;
      honors.burden = { player, score: stats.lastPlaceCount };
    }
  });

  // Variance-based
  let minVar = Infinity, maxVar = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    if (!stats.rankings || stats.rankings.length < 5) return;

    const variance = calculateVariance(stats.rankings);
    const avgRank = stats.totalRank / stats.games;

    // 石佛 (stable + good)
    if (avgRank <= 4.5 && variance < 4.5 && variance < minVar) {
      minVar = variance;
      honors.stable = { player, score: variance.toFixed(2) };
    }

    // 波动王
    if (variance > 2.5 && variance > maxVar) {
      maxVar = variance;
      honors.rollercoaster = { player, score: variance.toFixed(2) };
    }
  });

  // Improvement
  let maxImp = -Infinity;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    if (!stats.rankings || stats.rankings.length < 8) return;

    const imp = calculateImprovementScore(stats.rankings);

    if (imp > 1.0 && imp > maxImp) {
      maxImp = imp;
      honors.comeback = { player, score: `+${imp.toFixed(1)}` };
    }
  });

  // Crash count
  let maxCrash = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let crashes = 0;

    for (let i = 1; i < stats.rankings.length; i++) {
      if (stats.rankings[i - 1] <= 3 && stats.rankings[i] === totalPlayers) {
        crashes++;
      }
    }

    if (crashes > maxCrash) {
      maxCrash = crashes;
      honors.fanche = { player, score: crashes };
    }
  });

  // Grand slam
  let maxComplete = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const unique = new Set(stats.rankings);
    const rate = unique.size / totalPlayers;

    if (rate > maxComplete) {
      maxComplete = rate;
      honors.complete = { player, score: `${unique.size}/${totalPlayers}` };
    }
  });

  // Win streak
  let maxStreak = 0;
  const mid = Math.ceil(totalPlayers / 2);

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let streak = 0, best = 0;

    stats.rankings.forEach(r => {
      if (r <= mid) {
        streak++;
        best = Math.max(best, streak);
      } else {
        streak = 0;
      }
    });

    if (best >= 3 && best > maxStreak) {
      maxStreak = best;
      honors.streak = { player, score: best };
    }
  });

  // Median player
  const midRank = (totalPlayers + 1) / 2;
  let minDev = Infinity;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avg = stats.totalRank / stats.games;
    const dev = Math.abs(avg - midRank);

    if (dev < minDev) {
      minDev = dev;
      honors.median = { player, score: avg.toFixed(2) };
    }
  });

  // Frequent changes
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

  // 鲤鱼王 (Comeback King) - Bottom 3 to #1 in consecutive games
  let maxLeaps = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let leaps = 0;

    for (let i = 1; i < stats.rankings.length; i++) {
      const prevRank = stats.rankings[i - 1];
      const currRank = stats.rankings[i];

      // From bottom 3 to #1
      if (prevRank >= totalPlayers - 2 && currRank === 1) {
        leaps++;
      }
    }

    if (leaps > maxLeaps && leaps > 0) {
      maxLeaps = leaps;
      honors.carp = { player, score: leaps };
    }
  });

  // 不粘锅 (Non-stick) - 0 last places, lowest average (best who never hit bottom)
  let bestNonstick = Infinity;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avgRank = stats.totalRank / stats.games;

    if (stats.lastPlaceCount === 0 && avgRank < bestNonstick && stats.games >= 5) {
      bestNonstick = avgRank;
      honors.nonstick = { player, score: avgRank.toFixed(2) };
    }
  });

  // 燃尽王 (Burnout) - Longest consecutive streak in bottom 4
  let maxBurnout = 0;
  const bottomThreshold = Math.ceil(totalPlayers * 0.5); // Bottom half

  eligible.forEach(player => {
    const stats = allStats[player.id];
    let currentStreak = 0;
    let longestStreak = 0;

    stats.rankings.forEach(rank => {
      if (rank > bottomThreshold) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    if (longestStreak >= 3 && longestStreak > maxBurnout) {
      maxBurnout = longestStreak;
      honors.burnout = { player, score: longestStreak };
    }
  });

  // 棋差一着 (Almost There) - Best average rank among those who never got 1st place
  let bestAlmost = Infinity;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avgRank = stats.totalRank / stats.games;

    // Must have 0 first places and at least 5 games
    if (stats.firstPlaceCount === 0 && stats.games >= 5 && avgRank < bestAlmost) {
      bestAlmost = avgRank;
      honors.almost = { player, score: avgRank.toFixed(2) };
    }
  });

  // 赌徒 (Gambler) - High first rate + high last rate (risky player)
  let maxGamblerScore = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];

    // Must have at least 1 first AND 1 last place to be a "gambler"
    if (stats.firstPlaceCount > 0 && stats.lastPlaceCount > 0) {
      const firstRate = stats.firstPlaceCount / stats.games;
      const lastRate = stats.lastPlaceCount / stats.games;

      // Gambler score: rewards having BOTH extremes
      // Use geometric mean to require balance of both
      const gamblerScore = Math.sqrt(firstRate * lastRate) * (stats.firstPlaceCount + stats.lastPlaceCount);

      if (gamblerScore > maxGamblerScore) {
        maxGamblerScore = gamblerScore;
        honors.gambler = {
          player,
          score: `${stats.firstPlaceCount}冠${stats.lastPlaceCount}末`
        };
      }
    }
  });

  // 🤡 (Clown) - Worst average rank among those who never got 1st place
  let worstClown = 0;

  eligible.forEach(player => {
    const stats = allStats[player.id];
    const avgRank = stats.totalRank / stats.games;

    // Must have 0 first places and at least 5 games, find WORST (highest) average
    if (stats.firstPlaceCount === 0 && stats.games >= 5 && avgRank > worstClown) {
      worstClown = avgRank;
      honors.clown = { player, score: avgRank.toFixed(2) };
    }
  });

  return honors;
}

/**
 * Render honors
 */
export function renderHonors() {
  const honors = calculateHonors(getPlayers().length);

  updateHonorDisplay('lyubu', honors.mvp, '吕布');
  updateHonorDisplay('adou', honors.burden, '阿斗');
  updateHonorDisplay('shifo', honors.stable, '石佛');
  updateHonorDisplay('bodongwang', honors.rollercoaster, '波动王');
  updateHonorDisplay('fendouwang', honors.comeback, '奋斗王');
  updateHonorDisplay('fanchewang', honors.fanche, '翻车王');
  updateHonorDisplay('damanguan', honors.complete, '大满贯');
  updateHonorDisplay('lianshengewang', honors.streak, '连胜王');
  updateHonorDisplay('foxiwanjia', honors.median, '佛系玩家');
  updateHonorDisplay('shandianxia', honors.frequent, '闪电侠');
  updateHonorDisplay('liyuwang', honors.carp, '鲤鱼王');
  updateHonorDisplay('buzhanguo', honors.nonstick, '不粘锅');
  updateHonorDisplay('ranjinwang', honors.burnout, '燃尽王');
  updateHonorDisplay('qichayizhao', honors.almost, '棋差一着');
  updateHonorDisplay('dutu', honors.gambler, '赌徒');
  updateHonorDisplay('xiaochou', honors.clown, '🤡');
}

/**
 * Update display with click explanation
 */
function updateHonorDisplay(elementId, honorData, honorName) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (honorData?.player) {
    const p = honorData.player;
    const stats = state.getPlayerStats()[p.id];

    el.innerHTML = `${p.emoji}${p.name}`;
    el.style.color = '#fff';
    el.style.fontWeight = 'bold';
    el.style.cursor = 'pointer';

    // Build explanation
    let msg = `${honorName}\n\n${p.emoji} ${p.name}\n\n`;

    const avgRank = (stats.totalRank / stats.games).toFixed(2);

    if (elementId === 'lyubu') {
      msg += `🥇 ${stats.firstPlaceCount}次第一 (${stats.games}场)\n胜率: ${(stats.firstPlaceCount / stats.games * 100).toFixed(1)}%\n\n最强战力！`;
    } else if (elementId === 'adou') {
      msg += `😅 ${stats.lastPlaceCount}次垫底 (${stats.games}场)\n垫底率: ${(stats.lastPlaceCount / stats.games * 100).toFixed(1)}%\n\n需要保护！`;
    } else if (elementId === 'shifo') {
      msg += `平均${avgRank}名\n方差: ${honorData.score}\n\n稳如泰山！`;
    } else if (elementId === 'bodongwang') {
      msg += `方差: ${honorData.score}\n${Math.min(...stats.rankings)}名→${Math.max(...stats.rankings)}名\n\n波动最大！`;
    } else if (elementId === 'fendouwang') {
      msg += `进步: ${honorData.score}个位次\n\n越战越勇！`;
    } else if (elementId === 'fanchewang') {
      msg += `翻车: ${honorData.score}次\n\n大起大落！`;
    } else if (elementId === 'damanguan') {
      msg += `${honorData.score}个排名\n\n见多识广！`;
    } else if (elementId === 'lianshengewang') {
      msg += `连胜: ${honorData.score}局\n\n状态火热！`;
    } else if (elementId === 'foxiwanjia') {
      msg += `平均${honorData.score}名\n\n佛系心态！`;
    } else if (elementId === 'shandianxia') {
      msg += `变化: ${honorData.score}次\n\n捉摸不定！`;
    } else if (elementId === 'liyuwang') {
      msg += `🐟 鲤鱼跃龙门: ${honorData.score}次\n从倒数3跳到第1名\n\n惊天逆转！`;
    } else if (elementId === 'buzhanguo') {
      msg += `🍳 从未垫底！\n平均${honorData.score}名\n\n不沾坏运气！`;
    } else if (elementId === 'ranjinwang') {
      msg += `🔥 连续${honorData.score}局后半段\n持续低迷\n\n需要充电！`;
    } else if (elementId === 'qichayizhao') {
      msg += `🎯 从未拿过第一\n但平均${honorData.score}名\n\n差一点就登顶！`;
    } else if (elementId === 'dutu') {
      msg += `🎲 ${honorData.score}\n大起大落的高风险玩家\n\n要么第一，要么垫底！`;
    } else if (elementId === 'xiaochou') {
      msg += `🤡 从未拿过第一\n平均${honorData.score}名（最差）\n\n继续努力！`;
    }

    el.onclick = () => alert(msg);
    el.title = '点击查看详情';

  } else {
    el.textContent = '—';
    el.style.color = '#999';
    el.style.cursor = 'default';
    el.onclick = null;
  }
}
