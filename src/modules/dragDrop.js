/**
 * Drag and Drop Handler Module
 * Unified handling for both mouse and touch events
 */

export class DragDropHandler {
  constructor() {
    this.draggedElement = null;
    this.draggedData = null;
    this.touchClone = null;
    this.longPressTimer = null;
    this.isMobile = 'ontouchstart' in window;
    
    // Callbacks
    this.onDrop = null;
    this.onDragStart = null;
    this.onDragEnd = null;
  }

  /**
   * Initialize draggable element
   */
  initializeDraggable(element, data) {
    if (this.isMobile) {
      this.initializeTouchDraggable(element, data);
    } else {
      this.initializeMouseDraggable(element, data);
    }
  }

  /**
   * Initialize drop zone
   */
  initializeDropZone(element) {
    if (this.isMobile) {
      // Touch drop zones don't need special initialization
      // We detect them using elementFromPoint
    } else {
      this.initializeMouseDropZone(element);
    }
  }

  /**
   * Initialize mouse draggable
   */
  initializeMouseDraggable(element, data) {
    element.draggable = true;
    
    element.addEventListener('dragstart', (e) => {
      this.draggedElement = element;
      this.draggedData = data;
      element.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', element.innerHTML);
      
      if (this.onDragStart) {
        this.onDragStart(data);
      }
    });
    
    element.addEventListener('dragend', (e) => {
      element.classList.remove('dragging');
      this.draggedElement = null;
      this.draggedData = null;
      
      if (this.onDragEnd) {
        this.onDragEnd();
      }
    });
  }

  /**
   * Initialize mouse drop zone
   */
  initializeMouseDropZone(element) {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      element.classList.add('drag-over');
    });
    
    element.addEventListener('dragleave', (e) => {
      element.classList.remove('drag-over');
    });
    
    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');
      
      if (this.draggedData && this.onDrop) {
        const dropZoneData = this.getDropZoneData(element);
        this.onDrop(this.draggedData, dropZoneData);
      }
    });
  }

  /**
   * Initialize touch draggable
   */
  initializeTouchDraggable(element, data) {
    let startX, startY;
    let isDragging = false;
    
    element.addEventListener('touchstart', (e) => {
      // Don't interfere with input fields
      if (e.target.tagName === 'INPUT') {
        return;
      }
      
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      
      // Long press to start drag (200ms)
      this.longPressTimer = setTimeout(() => {
        isDragging = true;
        this.startTouchDrag(element, data, touch);
        
        // Haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, 200);
    }, { passive: false });
    
    element.addEventListener('touchmove', (e) => {
      if (!isDragging) {
        // Cancel long press if moved too much
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        
        if (deltaX > 10 || deltaY > 10) {
          clearTimeout(this.longPressTimer);
        }
        return;
      }
      
      e.preventDefault();
      this.handleTouchMove(e.touches[0]);
    }, { passive: false });
    
    element.addEventListener('touchend', (e) => {
      clearTimeout(this.longPressTimer);
      
      if (!isDragging) {
        return;
      }
      
      isDragging = false;
      this.handleTouchEnd(e.changedTouches[0]);
    });
    
    element.addEventListener('touchcancel', () => {
      clearTimeout(this.longPressTimer);
      isDragging = false;
      this.cleanupTouchDrag();
    });
  }

  /**
   * Start touch drag
   */
  startTouchDrag(element, data, touch) {
    this.draggedElement = element;
    this.draggedData = data;
    
    // Create clone for visual feedback
    this.touchClone = element.cloneNode(true);
    this.touchClone.classList.add('dragging', 'touch-clone');
    this.touchClone.style.position = 'fixed';
    this.touchClone.style.pointerEvents = 'none';
    this.touchClone.style.zIndex = '9999';
    this.touchClone.style.opacity = '0.8';
    this.touchClone.style.transform = 'scale(1.1)';
    
    // Position clone at touch point
    const rect = element.getBoundingClientRect();
    this.touchClone.style.width = rect.width + 'px';
    this.touchClone.style.left = (touch.clientX - rect.width / 2) + 'px';
    this.touchClone.style.top = (touch.clientY - rect.height / 2) + 'px';
    
    document.body.appendChild(this.touchClone);
    
    // Hide original element
    element.style.opacity = '0.3';
    
    if (this.onDragStart) {
      this.onDragStart(data);
    }
  }

  /**
   * Handle touch move
   */
  handleTouchMove(touch) {
    if (!this.touchClone) return;
    
    // Update clone position
    const rect = this.touchClone.getBoundingClientRect();
    this.touchClone.style.left = (touch.clientX - rect.width / 2) + 'px';
    this.touchClone.style.top = (touch.clientY - rect.height / 2) + 'px';
    
    // Highlight drop zone under touch
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    this.highlightDropZone(elementBelow);
  }

  /**
   * Handle touch end
   */
  handleTouchEnd(touch) {
    // Find element under touch point
    if (this.touchClone) {
      this.touchClone.style.display = 'none';
    }
    
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (this.touchClone) {
      this.touchClone.style.display = 'block';
    }
    
    // Check if it's a valid drop zone
    const dropZone = this.findDropZone(elementBelow);
    
    if (dropZone && this.draggedData && this.onDrop) {
      const dropZoneData = this.getDropZoneData(dropZone);
      this.onDrop(this.draggedData, dropZoneData);
    }
    
    this.cleanupTouchDrag();
  }

  /**
   * Cleanup touch drag
   */
  cleanupTouchDrag() {
    if (this.touchClone) {
      this.touchClone.remove();
      this.touchClone = null;
    }
    
    if (this.draggedElement) {
      this.draggedElement.style.opacity = '';
    }
    
    // Remove all highlights
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    
    this.draggedElement = null;
    this.draggedData = null;
    
    if (this.onDragEnd) {
      this.onDragEnd();
    }
  }

  /**
   * Find drop zone from element
   */
  findDropZone(element) {
    if (!element) return null;
    
    // Check if element itself is a drop zone
    if (element.classList.contains('rank-box') || 
        element.classList.contains('team-drop-zone') ||
        element.classList.contains('player-pool')) {
      return element;
    }
    
    // Check parent elements
    return element.closest('.rank-box, .team-drop-zone, .player-pool');
  }

  /**
   * Get drop zone data
   */
  getDropZoneData(dropZone) {
    if (dropZone.classList.contains('rank-box')) {
      return {
        type: 'rank',
        rank: parseInt(dropZone.dataset.rank)
      };
    }
    
    if (dropZone.classList.contains('team-drop-zone')) {
      return {
        type: 'team',
        team: parseInt(dropZone.dataset.team)
      };
    }
    
    if (dropZone.classList.contains('player-pool')) {
      return {
        type: 'pool'
      };
    }
    
    return null;
  }

  /**
   * Highlight drop zone
   */
  highlightDropZone(element) {
    // Remove previous highlights
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    
    // Add highlight to current drop zone
    const dropZone = this.findDropZone(element);
    if (dropZone) {
      dropZone.classList.add('drag-over');
    }
  }

  /**
   * Clean up all drag state
   */
  cleanup() {
    this.cleanupTouchDrag();
    clearTimeout(this.longPressTimer);
  }
}