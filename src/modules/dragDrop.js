/**
 * Drag and drop handling module for player tiles
 */

export class DragDropManager {
  constructor() {
    this.draggedPlayer = null;
    this.touchDraggedElement = null;
    this.touchClone = null;
    this.touchStartTimer = null;
    this.touchStartPos = null;
    this.onDrop = null; // Callback function
  }
  
  /**
   * Initialize drag and drop for an element
   * @param {HTMLElement} element - Element to make draggable
   * @param {Object} player - Player data
   */
  initDraggable(element, player) {
    // Desktop drag events
    element.draggable = true;
    
    element.addEventListener('dragstart', (e) => {
      this.handleDragStart(e, player);
    });
    
    element.addEventListener('dragend', (e) => {
      this.handleDragEnd(e);
    });
    
    // Touch events for mobile
    element.addEventListener('touchstart', (e) => {
      this.handleTouchStart(e, player);
    }, { passive: false });
    
    element.addEventListener('touchmove', (e) => {
      this.handleTouchMove(e);
    }, { passive: false });
    
    element.addEventListener('touchend', (e) => {
      this.handleTouchEnd(e);
    });
    
    element.addEventListener('touchcancel', (e) => {
      this.handleTouchEnd(e);
    });
  }
  
  /**
   * Initialize drop zone
   * @param {HTMLElement} element - Drop zone element
   * @param {string} type - Type of drop zone ('team', 'rank', 'pool')
   * @param {*} data - Additional data for the drop zone
   */
  initDropZone(element, type, data) {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      element.classList.add('drag-over');
    });
    
    element.addEventListener('dragleave', () => {
      element.classList.remove('drag-over');
    });
    
    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');
      
      if (this.draggedPlayer && this.onDrop) {
        this.onDrop(type, data, this.draggedPlayer);
      }
      
      this.draggedPlayer = null;
    });
  }
  
  /**
   * Handle drag start
   * @param {DragEvent} e - Drag event
   * @param {Object} player - Player being dragged
   */
  handleDragStart(e, player) {
    this.draggedPlayer = player;
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
  }
  
  /**
   * Handle drag end
   * @param {DragEvent} e - Drag event
   */
  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    
    // Remove all drag-over classes
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  }
  
  /**
   * Handle touch start
   * @param {TouchEvent} e - Touch event
   * @param {Object} player - Player being dragged
   */
  handleTouchStart(e, player) {
    // Don't start drag if touching an input field
    if (e.target.tagName === 'INPUT') {
      return;
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
   * Handle touch move
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
      }
      return;
    }
    
    // Only prevent default if we're actually dragging
    if (this.touchClone) {
      e.preventDefault();
      
      // Update clone position
      this.touchClone.style.left = (touch.clientX - this.touchClone.offsetWidth / 2) + 'px';
      this.touchClone.style.top = (touch.clientY - this.touchClone.offsetHeight / 2) + 'px';
      
      // Find element under touch point (excluding the clone)
      this.touchClone.style.display = 'none';
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      this.touchClone.style.display = '';
      
      // Highlight drop zones
      document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
      
      if (elementBelow) {
        const dropZone = elementBelow.closest('.team-drop-zone, .rank-slot, .player-pool, .unassigned-players');
        if (dropZone) {
          dropZone.classList.add('drag-over');
        }
      }
    }
  }
  
  /**
   * Handle touch end
   * @param {TouchEvent} e - Touch event
   */
  handleTouchEnd(e) {
    // Clear the timer if it's still running
    if (this.touchStartTimer) {
      clearTimeout(this.touchStartTimer);
      this.touchStartTimer = null;
    }
    
    // If we haven't started dragging, restore opacity and return
    if (!this.touchClone) {
      if (this.touchDraggedElement) {
        this.touchDraggedElement.style.opacity = '';
        this.touchDraggedElement.classList.remove('dragging');
      }
      this.touchDraggedElement = null;
      this.draggedPlayer = null;
      return;
    }
    
    // Find element under touch point
    const touch = e.changedTouches[0];
    this.touchClone.style.display = 'none';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    this.touchClone.style.display = '';
    
    // Handle drop
    if (elementBelow && this.draggedPlayer && this.onDrop) {
      const teamZone = elementBelow.closest('.team-drop-zone');
      const rankSlot = elementBelow.closest('.rank-slot');
      const poolZone = elementBelow.closest('.player-pool, .unassigned-players');
      
      if (teamZone) {
        const team = parseInt(teamZone.dataset.team, 10);
        this.onDrop('team', team, this.draggedPlayer);
      } else if (rankSlot) {
        const rank = parseInt(rankSlot.dataset.rank, 10);
        this.onDrop('rank', rank, this.draggedPlayer);
      } else if (poolZone) {
        this.onDrop('pool', null, this.draggedPlayer);
      }
    }
    
    // Clean up
    if (this.touchClone && this.touchClone.parentNode) {
      this.touchClone.parentNode.removeChild(this.touchClone);
    }
    this.touchClone = null;
    
    if (this.touchDraggedElement) {
      this.touchDraggedElement.style.opacity = '';
      this.touchDraggedElement.classList.remove('dragging');
    }
    
    // Clear all highlights
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    
    // Reset state
    this.touchDraggedElement = null;
    this.draggedPlayer = null;
    this.touchStartPos = null;
  }
  
  /**
   * Clean up any floating clones
   */
  cleanupClones() {
    // Remove any floating touch clones
    const clones = document.querySelectorAll('.player-tile.dragging');
    clones.forEach(clone => {
      if (clone.style.position === 'fixed') {
        clone.remove();
      }
    });
    
    // Also clean up any other floating clones
    document.querySelectorAll('.ranking-player-tile.dragging').forEach(clone => {
      if (clone.style.position === 'fixed') {
        clone.remove();
      }
    });
  }
  
  /**
   * Set drop callback
   * @param {Function} callback - Callback function(type, data, player)
   */
  setDropCallback(callback) {
    this.onDrop = callback;
  }
}