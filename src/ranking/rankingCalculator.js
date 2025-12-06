/**
 * Ranking Calculator - Bridge between ranking UI and game calculation
 * Extracted from app.js lines 383-479, 1118-1189
 * Converts player ranking to calculation input
 */

import { getRanking, getRankingProgress, isRankingComplete } from './rankingManager.js';
import { getPlayers, getPlayerById } from '../player/playerManager.js';
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
  const num = parseInt(mode);

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

  // Winner is whoever has first place
  const winnerKey = firstPlacePlayer.team === 1 ? 't1' : 't2';
  state.setWinner(winnerKey);

  // Collect ranks for each team
  const team1Ranks = [];
  const team2Ranks = [];

  for (let rank = 1; rank <= num; rank++) {
    const playerId = ranking[rank];
    if (playerId) {
      const player = getPlayerById(playerId);
      if (player) {
        if (player.team === 1) {
          team1Ranks.push(rank);
        } else {
          team2Ranks.push(rank);
        }
      }
    }
  }

  // Use winning team's ranks for calculation
  const winnerRanks = winnerKey === 't1' ? team1Ranks : team2Ranks;
  winnerRanks.sort((a, b) => a - b);

  // Calculate upgrade
  const must1 = config.getPreference('must1');
  const calcResult = calculateUpgrade(String(num), winnerRanks, config.getAll(), must1);

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
