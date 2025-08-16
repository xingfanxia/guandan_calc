/**
 * Drag and Drop Handler
 * Unified handling for mouse and touch events
 */

import { CONFIG } from '../core/config.js';

export class DragDropHandler {
  constructor() {
    this.draggedElement = null;
    this.draggedPlayer = null;
    this.touchClone = null;
    this.longPressTimer = null;
    this.isMobile = 'ontouchstart' in window;
    
    // Callbacks
    this.onDragStart = null;
    this.onDragEnd = null;
    this.onDrop = null;
  }

  /**
   * Initialize draggable element
   */
  initDraggable(element, playerData) {
    if (this.isMobile) {
      this.initTouchDraggable(element, playerData);
    } else {
      this.initMouseDraggable(element, playerData);
    }
  }

  /**
   * Initialize drop zone
   */
  initDropZone(element, dropData) {
    if (this.isMobile) {
      // Touch drop zones are detected via elementFromPoint
      element.dataset.dropType = dropData.type;
      element.dataset.dropData = JSON.stringify(dropData);
    } else {
      this.initMouseDropZone(element, dropData);
    }
  }

  // ============= Mouse Events =============

  initMouseDraggable(element, playerData) {
    element.draggable = true;
    
    element.addEventListener('dragstart', (e) => {
      this.draggedElement = element;
      this.draggedPlayer = playerData;
      
      element.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(playerData));
      
      if (this.onDragStart) {
        this.onDragStart(playerData);
      }
    });
    
    element.addEventListener('dragend', (e) => {
      element.classList.remove('dragging');
      this.cleanup();
      
      if (this.onDragEnd) {
        this.onDragEnd();
      }
    });
  }

  initMouseDropZone(element, dropData) {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      element.classList.add('drag-over');
    });
    
    element.addEventListener('dragleave', (e) => {
      // Check if we're actually leaving the element
      if (!element.contains(e.relatedTarget)) {
        element.classList.remove('drag-over');
      }
    });
    
    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');
      
      if (this.draggedPlayer && this.onDrop) {
        this.onDrop(this.draggedPlayer, dropData);
      }
    });
  }

  // ============= Touch Events =============

  initTouchDraggable(element, playerData) {
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
      
      // Long press to start drag
      this.longPressTimer = setTimeout(() => {
        isDragging = true;
        this.startTouchDrag(element, playerData, touch);
        
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(CONFIG.UI.VIBRATE_DURATION);
        }
      }, CONFIG.UI.DRAG_DELAY);
      
      e.preventDefault();
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
      const touch = e.touches[0];
      this.handleTouchMove(touch);
    }, { passive: false });
    
    element.addEventListener('touchend', (e) => {
      clearTimeout(this.longPressTimer);
      
      if (!isDragging) {
        return;
      }
      
      isDragging = false;
      const touch = e.changedTouches[0];
      this.handleTouchEnd(touch);
    });
    
    element.addEventListener('touchcancel', () => {
      clearTimeout(this.longPressTimer);
      isDragging = false;
      this.cleanup();
    });
  }

  startTouchDrag(element, playerData, touch) {
    this.draggedElement = element;
    this.draggedPlayer = playerData;
    
    // Create visual clone
    this.touchClone = element.cloneNode(true);
    this.touchClone.classList.add('dragging', 'touch-clone');
    this.touchClone.style.position = 'fixed';
    this.touchClone.style.pointerEvents = 'none';
    this.touchClone.style.zIndex = '9999';
    this.touchClone.style.opacity = '0.8';
    this.touchClone.style.transform = 'scale(1.05)';
    
    // Position at touch point
    const rect = element.getBoundingClientRect();
    this.touchClone.style.width = rect.width + 'px';
    this.touchClone.style.left = (touch.clientX - rect.width / 2) + 'px';
    this.touchClone.style.top = (touch.clientY - rect.height / 2) + 'px';
    
    document.body.appendChild(this.touchClone);
    
    // Hide original
    element.style.opacity = '0.3';
    
    if (this.onDragStart) {
      this.onDragStart(playerData);
    }
  }

  handleTouchMove(touch) {
    if (!this.touchClone) return;
    
    // Update clone position
    const rect = this.touchClone.getBoundingClientRect();
    this.touchClone.style.left = (touch.clientX - rect.width / 2) + 'px';
    this.touchClone.style.top = (touch.clientY - rect.height / 2) + 'px';
    
    // Highlight drop zone under touch
    this.highlightDropZone(touch.clientX, touch.clientY);
  }

  handleTouchEnd(touch) {
    // Find element under touch point
    if (this.touchClone) {
      this.touchClone.style.display = 'none';
    }
    
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (this.touchClone) {
      this.touchClone.style.display = 'block';
    }
    
    // Check for drop zone
    const dropZone = this.findDropZone(elementBelow);
    
    if (dropZone && this.draggedPlayer && this.onDrop) {
      const dropData = JSON.parse(dropZone.dataset.dropData || '{}');
      this.onDrop(this.draggedPlayer, dropData);
    }
    
    this.cleanup();
    
    if (this.onDragEnd) {
      this.onDragEnd();
    }
  }

  // ============= Helper Methods =============

  findDropZone(element) {
    if (!element) return null;
    
    // Check if element itself is a drop zone
    if (element.dataset.dropType) {
      return element;
    }
    
    // Check parent elements
    return element.closest('[data-drop-type]');
  }

  highlightDropZone(x, y) {
    // Remove previous highlights
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    
    // Hide clone temporarily
    if (this.touchClone) {
      this.touchClone.style.display = 'none';
    }
    
    const elementBelow = document.elementFromPoint(x, y);
    
    if (this.touchClone) {
      this.touchClone.style.display = 'block';
    }
    
    const dropZone = this.findDropZone(elementBelow);
    if (dropZone) {
      dropZone.classList.add('drag-over');
    }
  }

  cleanup() {
    // Remove clone
    if (this.touchClone) {
      this.touchClone.remove();
      this.touchClone = null;
    }
    
    // Restore original element
    if (this.draggedElement) {
      this.draggedElement.style.opacity = '';
      this.draggedElement.classList.remove('dragging');
    }
    
    // Remove highlights
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    
    // Clear references
    this.draggedElement = null;
    this.draggedPlayer = null;
    
    // Clear timer
    clearTimeout(this.longPressTimer);
  }

  /**
   * Destroy handler and clean up
   */
  destroy() {
    this.cleanup();
    this.onDragStart = null;
    this.onDragEnd = null;
    this.onDrop = null;
  }
}

export default DragDropHandler;