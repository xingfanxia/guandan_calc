/**
 * Room Manager - Real-time Room Sharing with Vercel KV
 * Handles room creation, joining, syncing, and viewer mode
 */

import state from '../core/state.js';
import config from '../core/config.js';
import { getPlayers } from '../player/playerManager.js';
import { emit } from '../core/events.js';

// Room state
let currentRoomCode = null;
let authToken = null;
let isHost = false;
let isViewer = false;
let roomCreatedAt = null;  // Track room creation time for timer
let syncInterval = null;
let pollInterval = null;
let lastKnownUpdate = null;

// Development mode check (disabled - vercel dev provides API access)
const isDevelopment = false; // Set to true only if using pure Vite (npm run dev)

/**
 * Create a new room
 * @returns {Promise<{roomCode: string, authToken: string}|null>}
 */
export async function createRoom() {
  // Check if in development mode
  if (isDevelopment) {
    alert('房间功能需要部署到 Vercel 才能使用\n\n本地开发模式下无法连接 Vercel KV 数据库\n\n请运行 "npm run build" 并部署到 Vercel 后测试房间功能');
    return null;
  }

  try {
    // Gather current game state
    const roomData = {
      settings: config.getAll(),
      state: {
        teams: {
          t1: state.getTeam('t1'),
          t2: state.getTeam('t2')
        },
        roundLevel: state.getRoundLevel(),
        roundOwner: state.getRoundOwner(),
        nextRoundBase: state.getNextRoundBase(),
        history: state.getHistory(),
        winner: state.getWinner()
      },
      players: getPlayers(),
      playerStats: state.getPlayerStats(),
      currentRanking: state.getCurrentRanking()
    };

    // Call API to create room
    const response = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(roomData)
    });


    if (!response.ok) {
      const text = await response.text();
      console.error('Failed to create room:', { status: response.status, body: text });
      alert(`创建房间失败: ${response.status} ${response.statusText}`);
      return null;
    }

    const text = await response.text();

    const result = text ? JSON.parse(text) : null;

    if (result.success && result.roomCode) {
      currentRoomCode = result.roomCode;
      authToken = generateAuthToken(); // Generate client-side auth token
      isHost = true;
      isViewer = false;

      // Start auto-sync for host
      startAutoSync();

      emit('room:created', { roomCode: result.roomCode });

      return {
        roomCode: result.roomCode,
        authToken: authToken
      };
    }

    return null;
  } catch (error) {
    console.error('Error creating room:', error);
    return null;
  }
}

/**
 * Join an existing room
 * @param {string} roomCode - 6-digit room code
 * @param {string} [token] - Optional auth token for host access
 * @returns {Promise<boolean>} Success status
 */
export async function joinRoom(roomCode, token = null) {
  // Check if in development mode
  if (isDevelopment) {
    alert('房间功能需要部署到 Vercel 才能使用\n\n本地开发模式下无法连接 Vercel KV 数据库\n\n请运行 "npm run build" 并部署到 Vercel 后测试房间功能');
    return false;
  }

  try {
    // Fetch room data
    const response = await fetch(`/api/rooms/${roomCode}`);

    if (!response.ok) {
      console.error('Room not found:', roomCode);
      alert('房间不存在或已过期');
      return false;
    }

    const responseData = await response.json();

    // Extract actual data from response structure {success: true, data: {...}}
    const roomData = responseData.data || responseData;

    // Load room data into state
    loadRoomData(roomData);

    currentRoomCode = roomCode;
    authToken = token;
    isHost = !!token; // If has token, is host
    isViewer = !token; // Otherwise is viewer

    if (isHost) {
      // Start auto-sync for host
      startAutoSync();
    } else {
      // Start polling for viewers
      startPolling();
    }

    emit('room:joined', { roomCode, isHost, isViewer });

    return true;
  } catch (error) {
    console.error('Error joining room:', error);
    alert('加入房间失败');
    return false;
  }
}

/**
 * Load room data into local state
 * @param {Object} roomData - Room data from API
 */
function loadRoomData(roomData) {
  // Load config
  if (roomData.settings) {
    Object.keys(roomData.settings).forEach(key => {
      if (key === 't1' || key === 't2') {
        config.setTeam(key, roomData.settings[key]);
      } else if (['must1', 'autoNext', 'autoApply', 'strictA'].includes(key)) {
        config.setPreference(key, roomData.settings[key]);
      }
    });
  }

  // Load state
  if (roomData.state) {
    const s = roomData.state;

    if (s.teams) {
      state.setTeamLevel('t1', s.teams.t1.lvl);
      state.setTeamAFail('t1', s.teams.t1.aFail || 0);
      state.setTeamLevel('t2', s.teams.t2.lvl);
      state.setTeamAFail('t2', s.teams.t2.aFail || 0);
    }

    if (s.roundLevel) state.setRoundLevel(s.roundLevel);
    if (s.roundOwner) state.setRoundOwner(s.roundOwner);
    if (s.nextRoundBase !== undefined) state.setNextRoundBase(s.nextRoundBase);
    if (s.winner) state.setWinner(s.winner);

    // Load history (use setHistory to avoid emitting individual historyAdded events)
    if (s.history && Array.isArray(s.history)) {
      state.setHistory(s.history);

      // Check if latest history entry is an A-level victory
      if (s.history.length > 0) {
        const latestGame = s.history[s.history.length - 1];

        // Check if this is an A-level victory (aNote contains "通关")
        if (latestGame.aNote && latestGame.aNote.includes('通关')) {
          emit('game:victoryForVoting', { teamName: latestGame.win });
        }
      }
    }
  }

  // Load players
  if (roomData.players) {
    state.setPlayers(roomData.players);
  }

  // Load stats
  if (roomData.playerStats) {
    state.setPlayerStats(roomData.playerStats);
  }

  // Load ranking
  if (roomData.currentRanking) {
    state.setCurrentRanking(roomData.currentRanking);
  }

  lastKnownUpdate = roomData.lastUpdated || new Date().toISOString();
  roomCreatedAt = roomData.createdAt || null; // Update creation time

  emit('room:dataLoaded', { roomData });

  // ALSO emit room:updated for initial load (triggers UI updates)
  emit('room:updated', { roomData });
}

/**
 * Sync current game state to room
 * @returns {Promise<boolean>} Success status
 */
export async function syncToRoom() {
  if (!currentRoomCode || !isHost || !authToken) {
    console.warn('Cannot sync: not a host or no room');
    return false;
  }

  try {
    // FIRST fetch existing room to preserve votes
    const existingResponse = await fetch(`/api/rooms/${currentRoomCode}`);
    const existingData = existingResponse.ok ? await existingResponse.json() : null;
    const existingRoom = existingData?.data || existingData || {};

    const roomData = {
      settings: config.getAll(),
      state: {
        teams: {
          t1: { lvl: state.getTeamLevel('t1'), aFail: state.getTeamAFail('t1') },
          t2: { lvl: state.getTeamLevel('t2'), aFail: state.getTeamAFail('t2') }
        },
        roundLevel: state.getRoundLevel(),
        roundOwner: state.getRoundOwner(),
        nextRoundBase: state.getNextRoundBase(),
        history: state.getHistory(),
        winner: state.getWinner()
      },
      players: getPlayers(),
      playerStats: state.getPlayerStats(),
      currentRanking: state.getCurrentRanking(),
      lastUpdated: new Date().toISOString(),
      // PRESERVE VOTES!
      endGameVotes: existingRoom.endGameVotes || { mvp: {}, burden: {} }
    };

    const response = await fetch(`/api/rooms/${currentRoomCode}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(roomData)
    });

    if (!response.ok) {
      console.error('Failed to sync to room');
      return false;
    }

    emit('room:synced', { roomCode: currentRoomCode });
    return true;
  } catch (error) {
    console.error('Error syncing to room:', error);
    return false;
  }
}

/**
 * Start auto-sync for host (every 10 seconds)
 */
function startAutoSync() {
  if (syncInterval) clearInterval(syncInterval);

  syncInterval = setInterval(() => {
    syncToRoom();
  }, 10000); // 10 seconds

}

/**
 * Start polling for viewers (every 5 seconds)
 */
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);

  // Initial poll immediately
  pollForUpdates();

  // Then poll every 2 seconds
  pollInterval = setInterval(async () => {
    await pollForUpdates();
  }, 2000); // 2 seconds (faster for better UX)

}

/**
 * Poll for updates (viewer mode)
 */
async function pollForUpdates() {
  if (!currentRoomCode || isHost) return;

  try {
    const response = await fetch(`/api/rooms/${currentRoomCode}`);

    if (!response.ok) {
      console.error('Failed to poll room:', response.status);
      return;
    }

    const text = await response.text();
    const responseData = text ? JSON.parse(text) : null;

    if (!responseData) {
      console.error('No room data received');
      return;
    }

    // Extract actual data from response structure {success: true, data: {...}}
    const roomData = responseData.data || responseData;

    if (!roomData) {
      console.error('No data in response');
      return;
    }

    // Check if data has changed
    const newUpdate = roomData.lastUpdated || new Date().toISOString();

    // ALWAYS update lastKnownUpdate even if no emit (prevents duplicate triggers)
    const hasChanged = newUpdate !== lastKnownUpdate;
    lastKnownUpdate = newUpdate;

    if (hasChanged) {
      loadRoomData(roomData);

      // Use requestAnimationFrame to avoid blocking polling
      requestAnimationFrame(() => {
        emit('room:updated', { roomData });
        showUpdateNotification();
      });
    }
  } catch (error) {
    console.error('Error polling room:', error);
  }
}

/**
 * Show update notification for viewers
 */
function showUpdateNotification() {
  // Could show a toast notification
}

/**
 * Leave current room
 */
export function leaveRoom() {
  if (syncInterval) clearInterval(syncInterval);
  if (pollInterval) clearInterval(pollInterval);

  currentRoomCode = null;
  authToken = null;
  isHost = false;
  isViewer = false;
  lastKnownUpdate = null;

  emit('room:left');
}

/**
 * Generate auth token for host
 */
function generateAuthToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Check URL for room code and auto-join
 * @returns {Promise<boolean>} True if room code found and joined
 */
export async function checkURLForRoom() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const token = params.get('auth');

  if (roomCode) {
    const success = await joinRoom(roomCode, token);
    return success;
  }

  return false;
}

/**
 * Get current room info
 */
export function getRoomInfo() {
  return {
    roomCode: currentRoomCode,
    isHost,
    isViewer,
    authToken: isHost ? authToken : null,
    createdAt: roomCreatedAt
  };
}

/**
 * Manually trigger sync (for important events)
 */
export function syncNow() {
  if (isHost) {
    syncToRoom();
  }
}

// Export room state getters
export { currentRoomCode, isHost, isViewer };
