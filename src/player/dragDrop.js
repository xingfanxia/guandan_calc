/**
 * Drag and Drop Handler - Desktop Interactions
 * Extracted from app.js lines 481-599, 768-813
 * Handles desktop drag-and-drop for player and ranking management
 */

import { $ } from '../core/utils.js';
import { getDraggedPlayer, setDraggedPlayer } from './playerRenderer.js';
import { assignPlayerToTeam, isTeamFull } from './playerManager.js';
import { emit } from '../core/events.js';
import state from '../core/state.js';

/**
 * Setup drop zones for team assignment
 * @param {number} mode - Game mode (for team size validation)
 */
export function setupDropZones(mode) {
  const zones = [
    { el: $('unassignedPlayers'), team: null },
    { el: $('team1Zone'), team: 1 },
    { el: $('team2Zone'), team: 2 }
  ];

  zones.forEach(zone => {
    if (!zone.el) return;

    zone.el.ondragover = (e) => {
      e.preventDefault();
      zone.el.classList.add('drag-over');
    };

    zone.el.ondragleave = () => {
      zone.el.classList.remove('drag-over');
    };

    zone.el.ondrop = (e) => {
      e.preventDefault();
      zone.el.classList.remove('drag-over');

      const player = getDraggedPlayer();
      if (!player) return;

      // Check if team is full
      if (zone.team !== null && isTeamFull(zone.team, mode)) {
        // Check if player is already on this team
        if (player.team !== zone.team) {
          alert('该队伍已满员！');
          return;
        }
      }

      // Assign to team
      assignPlayerToTeam(player.id, zone.team);
      emit('player:droppedOnTeam', { playerId: player.id, team: zone.team });
    };
  });
}

/**
 * Handle player dropped on ranking slot
 * @param {HTMLElement} slot - Rank slot element
 * @param {Object} player - Player being dropped
 * @param {Object} currentRanking - Current ranking state
 * @returns {Object} Updated ranking
 */
export function handleRankDrop(slot, player, currentRanking) {
  if (!player || !player.id || !slot) {
    return currentRanking;
  }

  const rank = parseInt(slot.dataset.rank);
  if (!rank) {
    return currentRanking;
  }

  const newRanking = { ...currentRanking };

  // Check if another player was already in this rank
  const existingPlayerId = newRanking[rank];
  if (existingPlayerId && existingPlayerId !== player.id) {
    // Find if dragged player was already ranked
    let draggedRank = null;
    for (const r in newRanking) {
      if (newRanking[r] === player.id) {
        draggedRank = r;
        break;
      }
    }

    if (draggedRank) {
      // Swap the two players
      newRanking[draggedRank] = existingPlayerId;
    } else {
      // Remove existing player from this rank (return to pool)
      delete newRanking[rank];
    }
  }

  // Remove player from any previous rank
  for (const r in newRanking) {
    if (newRanking[r] === player.id && r != rank) {
      delete newRanking[r];
    }
  }

  // Add player to new rank
  newRanking[rank] = player.id;

  emit('ranking:updated', { rank, playerId: player.id });

  return newRanking;
}

/**
 * Handle player dropped back to pool
 * @param {Object} player - Player being dropped
 * @param {Object} currentRanking - Current ranking state
 * @returns {Object} Updated ranking
 */
export function handlePoolDrop(player, currentRanking) {
  if (!player) {
    return currentRanking;
  }

  const newRanking = { ...currentRanking };

  // Remove player from ranking
  for (const rank in newRanking) {
    if (newRanking[rank] === player.id) {
      delete newRanking[rank];
    }
  }

  emit('ranking:playerReturnedToPool', { playerId: player.id });

  return newRanking;
}
