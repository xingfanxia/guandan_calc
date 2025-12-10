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
