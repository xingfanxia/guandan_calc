// Touch and mobile interaction handlers
// UTF-8 encoding for Chinese characters

class TouchHandlers {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.touchDraggedElement = null;
    this.touchClone = null;
    this.touchStartTimer = null;
    this.touchStartPos = null;
    this.draggedPlayer = null;
  }

  /**
   * Handle touch start event
   * @param {TouchEvent} e - Touch event
   * @param {Object} player - Player object
   */
  handleTouchStart(e, player) {
    // Don't start drag if touching an input field
    if (e.target.tagName === 'INPUT') {
      return; // Allow normal input interaction
    }
    
    const touch = e.touches[0];
    const tile = e.currentTarget;
    
    // Store initial touch position
    this.touchStartPos = { x: touch.clientX, y: touch.clientY };
    
    // Set up delayed drag start (long press)
    this.touchStartTimer = setTimeout(() => {
      // Start drag after delay
      e.preventDefault();
      this.draggedPlayer = player;
      this.playerSystem.draggedPlayer = player; // Also set on playerSystem for compatibility
      this.touchDraggedElement = tile;
      
      // Create clone for visual feedback
      this.touchClone = tile.cloneNode(true);
      this.touchClone.style.position = 'fixed';
      this.touchClone.style.zIndex = '1000';
      this.touchClone.style.opacity = '0.8';
      this.touchClone.style.pointerEvents = 'none';
      this.touchClone.style.transform = 'scale(1.1)';
      this.touchClone.classList.add('dragging');
      document.body.appendChild(this.touchClone);
      
      // Position clone at touch point
      this.touchClone.style.left = (touch.clientX - tile.offsetWidth / 2) + 'px';
      this.touchClone.style.top = (touch.clientY - tile.offsetHeight / 2) + 'px';
      
      // Hide the original tile while dragging
      tile.style.opacity = '0.3';
      tile.classList.add('dragging');
      
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }, 200); // 200ms delay for long press
  }

  /**
   * Handle touch move event
   * @param {TouchEvent} e - Touch event
   */
  handleTouchMove(e) {
    const touch = e.touches[0];
    
    // If we haven't started dragging yet, check for movement
    if (!this.touchClone && this.touchStartTimer && this.touchStartPos) {
      const dx = Math.abs(touch.clientX - this.touchStartPos.x);
      const dy = Math.abs(touch.clientY - this.touchStartPos.y);
      
      // Cancel drag start if user moves finger significantly
      if (dx > 10 || dy > 10) {
        clearTimeout(this.touchStartTimer);
        this.touchStartTimer = null;
        this.touchStartPos = null;
        return;
      }
    }
    
    // Only prevent default if we're actually dragging
    if (!this.touchClone) return;
    e.preventDefault();
    
    // Update clone position
    this.touchClone.style.left = (touch.clientX - this.touchClone.offsetWidth / 2) + 'px';
    this.touchClone.style.top = (touch.clientY - this.touchClone.offsetHeight / 2) + 'px';
    
    // Find element under touch point (excluding the clone)
    this.touchClone.style.display = 'none';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    this.touchClone.style.display = 'block';
    
    // Highlight drop zones
    const dropZones = document.querySelectorAll('.rank-slot, .team-drop-zone, #playerPool, #unassignedPlayers');
    dropZones.forEach((zone) => {
      zone.classList.remove('drag-over');
    });
    
    if (elementBelow) {
      const dropZone = elementBelow.closest('.rank-slot, .team-drop-zone, #playerPool, #unassignedPlayers');
      if (dropZone) {
        dropZone.classList.add('drag-over');
      }
    }
  }

  /**
   * Handle touch end event
   * @param {TouchEvent} e - Touch event
   */
  handleTouchEnd(e) {
    // Clear the timer if it's still running
    if (this.touchStartTimer) {
      clearTimeout(this.touchStartTimer);
      this.touchStartTimer = null;
    }
    this.touchStartPos = null;
    
    // If we haven't started dragging, restore opacity and return
    if (!this.touchClone || !this.draggedPlayer) {
      if (this.touchDraggedElement) {
        this.touchDraggedElement.style.opacity = '';
        this.touchDraggedElement.classList.remove('dragging');
        this.touchDraggedElement = null;
      }
      return;
    }
    
    e.preventDefault();
    
    const touch = e.changedTouches[0];
    
    // Find element under touch point
    this.touchClone.style.display = 'none';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    this.touchClone.style.display = 'block';
    
    // Handle drop
    console.log('Touch end - checking for drop target');
    console.log('Element below:', elementBelow);
    console.log('Dragged player:', this.draggedPlayer);
    
    if (elementBelow && this.draggedPlayer) {
      const rankSlot = elementBelow.closest('.rank-slot');
      const pool = elementBelow.closest('#playerPool');
      const unassignedZone = elementBelow.closest('#unassignedPlayers');
      const teamZone = elementBelow.closest('.team-drop-zone');
      
      console.log('Found rankSlot:', rankSlot);
      console.log('Found teamZone:', teamZone);
      console.log('Found pool:', pool);
      console.log('Found unassignedZone:', unassignedZone);
      
      if (rankSlot) {
        console.log('Dropping on rank slot');
        this.handleRankDrop(rankSlot, this.draggedPlayer);
      } else if (pool) {
        console.log('Dropping on player pool');
        this.handlePoolDrop(this.draggedPlayer);
      } else if (unassignedZone) {
        console.log('Dropping on unassigned zone');
        // Move player back to unassigned
        this.draggedPlayer.team = null;
        this.playerSystem.gameState.savePlayers();
        this.playerSystem.renderPlayers();
        this.playerSystem.renderRankingArea();
      } else if (teamZone) {
        console.log('Dropping on team zone');
        this.handleTeamDropTouch(teamZone, this.draggedPlayer);
      } else {
        console.log('No valid drop target found');
      }
    } else {
      console.log('No element below touch point or no dragged player');
    }
    
    this.cleanup();
  }

  /**
   * Handle touch cancel event
   * @param {TouchEvent} e - Touch event
   */
  handleTouchCancel(e) {
    this.cleanup();
  }

  /**
   * Handle rank drop for touch
   * @param {HTMLElement} slot - Rank slot element
   * @param {Object} player - Player object
   */
  handleRankDrop(slot, player) {
    if (!player || !player.id) return;
    
    const rank = parseInt(slot.dataset.rank);
    if (!rank) return;
    
    this.playerSystem.handleRankDrop(rank, player);
    this.triggerAutoCalculate();
  }

  /**
   * Handle team drop for touch
   * @param {HTMLElement} zone - Team zone element
   * @param {Object} player - Player object
   */
  handleTeamDropTouch(zone, player) {
    const team = parseInt(zone.dataset.team);
    
    // Check if team is full
    const teamPlayers = this.playerSystem.gameState.players.filter(p => p.team === team);
    const maxPerTeam = parseInt(document.getElementById('mode').value) / 2;
    
    // Don't allow if team is full (not counting the current player if they're already on this team)
    if (teamPlayers.length >= maxPerTeam && !teamPlayers.some(p => p.id === player.id)) {
      alert('该队伍已满员！');
      this.playerSystem.renderPlayers();
      this.playerSystem.renderRankingArea();
      return;
    }
    
    // Update player's team
    player.team = team;
    this.playerSystem.gameState.savePlayers();
    this.playerSystem.renderPlayers();
    this.playerSystem.renderRankingArea();
  }

  /**
   * Handle pool drop for touch
   * @param {Object} player - Player object
   */
  handlePoolDrop(player) {
    // Remove from ranking
    for (const r in this.playerSystem.gameState.currentRanking) {
      if (this.playerSystem.gameState.currentRanking[r] === player.id) {
        delete this.playerSystem.gameState.currentRanking[r];
      }
    }
    
    // Re-render everything
    this.playerSystem.renderPlayerPool();
    this.playerSystem.renderRankingSlots();
    this.triggerAutoCalculate();
  }

  /**
   * Clean up touch drag state
   */
  cleanup() {
    // Clean up clone
    if (this.touchClone) {
      if (this.touchClone.parentNode) {
        this.touchClone.parentNode.removeChild(this.touchClone);
      }
      this.touchClone = null;
    }
    
    // Clean up any other floating clones
    const floatingClones = document.querySelectorAll('.dragging');
    floatingClones.forEach((clone) => {
      if (clone.style.position === 'fixed' && clone !== this.touchDraggedElement) {
        if (clone.parentNode) {
          clone.parentNode.removeChild(clone);
        }
      }
    });
    
    // Restore original element
    if (this.touchDraggedElement) {
      this.touchDraggedElement.classList.remove('dragging');
      this.touchDraggedElement.style.opacity = '';
      this.touchDraggedElement.style.display = '';
      this.touchDraggedElement = null;
    }
    
    this.draggedPlayer = null;
    this.playerSystem.draggedPlayer = null; // Also clear on playerSystem
    
    // Clear all highlights
    const dropZones = document.querySelectorAll('.rank-slot, .team-drop-zone, #playerPool, #unassignedPlayers');
    dropZones.forEach((zone) => {
      zone.classList.remove('drag-over');
    });
    
    // Force re-render to clean up any visual artifacts
    setTimeout(() => {
      this.playerSystem.renderPlayerPool();
      this.playerSystem.renderRankingSlots();
    }, 10);
  }

  /**
   * Trigger auto-calculation if callback is available
   */
  triggerAutoCalculate() {
    if (this.onAutoCalculate) {
      this.onAutoCalculate();
    }
  }

  /**
   * Set auto-calculation callback
   * @param {Function} callback - Auto-calculation callback
   */
  setAutoCalculateCallback(callback) {
    this.onAutoCalculate = callback;
  }

  /**
   * Add touch event listeners to a player tile
   * @param {HTMLElement} tile - Player tile element
   * @param {Object} player - Player object
   */
  addTouchListeners(tile, player) {
    tile.addEventListener('touchstart', (e) => {
      this.handleTouchStart(e, player);
    }, { passive: false });
    
    tile.addEventListener('touchmove', (e) => {
      this.handleTouchMove(e);
    }, { passive: false });
    
    tile.addEventListener('touchend', (e) => {
      this.handleTouchEnd(e);
    }, { passive: false });
    
    tile.addEventListener('touchcancel', (e) => {
      this.handleTouchCancel(e);
    }, { passive: false });
  }
}

export default TouchHandlers;