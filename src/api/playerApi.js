// Player Profile API Client
// Handles all communication with player profile backend APIs

const API_BASE = window.location.origin;

// ===== Ownership token storage =====
// Issued by server at create-time, kept in localStorage so the original creator
// can self-edit their profile from the same browser without admin intervention.
// Per-handle key isolates tokens — useful if multiple players share a device.
const OWNER_TOKEN_PREFIX = 'gd_owner_token_';

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

// Currently unused; exists so a future "forget this device / log out" affordance
// can wipe the local credential. Don't inline at call sites — keep one definition
// of the storage-key derivation.
export function clearOwnershipToken(handle) {
  if (!handle) return;
  try {
    localStorage.removeItem(OWNER_TOKEN_PREFIX + handle.toLowerCase());
  } catch {}
}

/**
 * Search for players by handle or displayName
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 20)
 * @returns {Promise<{players: Array, total: number, hasMore: boolean}>}
 */
export async function searchPlayers(query = '', limit = 20) {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', limit.toString());

    const response = await fetch(`${API_BASE}/api/players/list?${params}`);

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return await response.json();
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
    const response = await fetch(`${API_BASE}/api/players/${handle}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Player not found');
      }
      throw new Error(`Get player failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('getPlayer error:', error);
    throw error;
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

    const result = await response.json();

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

  return { valid: true };
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

    return await response.json();
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

    const response = await fetch(`${API_BASE}/api/players/${handle}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(gameResult)
    });

    if (!response.ok) {
      throw new Error(`Update stats failed: ${response.statusText}`);
    }

    return await response.json();
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
  if (!historyEntry || players.length === 0 || !sessionStats) {
    console.log('Skipping profile stats sync - missing data');
    return;
  }

  console.log('Syncing COMPLETE SESSION stats for all players:', {
    roomCode,
    playerCount: players.length,
    winner: historyEntry.winKey,
    totalRounds: Object.values(sessionStats).length > 0 ? sessionStats[Object.keys(sessionStats)[0]]?.games : 0,
    honorsCount: Object.keys(sessionHonors).length
  });

  // Calculate relative rankings within this session
  const playerAverages = players.map(p => {
    const stats = sessionStats[p.id];
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

  // Map honors to players
  const playerHonors = {};
  Object.entries(sessionHonors).forEach(([honorKey, honorData]) => {
    if (honorData && honorData.player) {
      const playerId = honorData.player.id;
      if (!playerHonors[playerId]) playerHonors[playerId] = [];
      
      // Map honor keys to Chinese names
      const honorNames = {
        mvp: '吕布',
        burden: '阿斗',
        stable: '石佛',
        rollercoaster: '波动王',
        comeback: '奋斗王',
        assist: '辅助王',
        fanche: '翻车王',
        gambler: '赌徒',
        complete: '大满贯',
        streak: '连胜王',
        median: '佛系玩家',
        keeper: '守门员',
        slowstart: '慢热王',
        frequent: '闪电侠'
      };
      
      const honorName = honorNames[honorKey];
      if (honorName) {
        playerHonors[playerId].push(honorName);
      }
    }
  });

  // Iterate through ALL players and sync their complete session stats
  for (const player of players) {
    // Only update if player has a profile handle
    if (!player.handle) continue;

    // Get this player's complete session stats
    const playerSessionStats = sessionStats[player.id];
    if (!playerSessionStats || !playerSessionStats.games) {
      console.warn(`No session stats for player ${player.id} (@${player.handle})`);
      continue;
    }

    const playerTeamKey = `t${player.team}`;
    const avgRanking = playerSessionStats.totalRank / playerSessionStats.games;
    const honorsEarned = playerHonors[player.id] || [];
    const relativeRank = relativeRankings[player.id] || 0;  // Position within session (1-8)

    // Get teammates and opponents
    const teammates = players.filter(p => p.team === player.team && p.id !== player.id && p.handle);
    const opponents = players.filter(p => p.team !== player.team && p.handle);

    // Check if player was voted as MVP or burden
    const wasMVP = votingResults && votingResults.mvp === player.id;
    const wasBurden = votingResults && votingResults.burden === player.id;

    const gameResult = {
      roomCode,
      ranking: Math.round(avgRanking * 10) / 10,  // Session average ranking
      relativeRank: relativeRank,  // Position within this session (1-8)
      team: player.team,
      teamWon: historyEntry.winKey === playerTeamKey,
      gamesInSession: playerSessionStats.games,  // Total rounds played
      sessionDuration: historyEntry.sessionDuration || 0,  // Session duration in seconds
      firstPlaces: playerSessionStats.firstPlaceCount || 0,
      lastPlaces: playerSessionStats.lastPlaceCount || 0,
      honorsEarned: honorsEarned,  // Honors won in this session
      votedMVP: wasMVP,      // Community voted as MVP
      votedBurden: wasBurden, // Community voted as burden
      teammates: teammates.map(p => p.handle),  // Teammate handles
      opponents: opponents.map(p => p.handle),  // Opponent handles
      mode: `${players.length}P`,
      finalLevel: historyEntry[playerTeamKey] || '?'  // Team's final level
    };

    console.log(`Syncing session for @${player.handle}: ${playerSessionStats.games} rounds, avg ${avgRanking.toFixed(2)}, 对局内排名 #${relativeRank}, honors: ${honorsEarned.join(',')}`, gameResult);

    // Non-blocking stats update — host token authorizes writes for every
    // participant of this room; LOCAL games fall back to per-player owner token.
    updatePlayerStats(player.handle, gameResult, roomAuthToken).then(result => {
      if (result.success) {
        console.log(`✅ Session stats synced for @${player.handle}`);
      } else {
        console.warn(`❌ Failed to sync session for @${player.handle}`);
      }
    }).catch(err => {
      console.error(`Error syncing session for @${player.handle}:`, err);
    });
  }
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

    const response = await fetch(`${API_BASE}/api/players/${handle}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        mode: 'PROFILE_UPDATE',  // New mode to distinguish from stats updates
        ...updates
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Update profile failed: ${response.statusText}`);
    }

    return result;
  } catch (error) {
    console.error('updatePlayerProfile error:', error);
    throw error;
  }
}
