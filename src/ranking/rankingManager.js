/**
 * Ranking Manager - Ranking State Management
 * Manages currentRanking state separate from main game state
 */

import state from '../core/state.js';
import { emit } from '../core/events.js';

/**
 * Get current ranking
 * @returns {Object} Ranking object (copy)
 */
export function getRanking() {
  return state.getCurrentRanking();
}

/**
 * Set player at rank position
 * @param {number} rank - Rank position (1-8)
 * @param {number} playerId - Player ID
 */
export function setRankPosition(rank, playerId) {
  const ranking = state.getCurrentRanking();
  ranking[rank] = playerId;
  state.setCurrentRanking(ranking);

  emit('ranking:positionSet', { rank, playerId });
}

/**
 * Remove player from rank
 * @param {number} rank - Rank position
 */
export function clearRankPosition(rank) {
  const ranking = state.getCurrentRanking();
  delete ranking[rank];
  state.setCurrentRanking(ranking);

  emit('ranking:positionCleared', { rank });
}

/**
 * Clear all ranking positions
 */
export function clearRanking() {
  state.setCurrentRanking({});
  emit('ranking:cleared');
}

/**
 * Check if all positions are filled for given mode
 * @param {number} mode - Game mode (4, 6, or 8)
 * @returns {boolean} True if all positions filled
 */
export function isRankingComplete(mode) {
  const ranking = state.getCurrentRanking();
  const requiredCount = parseInt(mode);

  let filledCount = 0;
  for (let i = 1; i <= requiredCount; i++) {
    // Check for both truthy value AND explicit undefined check
    if (ranking[i] !== undefined && ranking[i] !== null) {
      filledCount++;
    }
  }

  console.log('Ranking complete check:', { ranking, filledCount, requiredCount, complete: filledCount === requiredCount });

  return filledCount === requiredCount;
}

/**
 * Get filled position count
 * @param {number} mode - Game mode
 * @returns {{filled: number, total: number}}
 */
export function getRankingProgress(mode) {
  const ranking = state.getCurrentRanking();
  const total = parseInt(mode);

  let filled = 0;
  for (let i = 1; i <= total; i++) {
    // Check for both truthy value AND explicit undefined check
    // because playerId might be 0 (though it shouldn't be)
    if (ranking[i] !== undefined && ranking[i] !== null) {
      filled++;
    }
  }

  console.log('Ranking progress check:', { ranking, filled, total });

  return { filled, total };
}

/**
 * Randomize ranking positions
 * @param {number[]} playerIds - Array of player IDs
 * @param {number} mode - Game mode
 */
export function randomizeRanking(playerIds, mode) {
  const num = parseInt(mode);

  // Fisher-Yates shuffle
  const shuffled = playerIds.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Assign to ranking positions
  const newRanking = {};
  for (let rank = 1; rank <= num; rank++) {
    newRanking[rank] = shuffled[rank - 1];
  }

  state.setCurrentRanking(newRanking);
  emit('ranking:randomized', { ranking: newRanking });
}
