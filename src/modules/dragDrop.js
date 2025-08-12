/**
 * Drag and drop functionality module
 */

import { $, $$ } from '../utils/dom.js';

export class DragDropManager {
  constructor(playerManager, onRankingChange) {
    this.playerManager = playerManager;
    this.onRankingChange = onRankingChange;
    this.currentRanking = {};
    this.draggedElement = null;
    this.initDragDrop();
  }

  initDragDrop() {
    this.setupPlayerCards();
    this.setupDropZones();
  }

  setupPlayerCards() {
    const container = $('playersContainer');
    if (!container) return;
    
    container.innerHTML = '';
    const players = this.playerManager.getPlayers();
    
    players.forEach(player => {
      const card = this.createPlayerCard(player);
      container.appendChild(card);
    });
  }

  createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = `player-card team-${player.team}`;
    card.id = `player-${player.id}`;
    card.draggable = true;
    card.dataset.playerId = player.id;
    
    card.innerHTML = `
      <span class="player-emoji">${player.emoji}</span>
      <span class="player-name">${player.name}</span>
      <span class="player-team">${this.playerManager.getTeamName(player.team)}</span>
    `;
    
    // Add drag event listeners
    card.addEventListener('dragstart', (e) => this.handleDragStart(e));
    card.addEventListener('dragend', (e) => this.handleDragEnd(e));
    
    // Touch events for mobile
    card.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    card.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    card.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    
    return card;
  }

  setupDropZones() {
    const container = $('rankingContainer');
    if (!container) return;
    
    container.innerHTML = '';
    const mode = this.playerManager.getPlayers().length;
    
    for (let rank = 1; rank <= mode; rank++) {
      const zone = this.createDropZone(rank);
      container.appendChild(zone);
    }
  }

  createDropZone(rank) {
    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.dataset.rank = rank;
    
    const label = document.createElement('div');
    label.className = 'rank-label';
    label.textContent = `第${rank}名`;
    zone.appendChild(label);
    
    const slot = document.createElement('div');
    slot.className = 'rank-slot';
    slot.dataset.rank = rank;
    zone.appendChild(slot);
    
    // Add drop event listeners
    slot.addEventListener('dragover', (e) => this.handleDragOver(e));
    slot.addEventListener('drop', (e) => this.handleDrop(e));
    slot.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    
    return zone;
  }

  // Drag event handlers
  handleDragStart(e) {
    this.draggedElement = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    this.draggedElement = null;
  }

  handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    e.target.classList.add('drag-over');
    return false;
  }

  handleDragLeave(e) {
    e.target.classList.remove('drag-over');
  }

  handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    e.preventDefault();
    
    const dropZone = e.target.closest('.rank-slot');
    if (!dropZone || !this.draggedElement) return;
    
    dropZone.classList.remove('drag-over');
    
    const rank = parseInt(dropZone.dataset.rank);
    const playerId = parseInt(this.draggedElement.dataset.playerId);
    
    // Remove player from any existing rank
    Object.keys(this.currentRanking).forEach(r => {
      if (this.currentRanking[r] === playerId) {
        delete this.currentRanking[r];
        const oldSlot = document.querySelector(`.rank-slot[data-rank="${r}"]`);
        if (oldSlot) oldSlot.innerHTML = '';
      }
    });
    
    // Remove any existing player from this rank
    if (this.currentRanking[rank]) {
      const existingPlayerId = this.currentRanking[rank];
      const existingCard = $(`player-${existingPlayerId}`);
      if (existingCard) {
        existingCard.style.display = 'block';
      }
    }
    
    // Add player to new rank
    this.currentRanking[rank] = playerId;
    dropZone.innerHTML = this.draggedElement.innerHTML;
    dropZone.classList.add('occupied');
    this.draggedElement.style.display = 'none';
    
    // Notify about ranking change
    if (this.onRankingChange) {
      this.onRankingChange(this.currentRanking);
    }
    
    return false;
  }

  // Touch event handlers for mobile
  handleTouchStart(e) {
    const touch = e.touches[0];
    this.draggedElement = e.target.closest('.player-card');
    if (!this.draggedElement) return;
    
    this.draggedElement.classList.add('dragging');
    this.touchOffset = {
      x: touch.clientX - this.draggedElement.offsetLeft,
      y: touch.clientY - this.draggedElement.offsetTop
    };
    
    // Create a clone for dragging
    this.dragClone = this.draggedElement.cloneNode(true);
    this.dragClone.style.position = 'fixed';
    this.dragClone.style.zIndex = '1000';
    this.dragClone.style.opacity = '0.8';
    this.dragClone.style.pointerEvents = 'none';
    document.body.appendChild(this.dragClone);
    
    this.updateDragClonePosition(touch.clientX, touch.clientY);
    e.preventDefault();
  }

  handleTouchMove(e) {
    if (!this.dragClone) return;
    
    const touch = e.touches[0];
    this.updateDragClonePosition(touch.clientX, touch.clientY);
    
    // Find element under touch point
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = elementBelow?.closest('.rank-slot');
    
    // Clear previous hover states
    $$('.rank-slot').forEach(slot => slot.classList.remove('drag-over'));
    
    if (dropZone) {
      dropZone.classList.add('drag-over');
    }
    
    e.preventDefault();
  }

  handleTouchEnd(e) {
    if (!this.dragClone) return;
    
    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = elementBelow?.closest('.rank-slot');
    
    if (dropZone) {
      // Simulate drop
      const dropEvent = {
        target: dropZone,
        stopPropagation: () => {},
        preventDefault: () => {}
      };
      this.handleDrop(dropEvent);
    }
    
    // Clean up
    if (this.dragClone) {
      document.body.removeChild(this.dragClone);
      this.dragClone = null;
    }
    
    if (this.draggedElement) {
      this.draggedElement.classList.remove('dragging');
      this.draggedElement = null;
    }
    
    $$('.rank-slot').forEach(slot => slot.classList.remove('drag-over'));
  }

  updateDragClonePosition(x, y) {
    if (!this.dragClone) return;
    this.dragClone.style.left = (x - this.touchOffset.x) + 'px';
    this.dragClone.style.top = (y - this.touchOffset.y) + 'px';
  }

  getRanking() {
    return { ...this.currentRanking };
  }

  clearRanking() {
    this.currentRanking = {};
    
    // Show all player cards
    $$('.player-card').forEach(card => {
      card.style.display = 'block';
    });
    
    // Clear all drop zones
    $$('.rank-slot').forEach(slot => {
      slot.innerHTML = '';
      slot.classList.remove('occupied');
    });
  }

  setRanking(ranking) {
    this.clearRanking();
    this.currentRanking = { ...ranking };
    
    Object.entries(ranking).forEach(([rank, playerId]) => {
      const player = this.playerManager.getPlayerById(playerId);
      if (!player) return;
      
      const card = $(`player-${playerId}`);
      const slot = document.querySelector(`.rank-slot[data-rank="${rank}"]`);
      
      if (card && slot) {
        card.style.display = 'none';
        slot.innerHTML = card.innerHTML;
        slot.classList.add('occupied');
      }
    });
    
    if (this.onRankingChange) {
      this.onRankingChange(this.currentRanking);
    }
  }
}