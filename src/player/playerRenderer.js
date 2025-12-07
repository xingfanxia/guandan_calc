/**
 * Player Renderer - Player UI Rendering
 * Extracted from app.js lines 660-830, 1335-1340
 * Handles rendering player tiles and team zones
 */

import { $, on } from '../core/utils.js';
import { getPlayers, getPlayersByTeam, updatePlayer } from './playerManager.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';

// Drag state (shared with dragDrop module)
export let draggedPlayer = null;

export function setDraggedPlayer(player) {
  draggedPlayer = player;
}

export function getDraggedPlayer() {
  return draggedPlayer;
}

/**
 * Render all players in their respective zones
 */
export function renderPlayers() {
  const unassignedEl = $('unassignedPlayers');
  const team1ZoneEl = $('team1Zone');
  const team2ZoneEl = $('team2Zone');

  if (!unassignedEl || !team1ZoneEl || !team2ZoneEl) {
    console.warn('Player zone elements not found');
    return;
  }

  // Clear all zones
  unassignedEl.innerHTML = '';
  team1ZoneEl.innerHTML = '';
  team2ZoneEl.innerHTML = '';

  const team1Players = getPlayersByTeam(1);
  const team2Players = getPlayersByTeam(2);

  // Add labels for empty team zones
  if (team1Players.length === 0) {
    team1ZoneEl.innerHTML = '<div class="label">拖拽玩家到这里分配队伍</div>';
  }
  if (team2Players.length === 0) {
    team2ZoneEl.innerHTML = '<div class="label">拖拽玩家到这里分配队伍</div>';
  }

  // Render players in their zones
  const players = getPlayers();
  players.forEach(player => {
    const tile = createPlayerTile(player);

    if (player.team === 1) {
      team1ZoneEl.appendChild(tile);
      tile.style.borderColor = config.getTeamColor('t1');
    } else if (player.team === 2) {
      team2ZoneEl.appendChild(tile);
      tile.style.borderColor = config.getTeamColor('t2');
    } else {
      unassignedEl.appendChild(tile);
    }
  });

  updateTeamLabels();
  emit('ui:playersRendered');
}

/**
 * Create player tile element
 * @param {Object} player - Player data
 * @param {Function} onDragStart - Drag start handler (optional)
 * @param {Function} onDragEnd - Drag end handler (optional)
 * @returns {HTMLElement} Player tile element
 */
export function createPlayerTile(player, onDragStart, onDragEnd) {
  const tile = document.createElement('div');
  tile.className = 'player-tile';
  tile.draggable = true;
  tile.dataset.playerId = player.id;

  // Emoji
  const emoji = document.createElement('span');
  emoji.className = 'emoji';
  emoji.textContent = player.emoji;

  // Name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = player.name;
  nameInput.onclick = (e) => e.stopPropagation();

  // Update name with debouncing
  let updateTimer = null;
  nameInput.oninput = function() {
    const newName = this.value;

    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updatePlayer(player.id, { name: newName });
      emit('ui:playerNameChanged', { playerId: player.id, name: newName });
    }, 300);
  };

  nameInput.onchange = function() {
    if (updateTimer) clearTimeout(updateTimer);
    updatePlayer(player.id, { name: this.value });
    emit('ui:playerNameChanged', { playerId: player.id, name: this.value });
  };

  tile.appendChild(emoji);
  tile.appendChild(nameInput);

  // Desktop drag events
  tile.ondragstart = (e) => {
    draggedPlayer = player;
    tile.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';

    if (onDragStart) onDragStart(e, player);
  };

  tile.ondragend = () => {
    tile.classList.remove('dragging');
    draggedPlayer = null;

    if (onDragEnd) onDragEnd();
  };

  // Touch events for mobile - import dynamically to avoid circular dependency
  // These will be attached by the touch handler module
  tile.dataset.attachTouchHandlers = 'true';
  tile.dataset.playerData = JSON.stringify({ id: player.id });

  return tile;
}

/**
 * Attach touch handlers to a tile
 * @param {HTMLElement} tile - Tile element
 * @param {Object} player - Player data
 * @param {Function} handleTouchStart - Touch start handler
 * @param {Function} handleTouchMove - Touch move handler
 * @param {Function} handleTouchEnd - Touch end handler
 */
export function attachTouchHandlers(tile, player, handleTouchStart, handleTouchMove, handleTouchEnd) {
  // Attach with passive:false to allow preventDefault
  const startHandler = (e) => {
    handleTouchStart(e, player);
  };

  tile.addEventListener('touchstart', startHandler, { passive: false });
  tile.addEventListener('touchmove', handleTouchMove, { passive: false });
  tile.addEventListener('touchend', handleTouchEnd, { passive: false });
  tile.addEventListener('touchcancel', handleTouchEnd, { passive: false });

  console.log('Touch handlers attached to', player.emoji, player.name);
}

/**
 * Update team labels
 */
export function updateTeamLabels() {
  const team1Label = $('team1Label');
  const team2Label = $('team2Label');

  if (team1Label) {
    team1Label.textContent = config.getTeamName('t1');
    team1Label.style.color = config.getTeamColor('t1');
  }

  if (team2Label) {
    team2Label.textContent = config.getTeamName('t2');
    team2Label.style.color = config.getTeamColor('t2');
  }
}
