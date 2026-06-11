/**
 * Ranking Calculator - Bridge between ranking UI and game calculation
 * Extracted from app.js lines 383-479, 1118-1189
 * Converts player ranking to calculation input
 */

import { getRanking, getRankingProgress, isRankingComplete, normalizeRankingMode } from './rankingManager.js';
import { getPlayers, getPlayerById, normalizeTeamNumber } from '../player/playerManager.js';
import { calculateUpgrade } from '../game/calculator.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';

/**
 * Check if auto-calculation should trigger
 * @param {number} mode - Game mode
 * @returns {{shouldCalculate: boolean, progress: Object}}
 */
export function checkAutoCalculate(mode) {
  const progress = getRankingProgress(mode);
  const complete = isRankingComplete(mode);

  if (complete) {
    emit('ranking:complete', { mode });
  }

  return {
    shouldCalculate: complete,
    progress
  };
}

/**
 * Calculate from current ranking (determine winner and trigger calculation)
 * @param {number} mode - Game mode
 * @returns {{ok: boolean, winner?: string, ranks?: number[], calcResult?: Object, message?: string}}
 */
export function calculateFromRanking(mode) {
  const num = normalizeRankingMode(mode);
  if (!num) {
    return {
      ok: false,
      message: '错误：无效游戏人数模式'
    };
  }

  // Check if ranking is complete
  if (!isRankingComplete(num)) {
    const progress = getRankingProgress(num);
    return {
      ok: false,
      message: `等待排名完成 (${progress.filled}/${progress.total})`
    };
  }

  const ranking = getRanking();

  // Determine winner from first place
  const firstPlacePlayerId = ranking[1];
  if (!firstPlacePlayerId) {
    return {
      ok: false,
      message: '错误：未找到第1名'
    };
  }

  const firstPlacePlayer = getPlayerById(firstPlacePlayerId);
  if (!firstPlacePlayer) {
    return {
      ok: false,
      message: '错误：未找到第1名玩家'
    };
  }

  const firstPlaceTeam = normalizeTeamNumber(firstPlacePlayer.team);
  if (!firstPlaceTeam) {
    return {
      ok: false,
      message: '错误：第1名玩家尚未分配队伍'
    };
  }

  const winnerKey = firstPlaceTeam === 1 ? 't1' : 't2';

  // Collect ranks for each team after validating every ranked player.
  const team1Ranks = [];
  const team2Ranks = [];

  for (let rank = 1; rank <= num; rank++) {
    const playerId = ranking[rank];
    if (!playerId) {
      return {
        ok: false,
        message: `错误：未找到第${rank}名`
      };
    }

    const player = getPlayerById(playerId);
    if (!player) {
      return {
        ok: false,
        message: `错误：未找到第${rank}名玩家`
      };
    }

    const teamNumber = normalizeTeamNumber(player.team);
    if (!teamNumber) {
      return {
        ok: false,
        message: `错误：第${rank}名玩家尚未分配队伍`
      };
    }

    if (teamNumber === 1) {
      team1Ranks.push(rank);
    } else {
      team2Ranks.push(rank);
    }
  }

  const expectedTeamSize = num / 2;
  if (team1Ranks.length !== expectedTeamSize || team2Ranks.length !== expectedTeamSize) {
    return {
      ok: false,
      message: `错误：队伍人数不匹配（蓝队 ${team1Ranks.length}/${expectedTeamSize}，红队 ${team2Ranks.length}/${expectedTeamSize}）`
    };
  }

  // Use winning team's ranks for calculation
  const winnerRanks = winnerKey === 't1' ? team1Ranks : team2Ranks;
  winnerRanks.sort((a, b) => a - b);

  // Pass minimal config slice instead of full deep-clone via config.getAll().
  // getAll() does JSON.parse(JSON.stringify(...)) of the entire config (including
  // team names, colors, preferences) on every ranking update — wasteful when the
  // calculator only needs c4/t6/p6/t8/p8.
  const must1 = config.getPreference('must1');
  const sixRules = config.get6PlayerRules();
  const eightRules = config.get8PlayerRules();
  const calcConfig = {
    c4: config.get4PlayerRules(),
    t6: sixRules.thresholds,
    p6: sixRules.points,
    t8: eightRules.thresholds,
    p8: eightRules.points
  };
  const calcResult = calculateUpgrade(String(num), winnerRanks, calcConfig, must1);

  if (calcResult?.details?.error) {
    return {
      ok: false,
      message: '错误：排名数据无法计算升级',
      calcResult
    };
  }

  state.setWinner(winnerKey);

  emit('ranking:calculated', {
    winner: winnerKey,
    ranks: winnerRanks,
    calcResult
  });

  return {
    ok: true,
    winner: winnerKey,
    ranks: winnerRanks,
    calcResult
  };
}

/**
 * Get player ranking data for history
 * @returns {Object} Player ranking details
 */
export function getPlayerRankingData() {
  const ranking = getRanking();
  const playerRankings = {};

  for (const rank in ranking) {
    const playerId = ranking[rank];
    const player = getPlayerById(playerId);
    if (player) {
      playerRankings[rank] = {
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        team: player.team
      };
    }
  }

  return playerRankings;
}
