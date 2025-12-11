/**
 * Player Controls Controller
 * Handles player management: Generate, Shuffle, Bulk Names, Quick Start, Search, Profile
 */

import { $, on } from '../core/utils.js';
import state from '../core/state.js';
import {
  generatePlayers,
  shuffleTeams,
  applyBulkNames,
  areAllPlayersAssigned,
  addPlayerFromProfile,
  getPlayers
} from '../player/playerManager.js';
import { renderPlayers } from '../player/playerRenderer.js';
import { clearRanking as clearRankingState, randomizeRanking } from '../ranking/rankingManager.js';
import { initializePlayerSearch, showInitialPlayers, clearSearchResults } from '../player/playerSearch.js';
import { initializeCreateModal, showCreateModal } from '../player/playerCreateModal.js';
import { searchPlayers } from '../api/playerApi.js';
import { checkGameEnded, renderRankingArea } from '../ranking/rankingRenderer.js';

/**
 * Setup all player control button handlers
 */
export function setupPlayerControls() {
  const generateBtn = $('generatePlayers');
  const shuffleBtn = $('shuffleTeams');
  const clearRankingBtn = $('clearRanking');
  const randomRankingBtn = $('randomRanking');
  const applyBulkNamesBtn = $('applyBulkNames');
  const quickStartBtn = $('quickStart');

  // Generate players button
  if (generateBtn) {
    on(generateBtn, 'click', () => {
      const mode = parseInt($('mode').value);
      generatePlayers(mode, true);
    });
  }

  // Shuffle teams button
  if (shuffleBtn) {
    on(shuffleBtn, 'click', () => {
      const mode = parseInt($('mode').value);
      shuffleTeams(mode);
    });
  }

  // Clear ranking button
  if (clearRankingBtn) {
    on(clearRankingBtn, 'click', () => {
      if (checkGameEnded()) {
        const applyTip = $('applyTip');
        if (applyTip) applyTip.textContent = '比赛已结束';
        return;
      }
      clearRankingState();
    });
  }

  // Random ranking button
  if (randomRankingBtn) {
    on(randomRankingBtn, 'click', () => {
      const gameEnded = checkGameEnded();
      if (gameEnded) {
        console.log('Random ranking blocked - game ended:', gameEnded);
        const applyTip = $('applyTip');
        if (applyTip) applyTip.textContent = '比赛已结束';
        return;
      }

      if (!areAllPlayersAssigned()) {
        alert('请先分配所有玩家到队伍');
        return;
      }

      const mode = parseInt($('mode').value);
      const players = getPlayers();
      const playerIds = players.map(p => p.id);

      randomizeRanking(playerIds, mode);
    });
  }

  // Bulk names input
  if (applyBulkNamesBtn) {
    on(applyBulkNamesBtn, 'click', () => {
      const bulkNames = $('bulkNames');
      if (bulkNames && bulkNames.value) {
        const success = applyBulkNames(bulkNames.value);
        if (success) {
          renderPlayers();
          bulkNames.value = '';
        } else {
          alert('姓名数量不匹配玩家数量');
        }
      }
    });
  }

  // Quick start button
  if (quickStartBtn) {
    on(quickStartBtn, 'click', async () => {
      const mode = parseInt($('mode').value);

      // Try to load recent players from profile database
      try {
        const { players: allPlayers } = await searchPlayers('', 100);

        if (allPlayers.length >= mode) {
          // Take the first N most recently active players
          const recentPlayers = allPlayers.slice(0, mode);

          // Clear existing players first
          state.setPlayers([]);

          // Add recent profile players
          recentPlayers.forEach(profile => {
            addPlayerFromProfile(profile);
          });

          // Shuffle into teams
          shuffleTeams(mode);
          renderPlayers();
          renderRankingArea(mode);

          console.log('Quick start with recent players:', recentPlayers.map(p => `${p.displayName}(@${p.handle})`));
          return;
        }
      } catch (error) {
        console.warn('Failed to load profile players, falling back to session mode:', error);
      }

      // Fallback: Generate session players with quick names
      generatePlayers(mode, true);
      const quickNames = mode === 4 ? '豪 小 大 姐' :
                          mode === 6 ? '豪 小 大 姐 夫 塞' :
                          '豪 小 大 姐 夫 塾 帆 鱼';

      const success = applyBulkNames(quickNames);
      if (success) {
        shuffleTeams(mode);
        renderPlayers();
        renderRankingArea(mode);
      }
    });
  }

  // Player profile search and creation
  initializePlayerSearch(
    // onPlayerSelected callback
    (player) => {
      const addedPlayer = addPlayerFromProfile(player);
      if (addedPlayer) {
        renderPlayers();
        console.log('Player added from profile:', addedPlayer);
      }
    },
    // onCreatePlayer callback
    () => {
      showCreateModal();
    }
  );

  initializeCreateModal((createdPlayer) => {
    // Auto-add newly created player to game
    const addedPlayer = addPlayerFromProfile(createdPlayer);
    if (addedPlayer) {
      renderPlayers();
      clearSearchResults();
      console.log('Player created and added:', addedPlayer);
    }
  });

  // Show initial players in search on load
  const searchResults = $('playerSearchResults');
  if (searchResults) {
    showInitialPlayers();
  }
}
