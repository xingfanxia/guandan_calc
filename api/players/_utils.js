// Utility functions for player profile APIs
// UTF-8 encoding for Chinese characters

/**
 * Generate unique player ID in format PLR_XXXXXX
 * @returns {string} Player ID
 */
export function generatePlayerId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'PLR_';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Validate player handle format
 * Must be 3-20 characters, alphanumeric + underscore only
 * @param {string} handle
 * @returns {boolean}
 */
export function validateHandle(handle) {
  if (!handle || typeof handle !== 'string') {
    return false;
  }

  // Check length (3-20 characters)
  if (handle.length < 3 || handle.length > 20) {
    return false;
  }

  // Check format (alphanumeric + underscore only, no @ symbol)
  const handleRegex = /^[a-zA-Z0-9_]+$/;
  return handleRegex.test(handle);
}

/**
 * Validate player creation data
 * @param {object} data Player data
 * @returns {object} { valid: boolean, error?: string }
 */
export function validatePlayerData(data) {
  // Required fields
  if (!data.handle) {
    return { valid: false, error: 'Missing required field: handle' };
  }
  if (!data.displayName) {
    return { valid: false, error: 'Missing required field: displayName' };
  }
  if (!data.emoji) {
    return { valid: false, error: 'Missing required field: emoji' };
  }
  if (!data.playStyle) {
    return { valid: false, error: 'Missing required field: playStyle' };
  }
  if (!data.tagline) {
    return { valid: false, error: 'Missing required field: tagline' };
  }

  // Validate handle format
  if (!validateHandle(data.handle)) {
    return {
      valid: false,
      error: 'Invalid handle format. Must be 3-20 characters, alphanumeric and underscore only'
    };
  }

  // Validate play style (must be one of 9 predefined)
  const validPlayStyles = [
    'gambler', 'chill', 'scapegoat', 'tilt',
    'steady', 'yolo', 'secondPlace', 'mystery', 'lao8Hunter'
  ];
  if (!validPlayStyles.includes(data.playStyle)) {
    return {
      valid: false,
      error: `Invalid play style. Must be one of: ${validPlayStyles.join(', ')}`
    };
  }

  // Validate tagline length (max 50 characters)
  if (data.tagline.length > 50) {
    return { valid: false, error: 'Tagline must be 50 characters or less' };
  }

  // Validate photoBase64 if provided (optional field)
  if (data.photoBase64) {
    // Check if it's a valid data URL
    if (!data.photoBase64.startsWith('data:image/')) {
      return { valid: false, error: 'Invalid photo format. Must be a data URL' };
    }
    
    // Check size (limit to ~100KB base64 to avoid bloat)
    if (data.photoBase64.length > 150000) {
      return { valid: false, error: 'Photo too large. Please use a smaller image (max ~100KB)' };
    }
  }

  return { valid: true };
}

/**
 * Initialize fresh player stats object
 * @returns {object} Stats object with all honors at 0
 */
export function initializePlayerStats() {
  const baseStatsStructure = {
    // Session-level stats (complete games)
    sessionsPlayed: 0,
    sessionsWon: 0,
    sessionWinRate: 0,
    avgRankingPerSession: 0,
    avgRoundsPerSession: 0,
    longestSessionRounds: 0,
    
    // Round-level stats (individual rounds)
    roundsPlayed: 0,
    avgRankingPerRound: 0,
    
    // Time tracking
    totalPlayTimeSeconds: 0,
    longestSessionSeconds: 0,
    avgSessionSeconds: 0,
    
    // Recent rankings (relative positions)
    recentRankings: [],
    
    // Streaks
    currentWinStreak: 0,
    longestWinStreak: 0,
    currentLossStreak: 0,
    longestLossStreak: 0
  };

  return {
    // Overall stats (aggregated across all modes)
    ...baseStatsStructure,
    
    // Community voting
    mvpVotes: 0,
    burdenVotes: 0,
    votingHistory: {},
    
    // Partner/Opponent tracking (aggregated)
    partners: {},
    opponents: {},
    
    // Legacy fields
    gamesPlayed: 0,
    wins: 0,
    winRate: 0,
    avgRanking: 0,
    
    // Honors (aggregated across all modes)
    honors: {
      '吕布': 0,
      '阿斗': 0,
      '石佛': 0,
      '波动王': 0,
      '奋斗王': 0,
      '辅助王': 0,
      '翻车王': 0,
      '赌徒': 0,
      '大满贯': 0,
      '连胜王': 0,
      '佛系玩家': 0,
      '守门员': 0,
      '慢热王': 0,
      '闪电侠': 0
    },
    
    // Mode-specific stats (NEW!)
    stats4P: { ...baseStatsStructure },
    stats6P: { ...baseStatsStructure },
    stats8P: { ...baseStatsStructure },
    
    // Mode distribution counter
    modeBreakdown: {
      '4P': 0,
      '6P': 0,
      '8P': 0
    }
  };
}

/**
 * Validate admin token from request body against ADMIN_TOKEN env var.
 * Uses constant-time compare to prevent timing attacks.
 *
 * To enable admin endpoints, set ADMIN_TOKEN in Vercel project env vars.
 * If unset, ALL admin endpoints reject requests (fail-closed).
 *
 * @param {string} provided - Token from request body
 * @returns {boolean} true if valid
 */
export function validateAdminToken(provided) {
  if (!provided || typeof provided !== 'string') return false;

  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    console.warn('⚠️ ADMIN_TOKEN env var not set — admin endpoints reject all requests. Set it in Vercel env to enable.');
    return false;
  }

  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Generic constant-time string compare. Used for raw tokens (not hashes) where
 * both sides are full secrets — e.g., room auth tokens stored in KV. For
 * ownership-token validation prefer `validateOwnershipToken` which hashes first.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ===== Per-user ownership tokens =====
// Issued at create, sent as `Authorization: Bearer <token>` for self-edit.
// Stored hashed (SHA-256 hex) so a KV leak can't be replayed: preimage resistance
// means N stored hashes can't be reversed to usable tokens. Admin token is stored
// raw because it's a single env-var secret, but per-user tokens fan out across all
// player records so the blast radius justifies hashing.

export function generateOwnershipToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function validateOwnershipToken(provided, storedHash) {
  if (!provided || typeof provided !== 'string') return false;
  if (!storedHash || typeof storedHash !== 'string') return false;

  // Defense in depth: SHA-256 hex is always 64 chars. A length mismatch here
  // means the stored hash is corrupted or the storage format changed — reject
  // explicitly rather than fall through to a constant-time compare on garbage.
  // Without this, a future schema change that stored a non-hashed value would
  // silently turn the length-equality short-circuit below into a 1-bit oracle.
  if (storedHash.length !== 64) return false;

  const providedHash = await hashToken(provided);
  if (providedHash.length !== storedHash.length) return false;

  let mismatch = 0;
  for (let i = 0; i < providedHash.length; i++) {
    mismatch |= providedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

export function extractBearerToken(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match ? match[1].trim() : null;
}

/**
 * Strip server-only fields before returning a player record to the client.
 * Centralized so a typo in one endpoint can't silently leak the hash —
 * the field name is security-relevant and 5 sites would each carry that risk
 * if duplicated.
 * @param {object|null} player
 * @returns {object|null}
 */
export function sanitizePlayer(player) {
  if (!player) return player;
  const { ownershipTokenHash, ...rest } = player;
  return rest;
}
