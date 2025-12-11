/**
 * Game Controls Controller
 * Handles game progression buttons: Apply, Advance, Undo, Reset
 */

import { $, on } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';
import { calculateFromRanking, getPlayerRankingData } from '../ranking/rankingCalculator.js';
import { applyGameResult, advanceToNextRound } from '../game/rules.js';
import { undoLast, resetAll, renderHistory } from '../game/history.js';
import { clearRanking as clearRankingState } from '../ranking/rankingManager.js';
import { renderPlayerPool, renderRankingSlots, checkGameEnded } from '../ranking/rankingRenderer.js';
import { updatePlayerStats, renderStatistics } from '../stats/statistics.js';
import { renderTeams } from '../ui/teamDisplay.js';
import { showVictoryModal, closeVictoryModal, getVotingResults } from '../ui/victoryModal.js';
import { calculateHonors } from '../stats/honors.js';
import { syncProfileStats } from '../api/playerApi.js';
import { getPlayers } from '../player/playerManager.js';
import { getRoomInfo } from '../share/roomManager.js';
import { scheduleAutoVotingSync } from '../share/votingSync.js';
import { handleTouchStart, handleTouchMove, handleTouchEnd } from '../player/touchHandler.js';
import { attachTouchHandlers } from '../player/playerRenderer.js';

/**
 * Attach touch handlers to all player and ranking tiles
 * Uses a data attribute to prevent double-attachment
 */
export function attachTouchHandlersToAllTiles() {
  // Attach to player tiles (team assignment area)
  const playerTiles = document.querySelectorAll('.player-tile');

  playerTiles.forEach(tile => {
    // Skip if already has handlers attached
    if (tile.dataset.touchHandlersAttached === 'true') return;

    const playerData = JSON.parse(tile.dataset.playerData || '{}');
    if (playerData.id) {
      const player = getPlayers().find(p => p.id === playerData.id);
      if (player) {
        attachTouchHandlers(tile, player, handleTouchStart, handleTouchMove, handleTouchEnd);
        tile.dataset.touchHandlersAttached = 'true';
      }
    }
  });

  // Attach to ranking tiles (ranking area)
  const rankingTiles = document.querySelectorAll('.ranking-player-tile');

  rankingTiles.forEach(tile => {
    // Skip if already has handlers attached
    if (tile.dataset.touchHandlersAttached === 'true') return;

    const playerId = parseInt(tile.dataset.playerId);
    if (playerId) {
      const player = getPlayers().find(p => p.id === playerId);
      if (player) {
        attachTouchHandlers(tile, player, handleTouchStart, handleTouchMove, handleTouchEnd);
        tile.dataset.touchHandlersAttached = 'true';
      }
    }
  });
}

/**
 * Setup all game control button handlers
 */
export function setupGameControls(renderInitialState) {
  const applyBtn = $('apply');
  const advanceBtn = $('advance');
  const undoBtn = $('undo');
  const resetBtn = $('resetMatch');

  // Apply button - Apply calculated results
  if (applyBtn) {
    on(applyBtn, 'click', () => {
      // Check if game has ended (A级通关)
      const victory = checkGameEnded();
      if (victory) {
        const applyTip = $('applyTip');
        if (applyTip) applyTip.textContent = '比赛已结束，请重置游戏开始新一局';
        return;
      }

      const mode = $('mode').value;
      const result = calculateFromRanking(parseInt(mode));

      if (result.ok) {
        const playerRankingData = getPlayerRankingData();

        // Merge ranks into calcResult for applyGameResult
        const fullCalcResult = {
          ...result.calcResult,
          ranks: result.ranks,
          mode: String(mode)
        };

        const applyResult = applyGameResult(fullCalcResult, result.winner, playerRankingData);

        if (applyResult && applyResult.applied) {
          // Update player stats
          updatePlayerStats(parseInt(mode));

          // Clear ranking for next round
          clearRankingState();

          // Show message
          const applyTip = $('applyTip');
          if (applyTip) {
            applyTip.textContent = applyResult.message;
          }

          // Render updates
          renderTeams();
          renderHistory();
          renderPlayerPool();
          renderRankingSlots();
          renderStatistics();
          attachTouchHandlersToAllTiles();

          console.log('Game applied, finalWin:', applyResult.finalWin);

          // Handle final win (A-level victory)
          if (applyResult.finalWin) {
            const winnerName = result.winner === 't1' ? config.getTeamName('t1') : config.getTeamName('t2');

            // Show victory celebration first
            showVictoryModal(winnerName);

            // Schedule auto-sync of voting results (5 minutes)
            scheduleAutoVotingSync();

            // Wait a moment for potential voting, then sync stats
            setTimeout(() => {
              // Calculate session honors
              const sessionHonors = calculateHonors(parseInt(mode));

              // Get voting results (local voting only)
              const votingResults = getVotingResults();

              // Sync profile stats to database (non-blocking)
              const roomInfo = getRoomInfo();
              const allPlayers = getPlayers();
              const sessionStats = state.getPlayerStats();
              syncProfileStats(applyResult.historyEntry, roomInfo.roomCode || 'LOCAL', allPlayers, sessionStats, sessionHonors, votingResults);
            }, 2000); // Wait 2 seconds for voting
          }
        }
      } else {
        // Show error message
        const applyTip = $('applyTip');
        if (applyTip) {
          applyTip.textContent = result.message || '请先完成排名';
        }
      }
    });
  }

  // Advance button - Move to next round
  if (advanceBtn) {
    on(advanceBtn, 'click', () => {
      const result = advanceToNextRound();
      const applyTip = $('applyTip');
      if (applyTip) {
        applyTip.textContent = result.message;
      }
      renderTeams();
    });
  }

  // Undo button - Undo last round
  if (undoBtn) {
    on(undoBtn, 'click', () => {
      undoLast();
      const applyTip = $('applyTip');
      if (applyTip) applyTip.textContent = '已撤销。';
      renderTeams();
      renderHistory();
      renderStatistics();
    });
  }

  // Reset button - Reset entire game
  if (resetBtn) {
    on(resetBtn, 'click', () => {
      const result = resetAll(true);
      if (result.success) {
        const applyTip = $('applyTip');
        if (applyTip) applyTip.textContent = result.message;
        renderInitialState();
        closeVictoryModal();
      }
    });
  }
}
