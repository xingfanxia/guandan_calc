/**
 * Touch Handler - Mobile Touch Interactions
 * Extracted from app.js lines 185-381
 * Handles mobile long-press drag-and-drop
 */

import { getDraggedPlayer, setDraggedPlayer } from './playerRenderer.js';
import { emit } from '../core/events.js';

// Touch drag state
let touchDraggedElement = null;
let touchClone = null;
let touchStartTimer = null;
let touchStartPos = null;

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

  const touch = e.touches[0];
  const tile = e.currentTarget;

  // Store initial touch position
  touchStartPos = { x: touch.clientX, y: touch.clientY };

  // Set up delayed drag start (long press)
  touchStartTimer = setTimeout(() => {
    // Start drag after delay
    e.preventDefault();
    setDraggedPlayer(player);
    touchDraggedElement = tile;

    // Create clone for visual feedback
    touchClone = tile.cloneNode(true);
    touchClone.style.position = 'fixed';
    touchClone.style.zIndex = '1000';
    touchClone.style.opacity = '0.8';
    touchClone.style.pointerEvents = 'none';
    touchClone.style.transform = 'scale(1.1)';
    touchClone.classList.add('dragging');
    document.body.appendChild(touchClone);

    // Position clone at touch point
    touchClone.style.left = (touch.clientX - tile.offsetWidth / 2) + 'px';
    touchClone.style.top = (touch.clientY - tile.offsetHeight / 2) + 'px';

    // Hide original tile
    tile.style.opacity = '0.3';
    tile.classList.add('dragging');

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    emit('touch:dragStarted', { player });
  }, 200); // 200ms delay for long press
}

/**
 * Handle touch move (drag in progress)
 * @param {TouchEvent} e - Touch event
 */
export function handleTouchMove(e) {
  const touch = e.touches[0];

  // If not dragging yet, check for movement that should cancel long-press
  if (!touchClone && touchStartTimer && touchStartPos) {
    const dx = Math.abs(touch.clientX - touchStartPos.x);
    const dy = Math.abs(touch.clientY - touchStartPos.y);

    // Cancel drag start if finger moved significantly
    if (dx > 10 || dy > 10) {
      clearTimeout(touchStartTimer);
      touchStartTimer = null;
      touchStartPos = null;
      return;
    }
  }

  // Only prevent default if actively dragging
  if (!touchClone) return;
  e.preventDefault();

  // Update clone position
  touchClone.style.left = (touch.clientX - touchClone.offsetWidth / 2) + 'px';
  touchClone.style.top = (touch.clientY - touchClone.offsetHeight / 2) + 'px';

  // Find element under touch point
  touchClone.style.display = 'none';
  const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
  touchClone.style.display = 'block';

  // Highlight drop zones
  const dropZones = document.querySelectorAll('.rank-slot, .team-drop-zone, #playerPool, #unassignedPlayers');
  dropZones.forEach(zone => zone.classList.remove('drag-over'));

  if (elementBelow) {
    const dropZone = elementBelow.closest('.rank-slot, .team-drop-zone, #playerPool, #unassignedPlayers');
    if (dropZone) {
      dropZone.classList.add('drag-over');
    }
  }
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
  if (!touchClone || !getDraggedPlayer()) {
    if (touchDraggedElement) {
      touchDraggedElement.style.opacity = '';
      touchDraggedElement.classList.remove('dragging');
      touchDraggedElement = null;
    }
    return null;
  }

  e.preventDefault();

  const touch = e.changedTouches[0];
  const player = getDraggedPlayer();

  // Find element under touch point
  touchClone.style.display = 'none';
  const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
  touchClone.style.display = 'block';

  let dropTarget = null;

  if (elementBelow && player) {
    const rankSlot = elementBelow.closest('.rank-slot');
    const pool = elementBelow.closest('#playerPool');
    const unassignedZone = elementBelow.closest('#unassignedPlayers');
    const teamZone = elementBelow.closest('.team-drop-zone');

    if (rankSlot) {
      dropTarget = { type: 'rank', element: rankSlot, player };
    } else if (pool) {
      dropTarget = { type: 'pool', element: pool, player };
    } else if (unassignedZone) {
      dropTarget = { type: 'unassigned', element: unassignedZone, player };
    } else if (teamZone) {
      dropTarget = { type: 'team', element: teamZone, player };
    }
  }

  // Cleanup
  cleanupTouchDrag();

  emit('touch:dragEnded', { player, dropTarget });

  return dropTarget;
}

/**
 * Cleanup touch drag state
 */
function cleanupTouchDrag() {
  // Remove clone
  if (touchClone && touchClone.parentNode) {
    touchClone.parentNode.removeChild(touchClone);
  }
  touchClone = null;

  // Clean up any other floating clones
  const floatingClones = document.querySelectorAll('.dragging');
  floatingClones.forEach(clone => {
    if (clone.style.position === 'fixed' && clone !== touchDraggedElement) {
      if (clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
    }
  });

  // Restore original element
  if (touchDraggedElement) {
    touchDraggedElement.classList.remove('dragging');
    touchDraggedElement.style.opacity = '';
    touchDraggedElement.style.display = '';
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
  if (touchStartTimer) {
    clearTimeout(touchStartTimer);
    touchStartTimer = null;
  }
  cleanupTouchDrag();
}
