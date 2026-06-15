// Player Profile API Client
// Handles all communication with player profile backend APIs

import { ACHIEVEMENTS } from '../stats/achievements.js';
import { showToast } from '../ui/toast.js';
import { HONOR_TITLES_BY_KEY } from '../../shared/honorCatalog.js';
import { resolveGameStatus } from '../../shared/gameStatus.js';
import { deriveGameSessionKey, deriveVoteSessionKey } from '../../shared/voteSessionKey.js';
import { resolvePlayerCountMode } from '../core/playerCountMode.js';
import { normalizeVotePlayerId } from '../share/voteResults.js';
import { readOptionalJsonResponse as readOptionalJson } from './httpResponse.js';

const API_BASE = window.location.origin;

function playerProfileUrl(handle) {
  return `${API_BASE}/api/players/${encodeURIComponent(handle)}`;
}

function normalizeHonorRecipientId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeSessionTeamNumber(team) {
  if (team === 1 || team === '1') return 1;
  if (team === 2 || team === '2') return 2;
  if (typeof team === 'string') {
    const trimmed = team.trim();
    if (trimmed === '1') return 1;
    if (trimmed === '2') return 2;
  }
  return null;
}

function voteResultMatchesPlayer(votePlayerId, playerId) {
  const normalizedVotePlayerId = normalizeVotePlayerId(votePlayerId);
  if (!normalizedVotePlayerId) return false;

  return normalizedVotePlayerId === normalizeVotePlayerId(playerId);
}

// ===== Ownership token storage =====
// Issued by server at create-time, kept in localStorage so the original creator
// can self-edit their profile from the same browser without admin intervention.
// Per-handle key isolates tokens — useful if multiple players share a device.
const OWNER_TOKEN_PREFIX = 'gd_owner_token_';

// ===== Admin token storage (anti-cheat review-queue bypass) =====
// Saved ONLY on a trusted admin device via admin.html "信任此设备". When present,
// updatePlayerStats includes it so this host's real-room syncs skip the review
// queue and apply instantly (the admin is trusted). Devices without it queue
// their real-room syncs for admin approval. Security tradeoff is documented in
// docs/SECURITY.md — the admin token also grants delete/reset powers, so it
// belongs only on the project owner's own device.
const ADMIN_TOKEN_KEY = 'gd_admin_token';

export function getStoredAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch (err) {
    console.warn('Failed to persist admin token:', err);
  }
}

export function clearStoredAdminToken() {
  setStoredAdminToken(null);
}

export function mapSessionHonorsToPlayerHonors(sessionHonors = {}) {
  const playerHonors = {};

  Object.entries(sessionHonors).forEach(([honorKey, honorData]) => {
    if (!honorData?.player) return;

    const honorName = HONOR_TITLES_BY_KEY[honorKey];
    if (!honorName) return;

    const playerId = normalizeHonorRecipientId(honorData.player.id);
    if (playerId === null) return;

    if (!playerHonors[playerId]) playerHonors[playerId] = [];
    playerHonors[playerId].push(honorName);
  });

  return playerHonors;
}

export function getOwnershipToken(handle) {
  if (!handle) return null;
  try {
    return localStorage.getItem(OWNER_TOKEN_PREFIX + handle.toLowerCase()) || null;
  } catch {
    return null;
  }
}

export function saveOwnershipToken(handle, token) {
  if (!handle || !token) return;
  try {
    localStorage.setItem(OWNER_TOKEN_PREFIX + handle.toLowerCase(), token);
  } catch (err) {
    console.warn(`Failed to persist ownership token for @${handle}:`, err);
  }
}

// Wired to the "登出本设备" affordance in playerEditModal — wipes the ownership
// token for this handle from this device's localStorage. After clearing, edits
// from this browser require admin re-issue (there's no rotation endpoint yet).
export function clearOwnershipToken(handle) {
  if (!handle) return;
  try {
    localStorage.removeItem(OWNER_TOKEN_PREFIX + handle.toLowerCase());
  } catch {}
}

function normalizePlayerSearchResult(payload) {
  const data = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
  const players = Array.isArray(data.players) ? data.players : [];
  const total = Number(data.total);

  return {
    ...data,
    players,
    total: Number.isSafeInteger(total) && total >= 0 ? total : players.length,
    hasMore: data.hasMore === true
  };
}

function normalizeSuccessfulWriteResult(result) {
  const data = result && typeof result === 'object' && !Array.isArray(result)
    ? result
    : {};

  return {
    ...data,
    success: data.success !== false
  };
}

/**
 * Search for players by handle or displayName
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 20)
 * @returns {Promise<{players: Array, total: number, hasMore: boolean}>}
 */
export async function searchPlayers(query = '', limit = 20, sort = 'recent') {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', limit.toString());
    if (sort === 'ladder') params.set('sort', 'ladder');

    const response = await fetch(`${API_BASE}/api/players/list?${params}`);

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return normalizePlayerSearchResult(await readOptionalJson(response));
  } catch (error) {
    console.error('searchPlayers error:', error);
    throw error;
  }
}

/**
 * Get individual player profile by handle
 * @param {string} handle - Player handle
 * @returns {Promise<{success: boolean, player: Object}>}
 */
export async function getPlayer(handle) {
  try {
    const response = await fetch(playerProfileUrl(handle));

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Player not found');
      }
      throw new Error(`Get player failed: ${response.statusText}`);
    }

    const result = await readOptionalJson(response);
    if (!result.player || typeof result.player !== 'object' || Array.isArray(result.player)) {
      throw new Error('Invalid player response');
    }

    return result;
  } catch (error) {
    console.error('getPlayer error:', error);
    throw error;
  }
}

export async function resolveFullPlayerProfile(playerSummary) {
  if (!playerSummary?.handle || playerSummary.photoBase64 !== undefined) {
    return playerSummary;
  }

  try {
    const result = await getPlayer(playerSummary.handle);
    return result.player || playerSummary;
  } catch (error) {
    console.warn(`Failed to load full profile for @${playerSummary.handle}; using list summary`, error);
    return playerSummary;
  }
}

/**
 * Create new player profile
 * @param {Object} data - Player data
 * @param {string} data.handle - Unique handle (3-20 chars, alphanumeric + underscore)
 * @param {string} data.displayName - Display name
 * @param {string} data.emoji - Emoji avatar
 * @param {string} data.playStyle - One of 8 play styles
 * @param {string} data.tagline - Personal tagline (max 50 chars)
 * @returns {Promise<{success: boolean, player: Object}>}
 */
export async function createPlayer(data) {
  try {
    const response = await fetch(`${API_BASE}/api/players/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await readOptionalJson(response);

    if (!response.ok) {
      throw new Error(result.error || `Create player failed: ${response.statusText}`);
    }

    // Persist the ownership token returned ONCE by the server. The token is the
    // only credential that lets this device self-edit the profile later — admin
    // override is the only fallback if the token is lost.
    if (result.ownershipToken && result.player?.handle) {
      saveOwnershipToken(result.player.handle, result.ownershipToken);
    }

    return result;
  } catch (error) {
    console.error('createPlayer error:', error);
    throw error;
  }
}

/**
 * Validate handle format client-side
 * @param {string} handle
 * @returns {{valid: boolean, error?: string}}
 */
export function validateHandle(handle) {
  if (!handle || typeof handle !== 'string') {
    return { valid: false, error: '用户名不能为空' };
  }

  if (handle.length < 3 || handle.length > 20) {
    return { valid: false, error: '用户名长度必须在3-20个字符之间' };
  }

  const handleRegex = /^[a-zA-Z0-9_]+$/;
  if (!handleRegex.test(handle)) {
    return { valid: false, error: '用户名只能包含字母、数字和下划线' };
  }

  const unsafeObjectKeys = new Set(['__proto__', 'prototype', 'constructor']);
  if (unsafeObjectKeys.has(handle.toLowerCase())) {
    return { valid: false, error: '用户名不可使用系统保留词' };
  }

  return { valid: true };
}

function normalizeProfileHandleCandidate(rawHandle) {
  if (typeof rawHandle !== 'string') return null;

  const normalizedHandle = rawHandle.trim().toLowerCase();
  if (normalizedHandle === 'session') return null;
  return validateHandle(normalizedHandle).valid ? normalizedHandle : null;
}

export function getPlayerProfileHandle(player) {
  return normalizeProfileHandleCandidate(player?.handle) ||
    normalizeProfileHandleCandidate(player?.profileHandle);
}

/**
 * Get play style label in Chinese
 * @param {string} playStyle
 * @returns {string}
 */
export function getPlayStyleLabel(playStyle) {
  const labels = {
    'gambler': '赌神 🎰',
    'chill': '躺平大师 🛋️',
    'scapegoat': '团队背锅侠 🎒',
    'tilt': '心态爆炸王 💥',
    'steady': '稳如老狗 🐕',
    'yolo': '冲就完事 🚀',
    'secondPlace': '千年老二 🥈',
    'mystery': '神秘高手 🎭',
    'lao8Hunter': '老8猎手 🎯'
  };
  return labels[playStyle] || playStyle;
}

/**
 * Get all available play styles
 * @returns {Array<{value: string, label: string}>}
 */
export function getPlayStyles() {
  return [
    { value: 'gambler', label: '赌神 🎰' },
    { value: 'chill', label: '躺平大师 🛋️' },
    { value: 'scapegoat', label: '团队背锅侠 🎒' },
    { value: 'tilt', label: '心态爆炸王 💥' },
    { value: 'steady', label: '稳如老狗 🐕' },
    { value: 'yolo', label: '冲就完事 🚀' },
    { value: 'secondPlace', label: '千年老二 🥈' },
    { value: 'mystery', label: '神秘高手 🎭' },
    { value: 'lao8Hunter', label: '老8猎手 🎯' }
  ];
}

/**
 * Update player's lastActiveAt timestamp
 * Call this when a player is added to a game
 * @param {string} handle - Player handle
 * @returns {Promise<{success: boolean}>}
 */
export async function touchPlayer(handle) {
  try {
    const response = await fetch(`${API_BASE}/api/players/touch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ handle })
    });

    if (!response.ok) {
      throw new Error(`Touch player failed: ${response.statusText}`);
    }

    return normalizeSuccessfulWriteResult(await readOptionalJson(response));
  } catch (error) {
    console.error('touchPlayer error:', error);
    // Don't throw - this is a non-critical operation
    return { success: false };
  }
}

/**
 * Update player stats after game completion
 * @param {string} handle - Player handle
 * @param {Object} gameResult - Game result data
 * @param {string} [roomAuthToken] - Host's room auth token. When set, used as
 *   the Bearer credential — the server accepts it for any player in the room.
 *   When unset, falls back to this device's stored ownership token for the
 *   target handle (works only if syncing your own stats from your own device).
 * @returns {Promise<{success: boolean, updatedStats: Object}>}
 */
export async function updatePlayerStats(handle, gameResult, roomAuthToken = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    // Prefer the room-host token: a host has authority over every participant
    // in the room, so one credential covers the full sync. Owner token is the
    // LOCAL-game / self-edit fallback.
    if (roomAuthToken) {
      headers['Authorization'] = `Bearer ${roomAuthToken}`;
    } else {
      const ownerToken = getOwnershipToken(handle);
      if (ownerToken) headers['Authorization'] = `Bearer ${ownerToken}`;
    }

    // Opt-in admin bypass: on a trusted admin device (token saved via admin.html
    // "信任此设备"), include it so this host's real-room syncs skip the review
    // queue and apply instantly. Non-admin devices have no token → their
    // real-room syncs queue. See the anti-cheat gate in api/players/[handle].js.
    const body = { ...gameResult };
    const adminToken = getStoredAdminToken();
    if (adminToken && body.adminToken === undefined) body.adminToken = adminToken;

    const response = await fetch(playerProfileUrl(handle), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Update stats failed: ${response.statusText}`);
    }

    return normalizeSuccessfulWriteResult(await readOptionalJson(response));
  } catch (error) {
    console.error('updatePlayerStats error:', error);
    // Don't throw - this is a non-critical operation
    return { success: false };
  }
}

/**
 * Sync player profile stats after game completion
 * Syncs the entire game session stats (all rounds) to player profiles
 * @param {Object} historyEntry - The final history entry
 * @param {string} roomCode - Room code (if applicable)
 * @param {Array} players - Array of all players in the game
 * @param {Object} sessionStats - Complete session stats from statistics.js
 * @param {Object} sessionHonors - Calculated honors from honors.js
 * @param {Object} votingResults - Community voting results {mvp: playerId, burden: playerId}
 * @param {string} [roomAuthToken] - Host's room auth token. Required for room games
 *   (server rejects writes for any player without a valid credential — see C-1
 *   fix in api/players/[handle].js auth gate). For LOCAL games, omit and the
 *   per-player ownership token from localStorage is used.
 */
export async function syncProfileStats(historyEntry, roomCode = 'LOCAL', players = [], sessionStats = {}, sessionHonors = {}, votingResults = null, roomAuthToken = null) {
  const playerList = Array.isArray(players) ? players : [];
  const statsByPlayer = sessionStats && typeof sessionStats === 'object' && !Array.isArray(sessionStats)
    ? sessionStats
    : {};
  const honorsByKey = sessionHonors && typeof sessionHonors === 'object' && !Array.isArray(sessionHonors)
    ? sessionHonors
    : {};

  if (!historyEntry || playerList.length === 0 || Object.keys(statsByPlayer).length === 0) {
    console.log('Skipping profile stats sync - missing data');
    return;
  }

  const voteSessionKey = deriveVoteSessionKey({
    roomCode,
    gameStatus: historyEntry.gameStatus,
    history: [historyEntry],
    finishedAt: historyEntry.gameEndedAt,
    endGameVotesHistory: []
  });
  const gameSessionKey = deriveGameSessionKey({
    roomCode,
    gameStatus: historyEntry.gameStatus,
    history: [historyEntry],
    finishedAt: historyEntry.gameEndedAt
  });
  const resolvedGameStatus = resolveGameStatus(historyEntry.gameStatus, [historyEntry]);
  const winnerTeamKey = resolvedGameStatus.ended && resolvedGameStatus.winnerKey
    ? resolvedGameStatus.winnerKey
    : historyEntry.winKey;

  const sessionPlayers = playerList.filter(player => {
    const stats = statsByPlayer[player?.id];
    return stats && stats.games > 0 && normalizeSessionTeamNumber(player?.team) !== null;
  });
  const sessionMode = `${resolvePlayerCountMode(historyEntry.mode, sessionPlayers.length || playerList.length)}P`;

  console.log('Syncing COMPLETE SESSION stats for all players:', {
    roomCode,
    playerCount: sessionPlayers.length,
    winner: winnerTeamKey,
    totalRounds: Object.values(statsByPlayer).length > 0 ? statsByPlayer[Object.keys(statsByPlayer)[0]]?.games : 0,
    honorsCount: Object.keys(honorsByKey).length
  });

  // Calculate relative rankings within this session
  const playerAverages = sessionPlayers.map(p => {
    const stats = statsByPlayer[p.id];
    return {
      playerId: p.id,
      avgRank: stats && stats.games > 0 ? stats.totalRank / stats.games : 999
    };
  }).sort((a, b) => a.avgRank - b.avgRank);  // Sort by avg (lower is better)

  // Map player ID to relative position (1-8)
  const relativeRankings = {};
  playerAverages.forEach((item, index) => {
    relativeRankings[item.playerId] = index + 1;
  });

  // Map current session honor keys to profile-facing honor names.
  const playerHonors = mapSessionHonorsToPlayerHonors(honorsByKey);

  // Collect the per-player sync promises so a queued (pending review) result can
  // surface ONE toast for the session rather than one per participant.
  const sessionSyncs = [];

  // Iterate through players who actually have stats in this completed session.
  for (const player of sessionPlayers) {
    // Only update if player has a profile handle
    const playerHandle = getPlayerProfileHandle(player);
    if (!playerHandle) continue;

    // Get this player's complete session stats
    const playerSessionStats = statsByPlayer[player.id];
    if (!playerSessionStats || !playerSessionStats.games) {
      console.warn(`No session stats for player ${player.id} (@${playerHandle})`);
      continue;
    }

    const playerTeam = normalizeSessionTeamNumber(player.team);
    const playerTeamKey = playerTeam ? `t${playerTeam}` : null;
    const avgRanking = playerSessionStats.totalRank / playerSessionStats.games;
    const honorsEarned = playerHonors[player.id] || [];
    const relativeRank = relativeRankings[player.id] || 0;  // Position within session (1-8)

    // Get teammates and opponents
    const teammateHandles = sessionPlayers
      .filter(p => normalizeSessionTeamNumber(p.team) === playerTeam && p.id !== player.id)
      .map(getPlayerProfileHandle).filter(Boolean);
    const opponentHandles = sessionPlayers
      .filter(p => normalizeSessionTeamNumber(p.team) !== playerTeam)
      .map(getPlayerProfileHandle).filter(Boolean);

    // Check if player was voted as MVP or burden
    const wasMVP = voteResultMatchesPlayer(votingResults?.mvp, player.id);
    const wasBurden = voteResultMatchesPlayer(votingResults?.burden, player.id);

    const gameResult = {
      roomCode,
      ranking: Math.round(avgRanking * 10) / 10,  // Session average ranking
      relativeRank: relativeRank,  // Position within this session (1-8)
      team: playerTeam || player.team,
      teamWon: winnerTeamKey === playerTeamKey,
      gamesInSession: playerSessionStats.games,  // Total rounds played
      sessionDuration: historyEntry.sessionDuration || 0,  // Session duration in seconds
      firstPlaces: playerSessionStats.firstPlaceCount || 0,
      lastPlaces: playerSessionStats.lastPlaceCount || 0,
      honorsEarned: honorsEarned,  // Honors won in this session
      votedMVP: wasMVP,      // Community voted as MVP
      votedBurden: wasBurden, // Community voted as burden
      gameSessionKey,
      voteSessionKey,
      teammates: teammateHandles,  // Teammate handles
      opponents: opponentHandles,  // Opponent handles
      mode: sessionMode,
      finalLevel: historyEntry[playerTeamKey] || '?'  // Team's final level
    };

    console.log(`Syncing session for @${playerHandle}: ${playerSessionStats.games} rounds, avg ${avgRanking.toFixed(2)}, 对局内排名 #${relativeRank}, honors: ${honorsEarned.join(',')}`, gameResult);

    // Non-blocking stats update — host token authorizes writes for every
    // participant of this room; LOCAL games fall back to per-player owner token.
    sessionSyncs.push(updatePlayerStats(playerHandle, gameResult, roomAuthToken).then(result => {
      if (result.success) {
        if (result.pending) {
          console.log(`⏳ Session for @${playerHandle} queued for admin review`);
        } else {
          console.log(`✅ Session stats synced for @${playerHandle}`);
        }
        const unlocked = Array.isArray(result.newAchievements) ? result.newAchievements : [];
        if (unlocked.length > 0) {
          const displayLabel = player.displayName ? `${player.displayName} @${playerHandle}` : `@${playerHandle}`;
          // Stagger so multiple unlocks for the same player aren't all queued at the same instant
          unlocked.forEach((id, idx) => {
            const def = ACHIEVEMENTS[id];
            if (!def) return;
            setTimeout(() => {
              showToast({
                variant: 'achievement',
                badge: def.badge,
                title: `${displayLabel} 解锁成就`,
                name: def.name,
                desc: def.desc
              });
            }, idx * 600);
          });
        }
      } else {
        console.warn(`❌ Failed to sync session for @${playerHandle}`);
      }
      return result;
    }).catch(err => {
      console.error(`Error syncing session for @${playerHandle}:`, err);
      return { success: false };
    }));
  }

  // If the host wasn't a trusted admin, the server queued this session's writes
  // for review (anti-cheat). Surface that once for the whole session — the host
  // should know the stats aren't lost, just pending an admin's approval.
  Promise.allSettled(sessionSyncs).then(settled => {
    const anyPending = settled.some(s => s.status === 'fulfilled' && s.value && s.value.pending);
    if (anyPending) {
      showToast({
        variant: 'default',
        badge: '⏳',
        title: '战绩已提交',
        name: '等管理员审核后入库',
        desc: '房主非管理员时，本场战绩进审核队列'
      });
    }
  });
}

/**
 * Get current profile display data for a player (with fallback)
 * Fetches latest profile data if handle exists, falls back to stored snapshot
 * @param {Object} playerSnapshot - Player data stored in game history
 * @returns {Promise<Object>} - Current profile data or snapshot
 */
export async function getPlayerDisplayData(playerSnapshot) {
  // If no handle, return stored snapshot (session-only player)
  if (!playerSnapshot.handle) {
    return playerSnapshot;
  }

  try {
    // Fetch current profile
    const result = await getPlayer(playerSnapshot.handle);

    // Return merged data: current profile + stored game data
    return {
      ...playerSnapshot,  // Keep game-specific data (team, etc.)
      displayName: result.player.displayName,
      emoji: result.player.emoji,
      tagline: result.player.tagline,
      photoBase64: result.player.photoBase64,
      playStyle: result.player.playStyle
    };
  } catch (error) {
    // Profile not found or API error - use stored snapshot
    console.warn(`Failed to fetch profile for @${playerSnapshot.handle}, using stored data:`, error.message);
    return playerSnapshot;
  }
}

/**
 * Get current profile display data for multiple players in parallel
 * @param {Array<Object>} players - Array of player snapshots
 * @returns {Promise<Array<Object>>} - Array of current profile data
 */
export async function getPlayersDisplayData(players) {
  return Promise.all(players.map(player => getPlayerDisplayData(player)));
}

/**
 * Rotate the ownership token for a player. The server issues a new token,
 * invalidates the old one by replacing the stored hash, and returns the new
 * raw token ONCE. Client persists it to localStorage (overwriting the prior).
 *
 * Auth: requires either the current ownership token (sent as Bearer header,
 * picked up automatically from localStorage) or admin token (passed in body).
 *
 * Use case: shared device, suspected token leak, or routine rotation hygiene.
 *
 * @param {string} handle - Target player handle
 * @param {string} [adminToken] - Optional admin override
 * @returns {Promise<{success: boolean, ownershipToken: string, player: Object}>}
 */
export async function rotatePlayerToken(handle, adminToken = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const ownerToken = getOwnershipToken(handle);
    if (ownerToken) {
      headers['Authorization'] = `Bearer ${ownerToken}`;
    }

    const body = { mode: 'ROTATE_TOKEN' };
    if (adminToken) body.adminToken = adminToken;

    const response = await fetch(playerProfileUrl(handle), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    const result = await readOptionalJson(response);
    if (!response.ok) {
      throw new Error(result.error || `Rotate token failed: ${response.statusText}`);
    }

    // Persist the new token only if the rotation was authenticated via
    // owner-Bearer. When admin overrides via body adminToken, we DO NOT save
    // the result — admin-rotates-on-behalf intentionally produces a one-time
    // raw token that the admin must relay to the user out of band.
    // Otherwise the admin's own localStorage gets polluted with someone
    // else's token under their handle, which is messy if not exploitable.
    if (result.ownershipToken && !adminToken) {
      saveOwnershipToken(handle, result.ownershipToken);
    }

    return result;
  } catch (error) {
    console.error('rotatePlayerToken error:', error);
    throw error;
  }
}

/**
 * Update player profile fields (NOT stats)
 * @param {string} handle - Player handle (immutable identifier)
 * @param {Object} updates - Fields to update
 * @param {string} updates.displayName - New display name
 * @param {string} updates.emoji - New emoji avatar
 * @param {string} updates.photoBase64 - New photo (or null to remove)
 * @param {string} updates.playStyle - New play style
 * @param {string} updates.tagline - New tagline
 * @param {string} [updates.adminToken] - Optional admin override (used when no owner token in localStorage)
 * @returns {Promise<{success: boolean, player: Object}>}
 */
export async function updatePlayerProfile(handle, updates) {
  try {
    // Owner token (if this device created the profile) → Authorization header.
    // Admin token → request body, server validates either.
    const headers = { 'Content-Type': 'application/json' };
    const ownerToken = getOwnershipToken(handle);
    if (ownerToken) {
      headers['Authorization'] = `Bearer ${ownerToken}`;
    }

    const response = await fetch(playerProfileUrl(handle), {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        mode: 'PROFILE_UPDATE',  // New mode to distinguish from stats updates
        ...updates
      })
    });

    const result = await readOptionalJson(response);

    if (!response.ok) {
      throw new Error(result.error || `Update profile failed: ${response.statusText}`);
    }

    return result;
  } catch (error) {
    console.error('updatePlayerProfile error:', error);
    throw error;
  }
}
