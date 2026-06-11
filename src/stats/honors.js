/**
 * Honors System - Working honors with clickable explanations
 * Redesigned for 5-10 game threshold with dynamic updates
 */

import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';
import { getManifest } from '../themes/_shared/themeManager.js';
import { resolvePlayerCountMode } from '../core/playerCountMode.js';
import { resolveAvatarPhoto } from '../player/photoRenderer.js';

const MIN_HONOR_GAMES = 5;

/**
 * Calculate POPULATION variance (divides by N, not N-1).
 *
 * For n=1, the only datapoint equals the mean → variance is 0. That's
 * mathematically correct (no spread in a single observation) but
 * uninformative for volatility honors, where "this player has played one
 * game" should not classify them as stable. Honors globally require at least
 * 5 valid rankings before awarding, which keeps variance-based awards from
 * firing on small samples — DO NOT call calculateVariance from a context that
 * lacks a similar small-sample guard.
 *
 * Population (N) is intentional: we treat each player's session-level
 * rankings as a complete observed history, not a sample drawn from a
 * larger distribution. Bessel's correction (N-1) would be appropriate
 * if we were estimating population variance from a sample, but here
 * "the population" is "this player's actual games to date".
 *
 * @param {number[]} rankings
 * @returns {number} variance (0 if rankings empty/null)
 */
function calculateVariance(rankings) {
  if (!rankings || rankings.length === 0) return 0;

  const mean = rankings.reduce((sum, val) => sum + val, 0) / rankings.length;
  const squaredDiffs = rankings.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / rankings.length;
}

function normalizeRankings(rankings, totalPlayers) {
  if (!Array.isArray(rankings)) return [];

  return rankings
    .map(rank => Number(rank))
    .filter(rank =>
      Number.isSafeInteger(rank) &&
      rank >= 1 &&
      rank <= totalPlayers
    );
}

export function resolveHonorPlayerCount(modeValue, fallbackCount = 8) {
  return resolvePlayerCountMode(modeValue, fallbackCount);
}

function getActiveHonorPlayerCount() {
  const modeValue = typeof document !== 'undefined'
    ? document.getElementById('mode')?.value
    : undefined;
  return resolveHonorPlayerCount(modeValue, getPlayers().length);
}

/**
 * Calculate honors from explicit player/stat data.
 */
export function calculateHonorsFromData(players = [], allStats = {}, totalPlayers = 8) {
  const playerList = Array.isArray(players) ? players : [];
  const statsByPlayer = allStats && typeof allStats === 'object' && !Array.isArray(allStats)
    ? allStats
    : {};

  totalPlayers = resolveHonorPlayerCount(totalPlayers, playerList.length);
  const honors = {};
  const minGames = MIN_HONOR_GAMES;
  const mid = Math.ceil(totalPlayers / 2);
  const midRank = (totalPlayers + 1) / 2;
  const topTierThreshold = Math.max(1, Math.ceil(totalPlayers / 3));
  const bottomTierThreshold = totalPlayers - topTierThreshold + 1;

  function average(values) {
    return values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }

  function resolveTeamNumber(team) {
    const value = Number(team);
    return value === 1 || value === 2 ? value : null;
  }

  const playerRows = playerList
    .map(player => {
      if (!player || typeof player !== 'object') return null;

      const stats = statsByPlayer[player.id];
      const rankings = normalizeRankings(stats?.rankings, totalPlayers);
      return { player, stats, rankings, team: resolveTeamNumber(player.team) };
    })
    .filter(Boolean);

  const eligible = playerRows
    .map(row => {
      const { player, stats, rankings, team } = row;
      if (!stats || rankings.length < minGames) {
        return null;
      }

      const games = rankings.length;
      const totalRank = rankings.reduce((sum, rank) => sum + rank, 0);
      const firstCount = rankings.filter(rank => rank === 1).length;
      const lastCount = rankings.filter(rank => rank === totalPlayers).length;
      const avg = totalRank / games;
      const variance = calculateVariance(rankings);
      const firstRate = firstCount / games;
      const lastRate = lastCount / games;
      const topHalfRate = rankings.filter(rank => rank <= mid).length / games;
      const bottomHalfRate = rankings.filter(rank => rank > mid).length / games;
      const uniqueRanks = new Set(rankings);
      const bestRank = Math.min(...rankings);
      const worstRank = Math.max(...rankings);
      const rankRange = worstRank - bestRank;
      let movement = 0;
      let changes = 0;
      let topHalfStreak = 0;
      let bestTopHalfStreak = 0;
      let bottomHalfStreak = 0;
      let bestBottomHalfStreak = 0;
      let crashes = 0;
      let leaps = 0;
      let pressureRounds = 0;
      let pressureRebounds = 0;

      for (let i = 0; i < rankings.length; i++) {
        const rank = rankings[i];
        if (rank >= bottomTierThreshold) {
          pressureRounds++;
        }

        if (rank <= mid) {
          topHalfStreak++;
          bottomHalfStreak = 0;
        } else {
          bottomHalfStreak++;
          topHalfStreak = 0;
        }
        bestTopHalfStreak = Math.max(bestTopHalfStreak, topHalfStreak);
        bestBottomHalfStreak = Math.max(bestBottomHalfStreak, bottomHalfStreak);

        if (i === 0) continue;
        const prev = rankings[i - 1];
        movement += Math.abs(rank - prev);
        if (rank !== prev) changes++;
        if (prev <= topTierThreshold && rank >= bottomTierThreshold) crashes++;
        if (prev >= bottomTierThreshold && rank <= topTierThreshold) leaps++;
        if (prev >= bottomTierThreshold && rank <= mid) pressureRebounds++;
      }

      let teammateAvgTotal = 0;
      let teammateContextRounds = 0;
      let teammateLeadRounds = 0;
      let supportFloorRounds = 0;
      let teamAvgTotal = 0;
      let opponentAvgTotal = 0;
      let teamContextRounds = 0;
      let teamEdgeRounds = 0;

      if (team !== null) {
        for (let i = 0; i < rankings.length; i++) {
          const rank = rankings[i];
          const teammateRanks = playerRows
            .filter(other => other !== row && other.team === team)
            .map(other => other.rankings[i])
            .filter(Number.isFinite);
          const teamRanks = playerRows
            .filter(other => other.team === team)
            .map(other => other.rankings[i])
            .filter(Number.isFinite);
          const opponentRanks = playerRows
            .filter(other => other.team !== null && other.team !== team)
            .map(other => other.rankings[i])
            .filter(Number.isFinite);

          const teammateRoundAvg = average(teammateRanks);
          if (teammateRoundAvg !== null) {
            teammateContextRounds++;
            teammateAvgTotal += teammateRoundAvg;
            if (rank < teammateRoundAvg) teammateLeadRounds++;
            if (rank <= mid && teammateRoundAvg > mid) supportFloorRounds++;
          }

          const teamRoundAvg = average(teamRanks);
          const opponentRoundAvg = average(opponentRanks);
          if (teamRoundAvg !== null && opponentRoundAvg !== null) {
            teamContextRounds++;
            teamAvgTotal += teamRoundAvg;
            opponentAvgTotal += opponentRoundAvg;
            if (teamRoundAvg < opponentRoundAvg) teamEdgeRounds++;
          }
        }
      }

      const segmentSize = Math.max(2, Math.floor(rankings.length / 3));
      const early = rankings.slice(0, segmentSize);
      const late = rankings.slice(-segmentSize);
      const earlyAvg = early.reduce((sum, rank) => sum + rank, 0) / early.length;
      const lateAvg = late.reduce((sum, rank) => sum + rank, 0) / late.length;
      const improvement = earlyAvg - lateAvg;
      const decline = lateAvg - earlyAvg;
      const lateBottomHalfRate = late.filter(rank => rank > mid).length / late.length;
      const lateLastRate = late.filter(rank => rank === totalPlayers).length / late.length;
      const secondCount = rankings.filter(rank => rank === 2).length;
      const pressureRate = pressureRounds / games;
      const pressureRecoveryRate = pressureRounds > 0 ? pressureRebounds / pressureRounds : 0;
      const sustainedRecoveryRate = Math.max(0, topHalfRate - pressureRate);
      const changeRate = games > 1 ? changes / (games - 1) : 0;
      const teammateAvg = teammateContextRounds > 0 ? teammateAvgTotal / teammateContextRounds : null;
      const teammateDelta = teammateAvg !== null ? teammateAvg - avg : 0;
      const teammateLeadRate = teammateContextRounds > 0 ? teammateLeadRounds / teammateContextRounds : 0;
      const supportFloorRate = teammateContextRounds > 0 ? supportFloorRounds / teammateContextRounds : 0;
      const teamAvg = teamContextRounds > 0 ? teamAvgTotal / teamContextRounds : null;
      const opponentAvg = teamContextRounds > 0 ? opponentAvgTotal / teamContextRounds : null;
      const teamEdgeRate = teamContextRounds > 0 ? teamEdgeRounds / teamContextRounds : 0;
      const dominanceScore = (firstRate * 2.2) + topHalfRate + ((totalPlayers + 1 - avg) / totalPlayers);
      const burdenScore = (lastRate * 2.2) + bottomHalfRate + (avg / totalPlayers);
      const stabilityScore = topHalfRate + ((totalPlayers + 1 - avg) / totalPlayers) - (variance / totalPlayers);
      const volatilityScore = movement + (variance * 2) + rankRange;
      const comebackArcScore = improvement + (leaps * 0.75) +
        (earlyAvg >= bottomTierThreshold && lateAvg <= topTierThreshold ? 2 : 0);
      const burnoutScore = (decline * 2) + (lateBottomHalfRate * 2) +
        lateLastRate + (bestBottomHalfStreak / games);
      const resilienceScore = (pressureRecoveryRate * 4) + (topHalfRate * 2) +
        sustainedRecoveryRate + (Math.min(pressureRebounds, 3) * 0.25) -
        Math.max(0, avg - midRank);
      const fastAttackScore = (topHalfRate * 3) +
        (changeRate * 1.5) +
        (((totalPlayers + 1 - avg) / totalPlayers) * 2) +
        (bestTopHalfStreak / games) +
        Math.max(0, midRank - earlyAvg) -
        (variance / totalPlayers) -
        lastRate;
      const globalImpactScore = dominanceScore +
        (Math.max(0, teammateDelta) * 0.8) +
        (teammateLeadRate * 0.8) +
        (teamEdgeRate * 0.5);
      const globalBurdenScore = burdenScore +
        (Math.max(0, -teammateDelta) * 0.8) +
        ((teammateContextRounds > 0 ? 1 - teammateLeadRate : 0) * 0.35);
      const teamAnchorScore = (Math.max(0, teammateDelta) * 1.4) +
        (teammateLeadRate * 1.2) +
        (supportFloorRate * 1.4) +
        (topHalfRate * 0.8) +
        (teamEdgeRate * 0.5) -
        (variance / totalPlayers) -
        (Math.max(0, avg - midRank) * 0.25);
      const floorCoreScore = (Math.max(0, teammateDelta) * 1.5) +
        (supportFloorRate * 2) +
        (1 - lastRate) +
        ((totalPlayers + 1 - worstRank) / totalPlayers) +
        (teamEdgeRate * 0.5) -
        (Math.max(0, avg - midRank) * 0.2);
      const tempoCoreScore = fastAttackScore +
        (teammateLeadRate * 1.1) +
        (teamEdgeRate * 1.1) +
        (Math.max(0, teammateDelta) * 0.5);

      return {
        player,
        stats,
        rankings,
        games,
        firstCount,
        lastCount,
        avg,
        variance,
        firstRate,
        lastRate,
        topHalfRate,
        bottomHalfRate,
        uniqueRanks,
        bestRank,
        worstRank,
        rankRange,
        movement,
        changes,
        crashes,
        leaps,
        pressureRate,
        pressureRounds,
        pressureRebounds,
        pressureRecoveryRate,
        sustainedRecoveryRate,
        changeRate,
        bestTopHalfStreak,
        bestBottomHalfStreak,
        earlyAvg,
        lateAvg,
        improvement,
        decline,
        lateBottomHalfRate,
        lateLastRate,
        secondCount,
        dominanceScore,
        burdenScore,
        stabilityScore,
        volatilityScore,
        comebackArcScore,
        burnoutScore,
        resilienceScore,
        fastAttackScore,
        teammateAvg,
        teammateDelta,
        teammateLeadRate,
        supportFloorRate,
        teamAvg,
        opponentAvg,
        teamEdgeRate,
        globalImpactScore,
        globalBurdenScore,
        teamAnchorScore,
        floorCoreScore,
        tempoCoreScore
      };
    })
    .filter(Boolean);

  if (eligible.length === 0) return honors;

  function bestBy(candidates, compare) {
    return candidates.reduce((best, candidate) => {
      if (!best) return candidate;
      return compare(candidate, best) > 0 ? candidate : best;
    }, null);
  }

  function assign(key, metric, score) {
    if (metric) {
      honors[key] = {
        player: metric.player,
        score,
        stats: {
          ...metric.stats,
          games: metric.games,
          totalRank: metric.avg * metric.games,
          firstPlaceCount: metric.firstCount,
          lastPlaceCount: metric.lastCount,
          rankings: metric.rankings
        }
      };
    }
  }

  const mvp = bestBy(eligible, (a, b) =>
    (a.globalImpactScore - b.globalImpactScore) ||
    (b.avg - a.avg) ||
    (a.firstCount - b.firstCount)
  );
  assign('mvp', mvp, mvp?.globalImpactScore.toFixed(2));

  const burden = bestBy(eligible, (a, b) =>
    (a.globalBurdenScore - b.globalBurdenScore) ||
    (a.avg - b.avg) ||
    (a.lastCount - b.lastCount)
  );
  assign('burden', burden, burden?.globalBurdenScore.toFixed(2));

  const stable = bestBy(
    eligible.filter(metric => metric.avg <= mid && metric.variance <= totalPlayers),
    (a, b) =>
      (a.stabilityScore - b.stabilityScore) ||
      (b.variance - a.variance) ||
      (b.avg - a.avg)
  );
  assign('stable', stable, stable?.variance.toFixed(2));

  const rollercoaster = bestBy(
    eligible.filter(metric => metric.movement >= Math.max(4, metric.games - 1)),
    (a, b) =>
      (a.volatilityScore - b.volatilityScore) ||
      (a.movement - b.movement) ||
      (a.variance - b.variance)
  );
  assign('rollercoaster', rollercoaster, rollercoaster?.movement);

  const comeback = bestBy(
    eligible.filter(metric => metric.improvement > 1 && metric.lateAvg <= mid),
    (a, b) =>
      (a.improvement - b.improvement) ||
      (b.lateAvg - a.lateAvg) ||
      (a.topHalfRate - b.topHalfRate)
  );
  assign('comeback', comeback, comeback ? `+${comeback.improvement.toFixed(1)}` : null);

  const fanche = bestBy(
    eligible.filter(metric => metric.crashes > 0),
    (a, b) =>
      (a.crashes - b.crashes) ||
      (a.movement - b.movement) ||
      (a.variance - b.variance)
  );
  assign('fanche', fanche, fanche?.crashes);

  const gambler = bestBy(
    eligible.filter(metric => metric.firstCount > 0 && metric.lastCount > 0),
    (a, b) => {
      const scoreA = Math.sqrt(a.firstRate * a.lastRate) * (a.firstCount + a.lastCount);
      const scoreB = Math.sqrt(b.firstRate * b.lastRate) * (b.firstCount + b.lastCount);
      return (scoreA - scoreB) || (a.movement - b.movement);
    }
  );
  assign('gambler', gambler, gambler ? `${gambler.firstCount}冠${gambler.lastCount}末` : null);

  const complete = bestBy(
    eligible.filter(metric => metric.uniqueRanks.size >= totalPlayers),
    (a, b) =>
      (a.uniqueRanks.size - b.uniqueRanks.size) ||
      (a.uniqueRanks.size / a.games - b.uniqueRanks.size / b.games) ||
      (a.movement - b.movement)
  );
  assign('complete', complete, complete ? `${complete.uniqueRanks.size}/${totalPlayers}` : null);

  const streak = bestBy(
    eligible.filter(metric => metric.bestTopHalfStreak >= 3),
    (a, b) =>
      (a.bestTopHalfStreak - b.bestTopHalfStreak) ||
      (a.topHalfRate - b.topHalfRate) ||
      (b.avg - a.avg)
  );
  assign('streak', streak, streak?.bestTopHalfStreak);

  const median = bestBy(
    eligible.filter(metric => metric.teammateAvg !== null && metric.teammateDelta > 0),
    (a, b) =>
      (a.teamAnchorScore - b.teamAnchorScore) ||
      (a.teammateDelta - b.teammateDelta) ||
      (a.teammateLeadRate - b.teammateLeadRate) ||
      (b.avg - a.avg)
  );
  assign('median', median, median ? `+${median.teammateDelta.toFixed(1)}` : null);

  const carp = bestBy(
    eligible.filter(metric => metric.comebackArcScore > 1.5 && metric.lateAvg <= mid),
    (a, b) =>
      (a.comebackArcScore - b.comebackArcScore) ||
      (a.improvement - b.improvement) ||
      (b.lateAvg - a.lateAvg)
  );
  assign('carp', carp, carp ? `+${carp.improvement.toFixed(1)}` : null);

  const nonstick = bestBy(
    eligible.filter(metric => metric.lastCount === 0 && metric.teammateAvg !== null),
    (a, b) =>
      (a.floorCoreScore - b.floorCoreScore) ||
      (a.supportFloorRate - b.supportFloorRate) ||
      (a.teammateDelta - b.teammateDelta) ||
      (b.worstRank - a.worstRank) ||
      (b.avg - a.avg)
  );
  assign('nonstick', nonstick, nonstick ? `+${nonstick.teammateDelta.toFixed(1)}` : null);

  const frequent = bestBy(
    eligible.filter(metric =>
      metric.changes >= 2 &&
      metric.topHalfRate >= 0.75 &&
      metric.avg <= midRank &&
      metric.bestTopHalfStreak >= 3 &&
      metric.teamEdgeRate >= 0.5
    ),
    (a, b) =>
      (a.tempoCoreScore - b.tempoCoreScore) ||
      (a.teamEdgeRate - b.teamEdgeRate) ||
      (a.topHalfRate - b.topHalfRate) ||
      (a.changeRate - b.changeRate) ||
      (b.avg - a.avg)
  );
  assign('frequent', frequent, frequent ? `${Math.round(frequent.teamEdgeRate * 100)}%` : null);

  const burnout = bestBy(
    eligible.filter(metric =>
      metric.decline > 1 &&
      metric.earlyAvg <= midRank &&
      metric.lateAvg > midRank &&
      metric.lateBottomHalfRate >= 0.5
    ),
    (a, b) =>
      (a.burnoutScore - b.burnoutScore) ||
      (a.decline - b.decline) ||
      (a.lateBottomHalfRate - b.lateBottomHalfRate) ||
      (a.avg - b.avg)
  );
  assign('burnout', burnout, burnout ? `+${burnout.decline.toFixed(1)}` : null);

  const almost = bestBy(
    eligible.filter(metric => metric.firstCount === 0 && metric.secondCount > 0),
    (a, b) =>
      (a.secondCount - b.secondCount) ||
      (b.avg - a.avg) ||
      (a.topHalfRate - b.topHalfRate)
  );
  assign('almost', almost, almost ? `${almost.secondCount}次第2` : null);

  const resilient = bestBy(
    eligible.filter(metric => metric.pressureRebounds > 0 && metric.topHalfRate >= 0.35),
    (a, b) =>
      (a.resilienceScore - b.resilienceScore) ||
      (a.pressureRecoveryRate - b.pressureRecoveryRate) ||
      (a.sustainedRecoveryRate - b.sustainedRecoveryRate) ||
      (b.pressureRate - a.pressureRate) ||
      (a.pressureRebounds - b.pressureRebounds) ||
      (b.avg - a.avg)
  );
  assign('resilient', resilient, resilient ? `${resilient.pressureRebounds}/${resilient.pressureRounds}` : null);

  return honors;
}

/**
 * Calculate honors from the current live session state.
 */
export function calculateHonors(totalPlayers = 8) {
  const players = getPlayers();
  const allStats = state.getPlayerStats();
  return calculateHonorsFromData(players, allStats, totalPlayers);
}

/**
 * Honor metadata — 16 honor key (matches data-honor-id attributes in index.html).
 * For each honor: which calculateHonors() field maps to it, the display title,
 * and a stat-formatter that returns { primary, label } for the recipient block.
 */
const HONOR_META = {
  lyubu:         { honorKey: 'mvp',           title: '吕布',     glyph: '🥇', color: '#d4af37', fmtStat: (h, st) => ({ primary: `${st.firstPlaceCount} / ${st.games}`, label: '头游' }) },
  adou:          { honorKey: 'burden',        title: '阿斗',     glyph: '😅', color: '#8b4513', fmtStat: (h, st) => ({ primary: `${st.lastPlaceCount} / ${st.games}`, label: '垫底' }) },
  shifo:         { honorKey: 'stable',        title: '石佛',     glyph: '🗿', color: '#708090', fmtStat: (h, st) => ({ primary: `σ ${h.score}`, label: `n=${st.games}` }) },
  bodongwang:    { honorKey: 'rollercoaster', title: '波动王',   glyph: '🌊', color: '#ff4500', fmtStat: (h, st) => ({ primary: `Σ ${h.score}`, label: `${Math.min(...st.rankings)}–${Math.max(...st.rankings)}` }) },
  fendouwang:    { honorKey: 'comeback',      title: '奋斗王',   glyph: '📈', color: '#32cd32', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '位提升' }) },
  fanchewang:    { honorKey: 'fanche',        title: '翻车王',   glyph: '🎪', color: '#dc143c', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '崩盘次' }) },
  dutu:          { honorKey: 'gambler',       title: '赌徒',     glyph: '🎲', color: '#8b5cf6', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '高风险' }) },
  damanguan:     { honorKey: 'complete',      title: '大满贯',   glyph: '👑', color: '#ffd700', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '体验过' }) },
  lianshengewang:{ honorKey: 'streak',        title: '连段王',   glyph: '🔥', color: '#ff6347', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '上半区连段' }) },
  foxiwanjia:    { honorKey: 'median',        title: '团队中轴', glyph: '🧭', color: '#9370db', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '强于队友均值' }) },
  liyuwang:      { honorKey: 'carp',          title: '逆转核心', glyph: '📈', color: '#f97316', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '后程提升' }) },
  buzhanguo:     { honorKey: 'nonstick',      title: '保底核心', glyph: '🛡️', color: '#10b981', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '强于队友均值' }) },
  shandianxia:   { honorKey: 'frequent',      title: '节奏核心', glyph: '⚡', color: '#ffa500', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '队伍领先局' }) },
  ranjinwang:    { honorKey: 'burnout',       title: '燃尽王',   glyph: '🔥', color: '#b91c1c', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '后程下滑' }) },
  qichayizhao:   { honorKey: 'almost',        title: '棋差一着', glyph: '🎯', color: '#3b82f6', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '差一名' }) },
  xiaochou:      { honorKey: 'resilient',     title: '抗压王',   glyph: '🧱', color: '#0f766e', fmtStat: (h, st) => ({ primary: `${h.score}`, label: '反弹/承压' }) }
};

export function buildHonorExportRows(honors = {}, allStats = {}) {
  return Object.entries(HONOR_META).map(([id, meta]) => {
    const honorData = honors[meta.honorKey];
    const player = honorData?.player || null;
    const stats = player
      ? (honorData.stats || allStats[player.id] || {
        games: 0,
        totalRank: 0,
        firstPlaceCount: 0,
        lastPlaceCount: 0,
        rankings: []
      })
      : null;
    const stat = player ? meta.fmtStat(honorData, stats) : null;
    return {
      id,
      title: meta.title,
      glyph: meta.glyph,
      color: meta.color,
      playerText: player ? `${player.emoji || ''}${player.name || '玩家'}` : '—',
      metricText: stat ? `${stat.primary}${stat.label ? ` ${stat.label}` : ''}` : '进行中'
    };
  });
}

const HONOR_PORTRAIT_IDS = {
  // xiaochou is kept as the DOM/asset slot for compatibility with old themes,
  // but the current honor uses the neutral profile portrait.
  xiaochou: '_profile'
};

function avatarChar(player) {
  if (!player) return '?';
  // Profile players (with @handle): use first char of display name (Chinese surname feel).
  // Session players (玩家1, 玩家2…): use the player's emoji — much more visually
  // distinct than the digit; matches the small emoji shown next to their name.
  if (player.handle) {
    const name = (player.name || '').trim();
    if (name) return Array.from(name)[0];
  }
  return player.emoji || '?';
}

function teamColorClass(player) {
  if (!player) return '';
  return Number(player.team) === 1 ? 'honor__avatar--blue' : (Number(player.team) === 2 ? 'honor__avatar--red' : 'honor__avatar--empty');
}

/**
 * Update one honor article with awarded data or empty placeholder.
 */
function updateHonorArticle(article, honorData, meta) {
  // Status badge — only shown when there's NO clear winner (i.e., honor is still calculating).
  // When a winner exists, the recipient row already conveys leadership; the badge is noise.
  const statusEl = article.querySelector('.honor__status');
  if (statusEl) {
    statusEl.classList.remove('honor__status--leading', 'honor__status--inprog', 'honor__status--locked');
    if (honorData?.player) {
      // Winner exists — hide the badge entirely
      statusEl.hidden = true;
      statusEl.textContent = '';
    } else {
      statusEl.hidden = false;
      statusEl.textContent = '进行中';
      statusEl.classList.add('honor__status--inprog');
    }
  }

  // Article modifier — keep the orange accent strip on populated cards (visual hierarchy)
  article.classList.remove('honor--leading', 'honor--inprog');
  article.classList.add(honorData?.player ? 'honor--leading' : 'honor--inprog');

  // Recipient block
  const recipient = article.querySelector('.honor__recipient');
  if (!recipient) return;

  const avatar = recipient.querySelector('.honor__avatar');
  const playerBlock = recipient.querySelector('.honor__player');
  const playerName = recipient.querySelector('.honor__playername');
  let stat = recipient.querySelector('.honor__stat');

  if (honorData?.player) {
    const p = honorData.player;
    const allStats = state.getPlayerStats() || {};
    const st = honorData.stats || allStats[p.id] || { games: 0, totalRank: 0, firstPlaceCount: 0, lastPlaceCount: 0, rankings: [] };

    // Avatar
    if (avatar) {
      avatar.className = `honor__avatar ${teamColorClass(p)}`;
      avatar.replaceChildren();
      const avatarPhoto = resolveAvatarPhoto(p);
      if (avatarPhoto) {
        const img = document.createElement('img');
        img.src = avatarPhoto;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        avatar.appendChild(img);
      } else {
        avatar.textContent = avatarChar(p);
      }
    }

    // Player block — name + handle (or emoji fallback)
    if (playerBlock) {
      playerBlock.replaceChildren();
      const nm = document.createElement('span');
      nm.className = 'honor__playername';
      nm.id = playerName?.id || meta.idForName;
      nm.textContent = p.name || '玩家';
      playerBlock.appendChild(nm);

      const handle = document.createElement('span');
      handle.className = 'honor__handle';
      handle.textContent = p.handle ? `@${p.handle}` : (p.emoji || '');
      playerBlock.appendChild(handle);
    }

    // Stat block
    const fmt = meta.fmtStat(honorData, st);
    if (!stat) {
      stat = document.createElement('div');
      recipient.appendChild(stat);
    }
    stat.className = 'honor__stat';
    stat.replaceChildren();
    const big = document.createElement('span');
    big.className = 'honor__stat--big';
    big.textContent = fmt.primary;
    stat.appendChild(big);
    if (fmt.label) {
      const label = document.createElement('span');
      label.className = 'honor__stat-label';
      label.textContent = fmt.label;
      stat.appendChild(label);
    }
  } else {
    // Empty state — placeholder avatar + "—" + placeholder stat
    if (avatar) {
      avatar.className = 'honor__avatar honor__avatar--empty';
      avatar.replaceChildren();
      avatar.textContent = '?';
    }
    if (playerBlock) {
      playerBlock.replaceChildren();
      const nm = document.createElement('span');
      nm.className = 'honor__playername honor__playername--placeholder';
      nm.id = playerName?.id || meta.idForName;
      nm.textContent = '数据采集中';
      playerBlock.appendChild(nm);
      const handle = document.createElement('span');
      handle.className = 'honor__handle';
      handle.textContent = '需更多数据';
      playerBlock.appendChild(handle);
    }
    if (stat) {
      stat.className = 'honor__stat honor__stat--placeholder';
      stat.replaceChildren();
      stat.textContent = '—';
    }
  }
}

/**
 * Render all 16 honors with editorial recipient blocks.
 */
export function renderHonors() {
  const honors = calculateHonors(getActiveHonorPlayerCount());
  const articles = document.querySelectorAll('.honor[data-honor-id]');
  const portraitsMode = getManifest().honorPortraits;

  articles.forEach(article => {
    const honorId = article.dataset.honorId;
    const meta = HONOR_META[honorId];
    if (!meta) return;
    meta.idForName = honorId;
    const data = honors[meta.honorKey];
    syncHonorPortrait(article, honorId, portraitsMode);
    updateHonorArticle(article, data, meta);
  });
}

/**
 * Inject or remove the ink-brush honor portrait based on the active theme's
 * feature manifest. When manifest.honorPortraits === 'photo', the article
 * gets a leading <img> referencing public/themes/teatable/honors/<id>.jpg.
 * Other manifest values strip the portrait so theme switches are clean.
 *
 * Idempotent — safe to call on every render. The image element is reused
 * across renders (only its src is updated if needed) so the browser doesn't
 * re-fetch every time honors recalculate.
 */
function syncHonorPortrait(article, honorId, portraitsMode) {
  const existing = article.querySelector(':scope > .honor__portrait');
  if (portraitsMode !== 'photo') {
    if (existing) existing.remove();
    return;
  }
  const portraitId = HONOR_PORTRAIT_IDS[honorId] || honorId;
  const src = `/themes/teatable/honors/${portraitId}.jpg`;
  if (existing) {
    if (existing.getAttribute('src') !== src) existing.setAttribute('src', src);
    return;
  }
  const img = document.createElement('img');
  img.className = 'honor__portrait';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.setAttribute('src', src);
  // Insert as the first child so the .honor flex layout puts it at the left.
  article.insertBefore(img, article.firstChild);
}
