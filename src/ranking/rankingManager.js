/**
 * Ranking Manager - Ranking State Management
 * Manages currentRanking state separate from main game state
 */

import state from '../core/state.js';
import { emit } from '../core/events.js';

const VALID_RANKING_MODES = new Set([4, 6, 8]);

export function normalizeRankingMode(mode) {
  let num = null;

  if (typeof mode === 'number') {
    num = Number.isInteger(mode) ? mode : null;
  } else if (typeof mode === 'string') {
    const trimmed = mode.trim();
    num = /^(4|6|8)$/.test(trimmed) ? Number(trimmed) : null;
  }

  return VALID_RANKING_MODES.has(num) ? num : null;
}

/**
 * Get current ranking
 * @returns {Object} Ranking object (copy)
 */
export function getRanking() {
  return state.getCurrentRanking();
}

/**
 * Compare two ranking maps by rank key and player id.
 * @param {Object} currentRanking
 * @param {Object} nextRanking
 * @returns {boolean}
 */
export function hasRankingChanged(currentRanking, nextRanking) {
  const current = currentRanking || {};
  const next = nextRanking || {};
  const keys = new Set([...Object.keys(current), ...Object.keys(next)]);

  for (const key of keys) {
    if (current[key] !== next[key]) {
      return true;
    }
  }

  return false;
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
  const requiredCount = normalizeRankingMode(mode);
  if (!requiredCount) return false;

  let filledCount = 0;
  for (let i = 1; i <= requiredCount; i++) {
    // Check for both truthy value AND explicit undefined check
    if (ranking[i] !== undefined && ranking[i] !== null) {
      filledCount++;
    }
  }

  return filledCount === requiredCount;
}

/**
 * Get filled position count
 * @param {number} mode - Game mode
 * @returns {{filled: number, total: number}}
 */
export function getRankingProgress(mode) {
  const ranking = state.getCurrentRanking();
  const total = normalizeRankingMode(mode);
  if (!total) {
    return { filled: 0, total: 0 };
  }

  let filled = 0;
  for (let i = 1; i <= total; i++) {
    // Check for both truthy value AND explicit undefined check
    // because playerId might be 0 (though it shouldn't be)
    if (ranking[i] !== undefined && ranking[i] !== null) {
      filled++;
    }
  }

  return { filled, total };
}

/**
 * Randomize ranking positions
 * @param {number[]} playerIds - Array of player IDs
 * @param {number} mode - Game mode
 */
export function randomizeRanking(playerIds, mode) {
  const num = normalizeRankingMode(mode);
  if (!num) {
    console.error('Invalid ranking mode:', mode);
    return false;
  }

  if (!Array.isArray(playerIds) || playerIds.length !== num) {
    console.error(`Invalid random ranking player count: expected ${num}, got ${Array.isArray(playerIds) ? playerIds.length : 'invalid'}`);
    return false;
  }

  const seen = new Set();
  for (const playerId of playerIds) {
    if (!Number.isSafeInteger(playerId) || playerId <= 0 || seen.has(playerId)) {
      console.error('Invalid random ranking player ids:', playerIds);
      return false;
    }
    seen.add(playerId);
  }

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
  emit('ranking:updated'); // Also emit updated event to trigger UI refresh
  return true;
}
