/**
 * Room Manager - Real-time Room Sharing with Vercel KV
 * Handles room creation, joining, syncing, and viewer mode
 */

import state from '../core/state.js';
import config from '../core/config.js';
import { readOptionalJsonResponse } from '../api/httpResponse.js';
import { getPlayers } from '../player/playerManager.js';
import { emit } from '../core/events.js';
import { getHistoryEntries, resolveGameStatus } from '../game/gameStatus.js';
import {
  canonicalizeRoomSnapshotPayload,
  isValidRoomSnapshotPayload
} from './roomSnapshotValidation.js';
import { applySnapshotSettings } from './roomSettings.js';

// Room state
let currentRoomCode = null;
let authToken = null;
let isHost = false;
let isViewer = false;
let roomCreatedAt = null;  // Track room creation time for timer
let roomFinishedAt = null;  // Track game finish time for timer
let roomIsFavorite = false;
let syncInterval = null;
let pollInterval = null;
let lastKnownUpdate = null;
let roomConnectionGeneration = 0;

export function normalizeRoomCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
}

function roomDetailRequestOptions(token) {
  const normalizedToken = typeof token === 'string' ? token.trim() : '';
  if (!normalizedToken) return undefined;

  return {
    headers: {
      Authorization: `Bearer ${normalizedToken}`
    }
  };
}

function validTimestampString(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return Number.isFinite(new Date(value).getTime()) ? value : null;
}

function snapshotWinnerFromStatus(gameStatus) {
  return gameStatus?.winnerKey || state.getWinner();
}

function latestHistoryWinner(history) {
  return [...history]
    .reverse()
    .find(entry => entry?.winKey === 't1' || entry?.winKey === 't2')
    ?.winKey || null;
}

function resolveSnapshotWinner(snapshotWinner, gameStatus, history = []) {
  if (gameStatus?.ended && (gameStatus.winnerKey === 't1' || gameStatus.winnerKey === 't2')) {
    return gameStatus.winnerKey;
  }
  if (snapshotWinner === 't1' || snapshotWinner === 't2') return snapshotWinner;
  const historyWinner = latestHistoryWinner(history);
  if (historyWinner) return historyWinner;
  return gameStatus?.winnerKey || null;
}

function canonicalizeValidRoomSnapshot(roomData) {
  const snapshot = canonicalizeRoomSnapshotPayload(roomData);
  if (!isValidRoomSnapshotPayload(snapshot)) return null;
  return normalizeRoomCode(snapshot.roomCode) ? snapshot : null;
}

// Dev mode now proxies /api/* to production via vite.config.js, so room
// features work in dev (hits real prod KV through deployed Edge Functions).
// Keep the flag for diagnostic logging but no longer use it as a hard block.
const isDevelopment = typeof import.meta !== 'undefined'
  && import.meta.env
  && import.meta.env.DEV === true;
if (isDevelopment) {
  console.info('[roomManager] Dev mode: /api/* proxied to gd.ax0x.ai. Room features hit prod KV.');
}

function stopRoomTimers() {
  if (syncInterval) clearInterval(syncInterval);
  if (pollInterval) clearInterval(pollInterval);
  syncInterval = null;
  pollInterval = null;
}

function clearRoomConnection(emitLeft = true) {
  stopRoomTimers();
  roomConnectionGeneration += 1;
  currentRoomCode = null;
  authToken = null;
  isHost = false;
  isViewer = false;
  roomCreatedAt = null;
  roomFinishedAt = null;
  roomIsFavorite = false;
  lastKnownUpdate = null;

  if (emitLeft) {
    emit('room:left');
  }
}

/**
 * Create a new room
 * @returns {Promise<{roomCode: string, authToken: string}|null>}
 */
export async function createRoom() {
  // Creating a room is a transition away from any previous room. If the create
  // request later fails, staying connected as the old host would let the old
  // auto-sync interval push the freshly reset local game into the old room.
  clearRoomConnection(currentRoomCode || isHost || isViewer);

  try {
    const history = state.getHistory();
    const gameStatus = resolveGameStatus(state.getGameStatus(), history);

    // Gather current game state
    const roomData = canonicalizeRoomSnapshotPayload({
      settings: config.getAll(),
      state: {
        teams: {
          t1: state.getTeam('t1'),
          t2: state.getTeam('t2')
        },
        roundLevel: state.getRoundLevel(),
        roundOwner: state.getRoundOwner(),
        nextRoundBase: state.getNextRoundBase(),
        gameStatus,
        history,
        winner: snapshotWinnerFromStatus(gameStatus)
      },
      players: getPlayers(),
      playerStats: state.getPlayerStats(),
      currentRanking: state.getCurrentRanking()
    });

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

    const result = await readOptionalJsonResponse(response);

    const createdRoomCode = normalizeRoomCode(result.roomCode);
    const createdAuthToken = typeof result.authToken === 'string' ? result.authToken.trim() : '';
    if (result.success && createdRoomCode && createdAuthToken) {
      currentRoomCode = createdRoomCode;
      // Server issues the host token at create-time; missing token is a failed
      // room-create contract, not something the client should silently replace.
      authToken = createdAuthToken;
      isHost = true;
      isViewer = false;
      roomCreatedAt = validTimestampString(result.createdAt) || new Date().toISOString();
      roomFinishedAt = validTimestampString(result.finishedAt);
      roomIsFavorite = false;

      // Start auto-sync for host
      startAutoSync();

      emit('room:created', { roomCode: createdRoomCode });

      return {
        roomCode: createdRoomCode,
        authToken: authToken
      };
    }

    if (result.success && createdRoomCode && !createdAuthToken) {
      console.error('Failed to create room: server response missing host auth token');
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
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  if (!normalizedRoomCode) {
    console.warn('Invalid room code:', roomCode);
    alert('房间代码格式无效');
    return false;
  }

  try {
    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    const roomUrl = `/api/rooms/${encodeURIComponent(normalizedRoomCode)}`;

    // Fetch room data
    let response = await fetch(roomUrl, roomDetailRequestOptions(normalizedToken));

    if (normalizedToken && response.status === 403) {
      console.warn('Room host auth failed; joining as viewer instead:', normalizedRoomCode);
      response = await fetch(roomUrl);
    }

    if (!response.ok) {
      console.error('Room not found:', normalizedRoomCode);
      alert('房间不存在或已过期');
      return false;
    }

    const responseData = await readOptionalJsonResponse(response);

    // Extract actual data from response structure {success: true, data: {...}}
    const roomData = canonicalizeValidRoomSnapshot(responseData.data || responseData);
    const hostVerified = Boolean(normalizedToken && responseData.hostVerified === true);

    if (!roomData) {
      throw new Error('Invalid room data snapshot');
    }

    stopRoomTimers();
    roomConnectionGeneration += 1;
    currentRoomCode = normalizedRoomCode;
    authToken = hostVerified ? normalizedToken : null;
    isHost = hostVerified;
    isViewer = !hostVerified;

    if (normalizedToken && !hostVerified) {
      console.warn('Room auth token was not verified; using viewer mode:', normalizedRoomCode);
    }

    // Load room data after setting room mode so emitted load/victory events can
    // route correctly for viewer/host-specific UI.
    loadRoomData(roomData);

    if (isHost) {
      // Start auto-sync for host
      startAutoSync();
    } else {
      // Start polling for viewers
      startPolling();
    }

    emit('room:joined', { roomCode: normalizedRoomCode, isHost, isViewer });

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
  roomData = canonicalizeValidRoomSnapshot(roomData);
  if (!roomData) {
    throw new Error('Invalid room data snapshot');
  }

  // Load config
  if (roomData.settings) {
    applySnapshotSettings(roomData.settings);
  }

  // Load state
  if (roomData.state) {
    const s = roomData.state;
    const incomingHistory = getHistoryEntries(s);

    state.setTeamLevel('t1', s.teams?.t1?.lvl ?? '2');
    state.setTeamAFail('t1', s.teams?.t1?.aFail ?? 0);
    state.setTeamLevel('t2', s.teams?.t2?.lvl ?? '2');
    state.setTeamAFail('t2', s.teams?.t2?.aFail ?? 0);
    state.setRoundLevel(s.roundLevel ?? '2');
    state.setRoundOwner(s.roundOwner ?? null);
    state.setNextRoundBase(s.nextRoundBase ?? null);

    // Treat room state as a complete snapshot. A legacy snapshot without
    // history means "no captured history", not "keep stale local history".
    state.setHistory(incomingHistory);
    const loadedGameStatus = resolveGameStatus(s.gameStatus, incomingHistory);
    state.setGameStatus(loadedGameStatus);
    state.setWinner(resolveSnapshotWinner(s.winner, loadedGameStatus, incomingHistory) || 't1');
  }

  // Load dependent data before emitting any completed-game events. The viewer
  // voting UI reads players, stats, ranking, and room metadata synchronously
  // when it unlocks.
  state.setPlayers(roomData.players || []);
  state.setPlayerStats(roomData.playerStats || {});
  state.setCurrentRanking(roomData.currentRanking || {});

  lastKnownUpdate = roomData.lastUpdated || new Date().toISOString();
  roomCreatedAt = roomData.createdAt || null; // Update creation time
  roomFinishedAt = roomData.finishedAt || null; // Update finish time
  roomIsFavorite = Boolean(roomData.isFavorite);

  console.log('Room data loaded, createdAt:', roomCreatedAt, 'roomData:', {
    code: roomData.roomCode,
    created: roomData.createdAt,
    updated: roomData.lastUpdated
  });

  emit('room:dataLoaded', { roomData });

  // ALSO emit room:updated for initial load (triggers UI updates)
  emit('room:updated', { roomData });

  const loadedStatus = state.getGameStatus();
  if (loadedStatus.ended) {
    emit('game:victoryForVoting', { teamName: loadedStatus.winnerName });
  }
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

  const syncRoomCode = currentRoomCode;
  const syncAuthToken = authToken;
  const syncGeneration = roomConnectionGeneration;

  try {
    // FIRST fetch existing room to preserve votes
    const existingResponse = await fetch(`/api/rooms/${encodeURIComponent(syncRoomCode)}`);
    const existingData = existingResponse.ok ? await readOptionalJsonResponse(existingResponse) : null;
    const existingRoom = existingData?.data || existingData || {};
    const history = state.getHistory();
    const gameStatus = resolveGameStatus(state.getGameStatus(), history);
    const gameEnded = gameStatus?.ended === true;
    const isFavoriteRoom = Boolean(existingRoom.isFavorite || roomIsFavorite);
    const emptyEndGameVotes = { mvp: {}, burden: {}, fingerprints: [] };

    const roomData = canonicalizeRoomSnapshotPayload({
      settings: config.getAll(),
      state: {
        teams: {
          t1: { lvl: state.getTeamLevel('t1'), aFail: state.getTeamAFail('t1') },
          t2: { lvl: state.getTeamLevel('t2'), aFail: state.getTeamAFail('t2') }
        },
        roundLevel: state.getRoundLevel(),
        roundOwner: state.getRoundOwner(),
        nextRoundBase: state.getNextRoundBase(),
        gameStatus,
        history,
        winner: snapshotWinnerFromStatus(gameStatus)
      },
      players: getPlayers(),
      playerStats: state.getPlayerStats(),
      currentRanking: state.getCurrentRanking(),
      createdAt: existingRoom.createdAt || roomCreatedAt || new Date().toISOString(),  // Preserve creation time
      finishedAt: gameEnded ? (existingRoom.finishedAt || new Date().toISOString()) : null,  // Clear when host resets / rolls back before victory
      isFavorite: isFavoriteRoom,
      favoritedAt: isFavoriteRoom ? (existingRoom.favoritedAt || null) : null,
      lastUpdated: new Date().toISOString(),
      // Preserve active votes only while the room is actually ended. A host
      // reset/rollback opens the game again; carrying old vote maps forward
      // would make the next voting window show stale counts or reject old
      // fingerprints as duplicates.
      endGameVotes: gameEnded
        ? (existingRoom.endGameVotes || emptyEndGameVotes)
        : emptyEndGameVotes,
      endGameVotesHistory: Array.isArray(existingRoom.endGameVotesHistory)
        ? existingRoom.endGameVotesHistory
        : []
    });

    const response = await fetch(`/api/rooms/${encodeURIComponent(syncRoomCode)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${syncAuthToken}`
      },
      body: JSON.stringify(roomData)
    });

    if (!response.ok) {
      console.error('Failed to sync to room');
      return false;
    }

    if (
      roomConnectionGeneration !== syncGeneration ||
      currentRoomCode !== syncRoomCode ||
      authToken !== syncAuthToken ||
      !isHost
    ) {
      console.warn('Ignoring stale room sync completion:', syncRoomCode);
      return false;
    }

    emit('room:synced', { roomCode: syncRoomCode });
    roomCreatedAt = roomData.createdAt;
    roomFinishedAt = roomData.finishedAt;
    roomIsFavorite = roomData.isFavorite;
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
 * Start polling for updates (viewer mode)
 */
function startPolling() {
  console.log('Starting viewer polling...');
  if (pollInterval) clearInterval(pollInterval);

  // Initial poll immediately - always load data on first call
  pollForUpdates(true);  // Pass true to force load on first poll

  // Then poll every 2 seconds
  pollInterval = setInterval(async () => {
    await pollForUpdates(false);  // Normal polling with change detection
  }, 2000); // 2 seconds (faster for better UX)

}

function scheduleRoomUpdate(callback) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
    return;
  }
  setTimeout(callback, 0);
}

/**
 * Poll for updates (viewer mode)
 * @param {boolean} forceLoad - Force load even if no changes (for initial poll)
 */
async function pollForUpdates(forceLoad = false) {
  const pollRoomCode = currentRoomCode;
  if (!pollRoomCode || isHost) return;

  try {
    const response = await fetch(`/api/rooms/${encodeURIComponent(pollRoomCode)}`);

    if (!response.ok) {
      console.error('Failed to poll room:', response.status);
      return;
    }

    const responseData = await readOptionalJsonResponse(response);

    if (!responseData) {
      console.error('No room data received');
      return;
    }

    // Extract actual data from response structure {success: true, data: {...}}
    const roomData = canonicalizeValidRoomSnapshot(responseData.data || responseData);

    if (!roomData) {
      console.error('No data in response');
      return;
    }

    if (currentRoomCode !== pollRoomCode || isHost) return;

    // Check if data has changed
    const newUpdate = roomData.lastUpdated || new Date().toISOString();

    // ALWAYS update lastKnownUpdate even if no emit (prevents duplicate triggers)
    const hasChanged = newUpdate !== lastKnownUpdate;
    lastKnownUpdate = newUpdate;

    if (hasChanged || forceLoad) {
      loadRoomData(roomData);

      if (hasChanged) {
        scheduleRoomUpdate(showUpdateNotification);
      }
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
  clearRoomConnection(true);
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
    createdAt: roomCreatedAt,
    finishedAt: roomFinishedAt,
    isFavorite: roomIsFavorite
  };
}

/**
 * Update local favorite metadata after a successful favorite API call.
 */
export function setRoomFavoriteState(isFavorite) {
  roomIsFavorite = Boolean(isFavorite);
  emit('room:favoriteChanged', { isFavorite: roomIsFavorite });
}

/**
 * Manually trigger sync (for important events)
 */
export function syncNow() {
  if (isHost) {
    return syncToRoom();
  }
  return false;
}

// Export room state getters
export { currentRoomCode, isHost, isViewer };
