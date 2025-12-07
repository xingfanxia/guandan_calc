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
let syncInterval = null;
let pollInterval = null;
let lastKnownUpdate = null;

/**
 * Create a new room
 * @returns {Promise<{roomCode: string, authToken: string}|null>}
 */
export async function createRoom() {
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
      const error = await response.json();
      console.error('Failed to create room:', error);
      return null;
    }

    const result = await response.json();

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
  try {
    // Fetch room data
    const response = await fetch(`/api/rooms/${roomCode}`);

    if (!response.ok) {
      console.error('Room not found:', roomCode);
      alert('房间不存在或已过期');
      return false;
    }

    const roomData = await response.json();

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
    // Hydrate config with room settings
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

    // Load history
    if (s.history && Array.isArray(s.history)) {
      state.clearHistory();
      s.history.forEach(entry => state.addHistoryEntry(entry));
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

  emit('room:dataLoaded', { roomData });
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
      lastUpdated: new Date().toISOString()
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

  console.log('Auto-sync started (10s interval)');
}

/**
 * Start polling for viewers (every 5 seconds)
 */
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(async () => {
    await pollForUpdates();
  }, 5000); // 5 seconds

  console.log('Polling started (5s interval)');
}

/**
 * Poll for updates (viewer mode)
 */
async function pollForUpdates() {
  if (!currentRoomCode || isHost) return;

  try {
    const response = await fetch(`/api/rooms/${currentRoomCode}`);

    if (!response.ok) {
      console.error('Failed to poll room');
      return;
    }

    const roomData = await response.json();

    // Check if data has changed
    if (roomData.lastUpdated !== lastKnownUpdate) {
      console.log('Room data updated, reloading...');
      loadRoomData(roomData);

      // Trigger UI refresh
      emit('room:updated', { roomData });

      // Show notification
      showUpdateNotification();
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
  console.log('🔄 房间数据已更新');
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
    authToken: isHost ? authToken : null
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
