// Player Profile API Client
// Handles all communication with player profile backend APIs

const API_BASE = window.location.origin;

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
    'mystery': '神秘高手 🎭'
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
    { value: 'mystery', label: '神秘高手 🎭' }
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
 * @returns {Promise<{success: boolean, updatedStats: Object}>}
 */
export async function updatePlayerStats(handle, gameResult) {
  try {
    const response = await fetch(`${API_BASE}/api/players/${handle}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
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
 */
export async function syncProfileStats(historyEntry, roomCode = 'LOCAL', players = [], sessionStats = {}, sessionHonors = {}, votingResults = null) {
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

    // Check if player was voted as MVP or burden
    const wasMVP = votingResults && votingResults.mvp === player.id;
    const wasBurden = votingResults && votingResults.burden === player.id;

    const gameResult = {
      roomCode,
      ranking: Math.round(avgRanking * 10) / 10,  // Session average ranking
      team: player.team,
      teamWon: historyEntry.winKey === playerTeamKey,
      gamesInSession: playerSessionStats.games,  // Total rounds played
      sessionDuration: historyEntry.sessionDuration || 0,  // Session duration in seconds
      firstPlaces: playerSessionStats.firstPlaceCount || 0,
      lastPlaces: playerSessionStats.lastPlaceCount || 0,
      honorsEarned: honorsEarned,  // Honors won in this session
      votedMVP: wasMVP,      // Community voted as MVP
      votedBurden: wasBurden, // Community voted as burden
      mode: `${players.length}P`,
      finalLevel: historyEntry[playerTeamKey] || '?'  // Team's final level
    };

    console.log(`Syncing session for @${player.handle}: ${playerSessionStats.games} rounds, avg ${avgRanking.toFixed(2)}, honors: ${honorsEarned.join(',')}, MVP: ${wasMVP}, Burden: ${wasBurden}`, gameResult);

    // Non-blocking stats update
    updatePlayerStats(player.handle, gameResult).then(result => {
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
