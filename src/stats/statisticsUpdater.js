import { normalizePlayerCountMode } from '../core/playerCountMode.js';

function cloneStats(stats) {
  return JSON.parse(JSON.stringify(stats || {}));
}

function normalizeCounter(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function normalizeRankings(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function makeInitialStats() {
  return {
    games: 0,
    totalRank: 0,
    firstPlaceCount: 0,
    lastPlaceCount: 0,
    rankings: []
  };
}

export function applyRankingToPlayerStats({ players = [], playerStats = {}, ranking = {}, mode } = {}) {
  const num = normalizePlayerCountMode(mode);
  const nextStats = cloneStats(playerStats);

  if (!num) {
    return {
      ok: false,
      message: '错误：无效游戏人数模式',
      playerStats: nextStats
    };
  }

  if (!Array.isArray(players)) {
    return {
      ok: false,
      message: '错误：玩家数据无效',
      playerStats: nextStats
    };
  }

  const playerIds = new Set(
    players
      .map(player => player?.id)
      .filter(id => Number.isSafeInteger(id) && id > 0)
  );
  const seen = new Set();

  for (let rank = 1; rank <= num; rank++) {
    const playerId = ranking?.[rank];

    if (!Number.isSafeInteger(playerId) || playerId <= 0) {
      return {
        ok: false,
        message: `错误：未找到第${rank}名玩家`,
        playerStats: nextStats
      };
    }

    if (seen.has(playerId)) {
      return {
        ok: false,
        message: `错误：玩家排名重复（第${rank}名）`,
        playerStats: nextStats
      };
    }

    if (!playerIds.has(playerId)) {
      return {
        ok: false,
        message: `错误：第${rank}名玩家不存在`,
        playerStats: nextStats
      };
    }

    seen.add(playerId);
  }

  for (let rank = 1; rank <= num; rank++) {
    const playerId = ranking[rank];
    const existing = nextStats[playerId] || makeInitialStats();
    const rankings = normalizeRankings(existing.rankings);

    nextStats[playerId] = {
      ...existing,
      games: normalizeCounter(existing.games) + 1,
      totalRank: normalizeCounter(existing.totalRank) + rank,
      firstPlaceCount: normalizeCounter(existing.firstPlaceCount) + (rank === 1 ? 1 : 0),
      lastPlaceCount: normalizeCounter(existing.lastPlaceCount) + (rank === num ? 1 : 0),
      rankings: rankings.concat(rank)
    };
  }

  return {
    ok: true,
    playerStats: nextStats
  };
}
