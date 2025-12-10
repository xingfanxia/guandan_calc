/**
 * Ranking Renderer - Ranking UI Display
 * Extracted from app.js lines 832-1116
 * Handles ranking area, slots, and pool rendering
 */

import { $, on } from '../core/utils.js';
import { getRanking, setRankPosition, clearRankPosition } from './rankingManager.js';
import { getPlayers, getPlayerById, areAllPlayersAssigned } from '../player/playerManager.js';
import { getDraggedPlayer, setDraggedPlayer } from '../player/playerRenderer.js';
import { handleRankDrop, handlePoolDrop } from '../player/dragDrop.js';
import { handleTouchStart, handleTouchMove, handleTouchEnd } from '../player/touchHandler.js';
import config from '../core/config.js';
import state from '../core/state.js';
import { emit } from '../core/events.js';

/**
 * Check if game has ended (a team achieved A级通关)
 * @returns {Object|null} Victory info or null
 */
export function checkGameEnded() {
  const history = state.getHistory();
  if (history.length === 0) return null;

  const latestGame = history[history.length - 1];
  // Check for actual victory (通关 without negation like "才能通关")
  if (latestGame.aNote && 
      latestGame.aNote.includes('通关') && 
      !latestGame.aNote.includes('才能通关') &&
      !latestGame.aNote.includes('需') &&
      !latestGame.aNote.includes('但')) {
    return {
      winner: latestGame.win,
      winKey: latestGame.winKey
    };
  }
  return null;
}

/**
 * Render ranking area with slots
 * @param {number} mode - Game mode (4, 6, or 8)
 */
export function renderRankingArea(mode) {
  const pool = $('playerPool');
  const area = $('rankingArea');

  if (!pool || !area) return;

  const num = parseInt(mode);

  // Check if game has ended (A级通关)
  const victory = checkGameEnded();
  if (victory) {
    const winColor = victory.winKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');
    pool.innerHTML = `<div style="text-align:center; padding: 20px;">
      <div style="font-size: 48px;">🏆</div>
      <div style="font-size: 24px; color: ${winColor}; font-weight: bold; margin: 10px 0;">${victory.winner} A级通关！</div>
      <div class="small muted">比赛已结束，重置游戏可开始新一局</div>
    </div>`;
    area.innerHTML = '';
    return;
  }

  // Check if all players assigned to teams
  if (!areAllPlayersAssigned()) {
    pool.innerHTML = '<div class="small muted">请先分配所有玩家到队伍</div>';
    area.innerHTML = '';
    return;
  }

  // Render player pool
  renderPlayerPool();

  // Render ranking slots
  area.innerHTML = '';

  for (let rank = 1; rank <= num; rank++) {
    const slot = createRankSlot(rank);
    area.appendChild(slot);
  }

  // Render players in slots
  renderRankingSlots();
}

/**
 * Create ranking slot element
 * @param {number} rank - Rank position
 * @returns {HTMLElement} Slot element
 */
function createRankSlot(rank) {
  const slot = document.createElement('div');
  slot.className = 'rank-slot';
  slot.dataset.rank = rank;

  const number = document.createElement('div');
  number.className = 'rank-number';
  number.textContent = `第${rank}名`;
  slot.appendChild(number);

  // Setup drop handlers
  slot.ondragover = (e) => {
    e.preventDefault();
    slot.classList.add('drag-over');
  };

  slot.ondragleave = () => {
    slot.classList.remove('drag-over');
  };

  slot.ondrop = (e) => {
    e.preventDefault();
    slot.classList.remove('drag-over');

    const player = getDraggedPlayer();
    if (player) {
      const currentRanking = getRanking();
      const newRanking = handleRankDrop(slot, player, currentRanking);

      state.setCurrentRanking(newRanking);

      // Trigger ranking update event to re-render
      emit('ranking:updated');
    }
  };

  return slot;
}

/**
 * Render player pool (unranked players)
 */
export function renderPlayerPool() {
  const pool = $('playerPool');
  if (!pool) return;

  pool.innerHTML = '';

  // Setup drop handler for returning players
  pool.ondragover = (e) => {
    e.preventDefault();
    pool.classList.add('drag-over');
  };

  pool.ondragleave = () => {
    pool.classList.remove('drag-over');
  };

  pool.ondrop = (e) => {
    e.preventDefault();
    pool.classList.remove('drag-over');

    const player = getDraggedPlayer();
    if (player) {
      const currentRanking = getRanking();
      const newRanking = handlePoolDrop(player, currentRanking);

      state.setCurrentRanking(newRanking);

      // Trigger ranking update event to re-render
      emit('ranking:updated');
    }
  };

  // Add unranked players
  const ranking = getRanking();
  const players = getPlayers();
  const unrankedPlayers = players.filter(player => {
    return !Object.values(ranking).includes(player.id);
  });

  if (unrankedPlayers.length === 0) {
    pool.innerHTML = '<div class="small muted">所有玩家已排名</div>';
    return;
  }

  unrankedPlayers.forEach(player => {
    const tile = createRankingPlayerTile(player);
    pool.appendChild(tile);
  });
}

/**
 * Render players in ranking slots
 */
export function renderRankingSlots() {
  const area = $('rankingArea');
  if (!area) return;

  const ranking = getRanking();
  const slots = area.querySelectorAll('.rank-slot');

  slots.forEach(slot => {
    const rank = parseInt(slot.dataset.rank);
    const playerId = ranking[rank];

    // Remove existing player tiles (keep rank number)
    const existingTiles = slot.querySelectorAll('.ranking-player-tile');
    existingTiles.forEach(t => t.remove());

    if (playerId) {
      const player = getPlayerById(playerId);
      if (player) {
        const tile = createRankingPlayerTile(player);
        slot.appendChild(tile);
        slot.classList.add('filled');
      }
    } else {
      slot.classList.remove('filled');
    }
  });
}

/**
 * Create ranking player tile (for slots and pool)
 * @param {Object} player - Player data
 * @returns {HTMLElement} Tile element
 */
function createRankingPlayerTile(player) {
  const tile = document.createElement('div');
  tile.className = 'ranking-player-tile';
  tile.draggable = true;
  tile.dataset.playerId = player.id;
  tile.dataset.playerData = JSON.stringify({ id: player.id }); // For touch handlers

  // Apply team color
  const teamColor = player.team === 1 ? config.getTeamColor('t1') : config.getTeamColor('t2');
  tile.style.borderColor = teamColor;

  const emoji = document.createElement('span');
  emoji.className = 'emoji';
  emoji.textContent = player.emoji;

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = player.name;

  tile.appendChild(emoji);
  tile.appendChild(name);

  // Desktop drag events
  tile.ondragstart = (e) => {
    setDraggedPlayer(player);
    tile.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    emit('drag:started', { player });
  };

  tile.ondragend = () => {
    tile.classList.remove('dragging');
    setDraggedPlayer(null);
    emit('drag:ended');
  };

  // Touch events for mobile - INLINE attachment (critical for iOS Safari)
  // iOS Safari requires touch handlers to be attached when element is created,
  // not dynamically added later. This matches the working original app.js pattern.
  tile.addEventListener('touchstart', function(e) {
    handleTouchStart(e, player);
  }, { passive: false });

  tile.addEventListener('touchmove', handleTouchMove, { passive: false });

  tile.addEventListener('touchend', handleTouchEnd, { passive: false });

  tile.addEventListener('touchcancel', handleTouchEnd, { passive: false });

  return tile;
}
