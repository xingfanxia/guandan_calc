/**
 * Touch Handler - Mobile Touch Interactions
 * Extracted from app.js lines 185-381
 * Handles mobile long-press drag-and-drop
 */

import { getDraggedPlayer, setDraggedPlayer } from './playerRenderer.js';
import { assignPlayerToTeam } from './playerManager.js';
import { handleRankDrop, handlePoolDrop } from './dragDrop.js';
import state from '../core/state.js';
import { emit } from '../core/events.js';

// Touch drag state
let touchDraggedElement = null;
let touchClone = null;
let touchStartTimer = null;
let touchStartPos = null;
let isDragging = false;  // Track if actively dragging
let touchOffset = null; // Store offset from touch point to tile origin
let cloneHalfWidth = 0;  // Store clone dimensions to avoid getBoundingClientRect in touchmove
let cloneHalfHeight = 0;

/**
 * Handle touch start (long-press detection)
 * @param {TouchEvent} e - Touch event
 * @param {Object} player - Player being touched
 */
export function handleTouchStart(e, player) {
  // Don't start drag if touching an input field
  if (e.target.tagName === 'INPUT') {
    return;
  }

  // Force cleanup any previous drag state
  cleanupTouchDrag();

  const touch = e.touches[0];
  const tile = e.currentTarget;

  // Store initial touch position
  touchStartPos = { x: touch.clientX, y: touch.clientY };

  // Set up delayed drag start (long press)
  touchStartTimer = setTimeout(() => {
    // Start drag after delay
    e.preventDefault();
    isDragging = true;
    setDraggedPlayer(player);
    touchDraggedElement = tile;

    // Create clone for visual feedback
    touchClone = tile.cloneNode(true);
    touchClone.id = 'touch-drag-clone-' + Date.now();
    touchClone.style.position = 'fixed';
    touchClone.style.zIndex = '1000';
    touchClone.style.opacity = '0.8';
    touchClone.style.pointerEvents = 'none';
    touchClone.style.transform = 'scale(1.05)';
    touchClone.classList.add('dragging', 'touch-clone');
    document.body.appendChild(touchClone);

    // Calculate dimensions ONCE (avoid getBoundingClientRect in touchmove)
    const cloneRect = touchClone.getBoundingClientRect();
    cloneHalfWidth = cloneRect.width / 2;
    cloneHalfHeight = cloneRect.height / 2;
    
    // Center the clone under finger
    touchClone.style.left = (touch.clientX - cloneHalfWidth) + 'px';
    touchClone.style.top = (touch.clientY - cloneHalfHeight) + 'px';

    // Hide original tile
    tile.style.opacity = '0.3';
    tile.classList.add('dragging');

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    emit('touch:dragStarted', { player });
  }, 200);
}

/**
 * Handle touch move (drag in progress)
 * @param {TouchEvent} e - Touch event
 */
export function handleTouchMove(e) {
  const touch = e.touches[0];

  // If not dragging yet, check for movement that should cancel long-press
  if (!isDragging && touchStartTimer && touchStartPos) {
    const dx = Math.abs(touch.clientX - touchStartPos.x);
    const dy = Math.abs(touch.clientY - touchStartPos.y);

    if (dx > 10 || dy > 10) {
      clearTimeout(touchStartTimer);
      touchStartTimer = null;
      touchStartPos = null;
      return;
    }
  }

  // Only prevent default and update if actively dragging
  if (!isDragging || !touchClone) return;
  
  e.preventDefault();
  e.stopPropagation();

  // Update clone position using cached dimensions (NO getBoundingClientRect!)
  touchClone.style.left = (touch.clientX - cloneHalfWidth) + 'px';
  touchClone.style.top = (touch.clientY - cloneHalfHeight) + 'px';

  // Skip expensive drop zone highlighting during drag - only check on drop
  // This eliminates querySelectorAll + classList manipulation 60x per second
}

/**
 * Handle touch end (drop)
 * @param {TouchEvent} e - Touch event
 * @returns {Object|null} Drop target info
 */
export function handleTouchEnd(e) {
  // Clear timer if still running
  if (touchStartTimer) {
    clearTimeout(touchStartTimer);
    touchStartTimer = null;
  }
  touchStartPos = null;

  // If not dragging, just cleanup
  if (!isDragging || !touchClone || !getDraggedPlayer()) {
    cleanupTouchDrag();
    return null;
  }

  e.preventDefault();
  e.stopPropagation();

  const touch = e.changedTouches[0];
  const player = getDraggedPlayer();

  // Find element under touch point
  const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);

  let dropTarget = null;

  if (elementBelow && player) {
    const rankSlot = elementBelow.closest('.rank-slot');
    const pool = elementBelow.closest('#playerPool');
    const unassignedZone = elementBelow.closest('#unassignedPlayers');
    const teamZone = elementBelow.closest('.team-drop-zone');

    console.log('Touch drop detected:', { rankSlot: !!rankSlot, pool: !!pool, elementBelow: elementBelow.className });

    if (rankSlot) {
      console.log('Dropping on rank slot:', rankSlot.dataset.rank);
      const currentRanking = state.getCurrentRanking();
      const newRanking = handleRankDrop(rankSlot, player, currentRanking);
      state.setCurrentRanking(newRanking);
      emit('ranking:updated');
      dropTarget = { type: 'rank', element: rankSlot, player };
    } else if (pool) {
      const currentRanking = state.getCurrentRanking();
      const newRanking = handlePoolDrop(player, currentRanking);
      state.setCurrentRanking(newRanking);
      dropTarget = { type: 'pool', element: pool, player };
    } else if (unassignedZone) {
      assignPlayerToTeam(player.id, null);
      dropTarget = { type: 'unassigned', element: unassignedZone, player };
    } else if (teamZone) {
      const team = parseInt(teamZone.dataset.team);
      if (team) {
        assignPlayerToTeam(player.id, team);
        dropTarget = { type: 'team', element: teamZone, player };
      }
    }
  }

  // Cleanup
  cleanupTouchDrag();

  emit('touch:dragEnded', { player, dropTarget });

  return dropTarget;
}

/**
 * Handle touch cancel (when touch is interrupted)
 * @param {TouchEvent} e - Touch event
 */
export function handleTouchCancel(e) {
  console.log('Touch cancelled, cleaning up');
  if (touchStartTimer) {
    clearTimeout(touchStartTimer);
    touchStartTimer = null;
  }
  cleanupTouchDrag();
}

/**
 * Cleanup touch drag state (more aggressive)
 */
function cleanupTouchDrag() {
  // Clear dragging flag first
  isDragging = false;

  // Clear timer
  if (touchStartTimer) {
    clearTimeout(touchStartTimer);
    touchStartTimer = null;
  }
  touchStartPos = null;

  // Remove the specific clone
  if (touchClone) {
    try {
      if (touchClone.parentNode) {
        touchClone.parentNode.removeChild(touchClone);
      }
    } catch (e) {
      console.warn('Failed to remove clone:', e);
    }
    touchClone = null;
  }

  // Aggressively clean up ANY lingering touch clones
  const allClones = document.querySelectorAll('.touch-clone');
  allClones.forEach(clone => {
    try {
      if (clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
    } catch (e) {
      console.warn('Failed to remove lingering clone:', e);
    }
  });

  // Clean up dragging class from fixed elements
  const draggingElements = document.querySelectorAll('.dragging');
  draggingElements.forEach(elem => {
    if (elem.style.position === 'fixed') {
      try {
        if (elem.parentNode) {
          elem.parentNode.removeChild(elem);
        }
      } catch (e) {
        // Ignore
      }
    }
  });

  // Restore original element
  if (touchDraggedElement) {
    touchDraggedElement.classList.remove('dragging');
    touchDraggedElement.style.opacity = '';
    touchDraggedElement.style.display = '';
    touchDraggedElement.style.visibility = '';
    touchDraggedElement = null;
  }

  setDraggedPlayer(null);

  // Clear drop zone highlights
  const dropZones = document.querySelectorAll('.rank-slot, .team-drop-zone, #playerPool, #unassignedPlayers');
  dropZones.forEach(zone => zone.classList.remove('drag-over'));
}

/**
 * Cancel current touch drag
 */
export function cancelTouchDrag() {
  cleanupTouchDrag();
}

// Global cleanup on visibility change (tab switch, etc.)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cleanupTouchDrag();
    }
  });
}
