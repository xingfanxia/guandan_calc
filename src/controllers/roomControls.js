/**
 * Room Controls Controller
 * Handles multiplayer room buttons: Create, Join, Browse, Leave
 */

import { $, on } from '../core/utils.js';
import { on as onEvent } from '../core/events.js';
import state from '../core/state.js';
import {
  createRoom,
  getRoomInfo,
  leaveRoom,
  setRoomFavoriteState
} from '../share/roomManager.js';
import { clearRoomUI } from '../share/roomUI.js';

export function getFavoriteButtonViewModel(roomInfo) {
  if (!roomInfo?.roomCode || !roomInfo.isHost) {
    return {
      visible: false,
      text: '⭐ 收藏房间',
      title: '只有房主可以收藏房间'
    };
  }

  if (roomInfo.isFavorite) {
    return {
      visible: true,
      text: '★ 取消收藏',
      title: '取消收藏，房间恢复一年有效期'
    };
  }

  return {
    visible: true,
    text: '⭐ 收藏房间',
    title: '收藏房间并永久保存'
  };
}

/**
 * Setup all room control button handlers
 */
export function setupRoomControls() {
  const createRoomBtn = $('createRoom');
  const joinRoomBtn = $('joinRoom');
  const browseRoomsBtn = $('browseRooms');
  const leaveRoomBtn = $('leaveRoom');
  const newRoomBtn = $('newRoom');
  const favoriteButtons = [
    $('favoriteRoom'),
    $('favoriteRoomTop')
  ].filter(Boolean);

  function refreshFavoriteButtons() {
    const viewModel = getFavoriteButtonViewModel(getRoomInfo());
    favoriteButtons.forEach(button => {
      button.style.display = viewModel.visible ? '' : 'none';
      button.textContent = viewModel.text;
      button.title = viewModel.title;
      button.disabled = false;
    });
  }

  async function toggleFavoriteRoom() {
    const roomInfo = getRoomInfo();
    if (!roomInfo.roomCode || !roomInfo.isHost || !roomInfo.authToken) return;

    const nextFavoriteState = !roomInfo.isFavorite;
    favoriteButtons.forEach(button => {
      button.disabled = true;
    });

    try {
      const response = await fetch(`/api/rooms/favorite/${encodeURIComponent(roomInfo.roomCode)}`, {
        method: nextFavoriteState ? 'POST' : 'DELETE',
        headers: {
          Authorization: `Bearer ${roomInfo.authToken}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Failed to update room favorite state:', {
          roomCode: roomInfo.roomCode,
          status: response.status,
          body: text
        });
        alert('收藏房间失败，请稍后重试');
        return;
      }

      setRoomFavoriteState(nextFavoriteState);
      refreshFavoriteButtons();
    } catch (error) {
      console.error('Error updating room favorite state:', error);
      alert('收藏房间失败，请稍后重试');
    } finally {
      favoriteButtons.forEach(button => {
        button.disabled = false;
      });
    }
  }

  // Top-level new-room CTA at the page header forwards to the same handler
  // as the in-card createRoom button (visible during gameplay; the
  // multiplayer setup card is hidden by setupVisibility.js once a game starts).
  if (newRoomBtn && createRoomBtn) {
    on(newRoomBtn, 'click', () => createRoomBtn.click());
  }

  // Create room
  if (createRoomBtn) {
    on(createRoomBtn, 'click', async () => {
      // Only warn about discarding data when there's actually an in-progress
      // game — a fresh blank start (the room-gate path) creates silently.
      if (state.isGameInProgress() && !confirm('创建房间将重置当前游戏数据，确定继续？')) {
        return;
      }

      // Reset game before creating room
      state.resetAll();

      const roomInfo = await createRoom();

      if (roomInfo) {
        // Redirect to room URL with auth token
        const params = new URLSearchParams({
          room: roomInfo.roomCode,
          auth: roomInfo.authToken
        });
        const roomURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
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
        const params = new URLSearchParams({ room: code });
        window.location.href = `${window.location.pathname}?${params.toString()}`;
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
        clearRoomUI();
      }
    });
  }

  favoriteButtons.forEach(button => {
    on(button, 'click', toggleFavoriteRoom);
  });

  [
    'room:created',
    'room:joined',
    'room:left',
    'room:dataLoaded',
    'room:favoriteChanged'
  ].forEach(eventName => {
    onEvent(eventName, refreshFavoriteButtons);
  });

  refreshFavoriteButtons();
}
