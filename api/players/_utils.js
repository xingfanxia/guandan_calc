// Utility functions for player profile APIs
// UTF-8 encoding for Chinese characters
import { createHonorCounter } from '../../shared/honorCatalog.js';

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
  if (!handleRegex.test(handle)) return false;

  const unsafeObjectKeys = new Set(['__proto__', 'prototype', 'constructor']);
  return !unsafeObjectKeys.has(handle.toLowerCase());
}

function isAllowedPhotoDataUrl(photoBase64) {
  if (typeof photoBase64 !== 'string') return false;

  return /^data:image\/(?:jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photoBase64);
}

/**
 * Validate player creation data
 * @param {object} data Player data
 * @returns {object} { valid: boolean, error?: string }
 */
export function validatePlayerData(data) {
  // Required fields
  if (typeof data.handle !== 'string' || data.handle.trim() === '') {
    return { valid: false, error: 'Missing required field: handle' };
  }
  if (typeof data.displayName !== 'string' || data.displayName.trim() === '') {
    return { valid: false, error: 'Missing required field: displayName' };
  }
  if (typeof data.emoji !== 'string' || data.emoji.trim() === '') {
    return { valid: false, error: 'Missing required field: emoji' };
  }
  if (typeof data.playStyle !== 'string' || data.playStyle.trim() === '') {
    return { valid: false, error: 'Missing required field: playStyle' };
  }
  if (typeof data.tagline !== 'string' || data.tagline.trim() === '') {
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

  // Validate displayName length (max 40 characters). Closes a defense-in-depth
  // gap surfaced by the toast notification system (2026-05-06): displayName
  // flows into UI surfaces — toast title, victory modal, profile page — and
  // an unbounded value would break layout on small toasts and griefing-friendly
  // long names would render in shared rooms.
  if (data.displayName.length > 40) {
    return { valid: false, error: 'Display name must be 40 characters or less' };
  }

  // Validate tagline length (max 50 characters)
  if (data.tagline.length > 50) {
    return { valid: false, error: 'Tagline must be 50 characters or less' };
  }

  // Validate photoBase64 if provided (optional field)
  if (data.photoBase64) {
    // Match the client uploader contract. Do not accept arbitrary image/*
    // data URLs such as SVG, which can carry active content in some renderers.
    if (!isAllowedPhotoDataUrl(data.photoBase64)) {
      return { valid: false, error: 'Invalid photo format. Must be a JPEG, PNG, or WebP data URL' };
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
  const createBaseStatsStructure = () => ({
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
  });

  const baseStatsStructure = createBaseStatsStructure();

  return {
    // Overall stats (aggregated across all modes)
    ...baseStatsStructure,
    
    // Community voting
    mvpVotes: 0,
    burdenVotes: 0,
    votingHistory: {},

    // Completed-session idempotency
    sessionHistory: {},
    
    // Partner/Opponent tracking (aggregated)
    partners: {},
    opponents: {},
    
    // Legacy fields
    gamesPlayed: 0,
    wins: 0,
    winRate: 0,
    avgRanking: 0,
    
    // Honors (aggregated across all modes)
    honors: createHonorCounter(),
    
    // Mode-specific stats (NEW!)
    stats4P: createBaseStatsStructure(),
    stats6P: createBaseStatsStructure(),
    stats8P: createBaseStatsStructure(),
    
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

export function parsePlayerRecord(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizeRecordMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toNonNegativeFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function summarizeStatsForList(stats = {}) {
  const safeStats = normalizeRecordMap(stats);
  return {
    sessionsPlayed: toNonNegativeFiniteNumber(safeStats.sessionsPlayed),
    sessionsWon: toNonNegativeFiniteNumber(safeStats.sessionsWon),
    sessionWinRate: toNonNegativeFiniteNumber(safeStats.sessionWinRate),
    avgRankingPerSession: toNonNegativeFiniteNumber(safeStats.avgRankingPerSession),
    gamesPlayed: toNonNegativeFiniteNumber(safeStats.gamesPlayed ?? safeStats.sessionsPlayed),
    wins: toNonNegativeFiniteNumber(safeStats.wins ?? safeStats.sessionsWon),
    winRate: toNonNegativeFiniteNumber(safeStats.winRate ?? safeStats.sessionWinRate),
    avgRanking: toNonNegativeFiniteNumber(safeStats.avgRanking ?? safeStats.avgRankingPerSession)
  };
}

/**
 * Public list/search payload. Full player profiles can contain large photos,
 * recentGames, relationship maps, and voting history; list surfaces only need
 * identity plus compact aggregate stats. Use GET /api/players/{handle} when a
 * caller needs the full profile after selection.
 *
 * @param {object|null} player
 * @returns {object|null}
 */
export function summarizePlayerForList(player) {
  if (!player) return player;
  const safe = sanitizePlayer(player);
  return {
    id: safe.id,
    handle: safe.handle,
    displayName: safe.displayName,
    emoji: safe.emoji,
    playStyle: safe.playStyle,
    tagline: safe.tagline,
    createdAt: safe.createdAt,
    lastActiveAt: safe.lastActiveAt,
    stats: summarizeStatsForList(safe.stats)
  };
}

export function parseListPagination(searchParams, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const rawLimit = searchParams.get('limit') ?? String(defaultLimit);
  const rawOffset = searchParams.get('offset') ?? '0';

  if (!/^\d+$/.test(rawLimit)) {
    return { error: `Invalid limit. Must be an integer between 1 and ${maxLimit}.` };
  }

  if (!/^\d+$/.test(rawOffset)) {
    return { error: 'Invalid offset. Must be an integer 0 or greater.' };
  }

  const limit = Number(rawLimit);
  const offset = Number(rawOffset);

  if (limit < 1 || limit > maxLimit) {
    return { error: `Invalid limit. Must be an integer between 1 and ${maxLimit}.` };
  }
  if (!Number.isSafeInteger(offset)) {
    return { error: 'Invalid offset. Must be a safe integer 0 or greater.' };
  }

  return { limit, offset };
}
