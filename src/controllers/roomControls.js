/**
 * Room Controls Controller
 * Handles multiplayer room buttons: Create, Join, Browse, Leave
 */

import { $, on } from '../core/utils.js';
import state from '../core/state.js';
import { createRoom, joinRoom, leaveRoom } from '../share/roomManager.js';

/**
 * Setup all room control button handlers
 */
export function setupRoomControls() {
  const createRoomBtn = $('createRoom');
  const joinRoomBtn = $('joinRoom');
  const browseRoomsBtn = $('browseRooms');
  const leaveRoomBtn = $('leaveRoom');

  // Create room
  if (createRoomBtn) {
    on(createRoomBtn, 'click', async () => {
      if (!confirm('创建房间将重置当前游戏数据，确定继续？')) {
        return;
      }

      // Reset game before creating room
      state.resetAll();

      const roomInfo = await createRoom();

      if (roomInfo) {
        // Redirect to room URL with auth token
        const roomURL = `${window.location.origin}${window.location.pathname}?room=${roomInfo.roomCode}&auth=${roomInfo.authToken}`;
        window.location.href = roomURL;
      } else {
        alert('创建房间失败，请稍后重试');
      }
    });
  }

  // Join room
  if (joinRoomBtn) {
    on(joinRoomBtn, 'click', () => {
      const roomCode = prompt('请输入6位房间代码 (例如: A1B2C3):');
      if (roomCode && roomCode.trim().length === 6) {
        const code = roomCode.trim().toUpperCase();
        window.location.href = `${window.location.pathname}?room=${code}`;
      }
    });
  }

  // Browse rooms - Navigate to rooms.html
  if (browseRoomsBtn) {
    on(browseRoomsBtn, 'click', () => {
      window.location.href = '/rooms.html';
    });
  }

  // Leave room
  if (leaveRoomBtn) {
    on(leaveRoomBtn, 'click', () => {
      if (confirm('确定要离开房间吗？')) {
        leaveRoom();
      }
    });
  }
}
