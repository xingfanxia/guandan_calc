// Get player profile - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import {
  CURRENT_HONOR_COUNT,
  CURRENT_HONOR_TITLES,
  canonicalizeHonorTitle,
  normalizeHonorCounter
} from '../../shared/honorCatalog.js';
import { checkAchievements, getNewAchievements } from '../../shared/achievementLogic.js';
import {
  deriveGameProfileHistoryKey,
  deriveVoteProfileHistoryKey
} from '../../shared/voteSessionKey.js';
import { getHistoryEntries, resolveGameStatus } from '../../shared/gameStatus.js';
import { publicVoteStoreForRoom } from '../rooms/_votes.js';
import {
  validateHandle,
  initializePlayerStats,
  validatePlayerData,
  validateAdminToken,
  validateOwnershipToken,
  extractBearerToken,
  sanitizePlayer,
  parsePlayerRecord,
  normalizeRecordMap,
  constantTimeEqual,
  generateOwnershipToken,
  hashToken
} from './_utils.js';
import { applyLegacyRecentGamesToModeStats } from './_modeMigration.js';
import { parseRoomRecord } from '../rooms/_record.js';

const RESPONSE_OPTIONS = {
  methods: 'GET, PUT, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization'
};
const MAX_PROFILE_VOTE_COUNT = 1000;

export function normalizeProfileVoteCount(value, votedFlag = false) {
  if (value === undefined || value === null) {
    return votedFlag ? 1 : 0;
  }

  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_PROFILE_VOTE_COUNT) {
    return 0;
  }

  return count;
}

function normalizeProfileHandleCandidate(rawHandle) {
  if (typeof rawHandle !== 'string') return null;
  const normalized = rawHandle.trim().toLowerCase();
  if (normalized === 'session' || !validateHandle(normalized)) return null;
  return normalized;
}

function normalizeRoomPlayerProfileHandle(player) {
  return normalizeProfileHandleCandidate(player?.handle) ||
    normalizeProfileHandleCandidate(player?.profileHandle);
}

export function findRoomPlayerByProfileHandle(roomPlayers, handle) {
  if (!Array.isArray(roomPlayers) || typeof handle !== 'string') return null;

  const normalizedHandle = handle.trim().toLowerCase();
  if (!validateHandle(normalizedHandle)) return null;

  return roomPlayers.find(player =>
    normalizeRoomPlayerProfileHandle(player) === normalizedHandle
  ) || null;
}

function getRoomPlayerTeamKey(roomPlayer) {
  const team = Number(roomPlayer?.team);
  if (team === 1) return 't1';
  if (team === 2) return 't2';
  return null;
}

function resolveRoomPlayerTeamWon(room, roomPlayer) {
  if (!room || !roomPlayer) return null;

  const playerTeamKey = getRoomPlayerTeamKey(roomPlayer);
  if (!playerTeamKey) return null;

  const history = getHistoryEntries(room?.state);
  const gameStatus = resolveGameStatus(room?.state?.gameStatus, history);
  if (!gameStatus.ended || !gameStatus.winnerKey) return null;

  return playerTeamKey === gameStatus.winnerKey;
}

function applyProfileVoteStats(stats, votingHistoryKey, gameResult, syncedAt = new Date().toISOString()) {
  stats.votingHistory = normalizeRecordMap(stats.votingHistory);

  const oldVotes = stats.votingHistory[votingHistoryKey] || { mvp: 0, burden: 0 };
  // Use ?? not || so explicit `0` from client is respected (0 votes received).
  // Previously `||` would fall through to the votedMVP boolean and flip 0 to 1.
  const newMvpVotes = normalizeProfileVoteCount(gameResult.mvpVoteCount, gameResult.votedMVP);
  const newBurdenVotes = normalizeProfileVoteCount(gameResult.burdenVoteCount, gameResult.votedBurden);

  const mvpDelta = newMvpVotes - oldVotes.mvp;
  const burdenDelta = newBurdenVotes - oldVotes.burden;

  // Clamp running totals at 0 — `votingHistory` deltas can legitimately go
  // negative (vote reset, authoritative read drops below previously-synced
  // count), so without the clamp legacy/inflated histories could push lifetime
  // totals below zero.
  stats.mvpVotes = Math.max(0, (stats.mvpVotes || 0) + mvpDelta);
  stats.burdenVotes = Math.max(0, (stats.burdenVotes || 0) + burdenDelta);

  stats.votingHistory[votingHistoryKey] = {
    mvp: newMvpVotes,
    burden: newBurdenVotes,
    roomCode: gameResult.roomCode,
    lastSynced: syncedAt
  };
}

const MAX_SESSION_ROUNDS = 10000;
const MAX_SESSION_SECONDS = 30 * 24 * 60 * 60;
const MAX_PROFILE_RELATION_HANDLES = 7;
const MAX_PROFILE_SESSION_KEY_LENGTH = 500;
const VALID_STATS_MODES = new Set(['4P', '6P', '8P', 'VOTE_ONLY']);
const STATS_MODE_PLAYER_COUNTS = Object.freeze({
  '4P': 4,
  '6P': 6,
  '8P': 8
});
const MAX_PROFILE_SESSION_HONORS = CURRENT_HONOR_COUNT;
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function normalizeProfileStatsRoomCode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'LOCAL') return normalized;
  return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
}

function parseFiniteNumber(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseInteger(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function normalizeOptionalBoolean(value, field) {
  if (value === undefined || value === null) return { ok: true, data: false };
  if (typeof value !== 'boolean') return { ok: false, error: `Invalid ${field}` };
  return { ok: true, data: value };
}

function normalizeOptionalVoteCount(value, field) {
  if (value === undefined || value === null) return { ok: true, data: undefined };

  const count = parseInteger(value);
  if (count === null || count < 0 || count > MAX_PROFILE_VOTE_COUNT) {
    return { ok: false, error: `Invalid ${field}` };
  }

  return { ok: true, data: count };
}

function normalizeHandleList(value, field) {
  if (value === undefined || value === null) return { ok: true, data: [] };
  if (!Array.isArray(value) || value.length > MAX_PROFILE_RELATION_HANDLES) {
    return { ok: false, error: `Invalid ${field}` };
  }

  const seen = new Set();
  const handles = [];
  for (const item of value) {
    if (typeof item !== 'string') return { ok: false, error: `Invalid ${field}` };
    const normalized = item.trim().toLowerCase();
    if (!validateHandle(normalized)) return { ok: false, error: `Invalid ${field}` };
    if (!seen.has(normalized)) {
      seen.add(normalized);
      handles.push(normalized);
    }
  }
  return { ok: true, data: handles };
}

function normalizeOptionalSessionKey(value, field) {
  if (value === undefined || value === null) return { ok: true, data: undefined };
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    typeof value !== 'string' ||
    normalized.length === 0 ||
    normalized.length > MAX_PROFILE_SESSION_KEY_LENGTH ||
    UNSAFE_OBJECT_KEYS.has(normalized.toLowerCase())
  ) {
    return { ok: false, error: `Invalid ${field}` };
  }
  return { ok: true, data: normalized };
}

function normalizeHonorsEarned(value) {
  if (value === undefined || value === null) return { ok: true, data: [] };
  if (!Array.isArray(value) || value.length > MAX_PROFILE_SESSION_HONORS) {
    return { ok: false, error: 'Invalid honorsEarned' };
  }

  const seen = new Set();
  const honorsEarned = [];

  for (const item of value) {
    const honorTitle = canonicalizeHonorTitle(item);
    if (!honorTitle) {
      return { ok: false, error: 'Invalid honorsEarned' };
    }
    if (!seen.has(honorTitle)) {
      seen.add(honorTitle);
      honorsEarned.push(honorTitle);
    }
  }

  return { ok: true, data: honorsEarned };
}

export function normalizeGameStatsUpdate(gameResult = {}) {
  const roomCode = normalizeProfileStatsRoomCode(gameResult.roomCode);
  if (!roomCode) {
    return { ok: false, error: 'Invalid roomCode' };
  }

  const mode = typeof gameResult.mode === 'string' ? gameResult.mode.trim() : '';
  if (!VALID_STATS_MODES.has(mode)) {
    return { ok: false, error: 'Invalid mode' };
  }
  const isVoteOnly = mode === 'VOTE_ONLY';
  const maxRankForMode = STATS_MODE_PLAYER_COUNTS[mode] || 8;

  const ranking = parseFiniteNumber(gameResult.ranking);
  if (
    ranking === null ||
    ranking < 0 ||
    ranking > maxRankForMode ||
    (!isVoteOnly && ranking <= 0)
  ) {
    return { ok: false, error: 'Invalid ranking' };
  }

  const team = parseInteger(gameResult.team);
  if (team !== 1 && team !== 2) {
    return { ok: false, error: 'Invalid team' };
  }

  const gamesInSession = gameResult.gamesInSession === undefined
    ? (isVoteOnly ? 0 : 1)
    : parseInteger(gameResult.gamesInSession);
  if (
    gamesInSession === null ||
    gamesInSession < 0 ||
    gamesInSession > MAX_SESSION_ROUNDS ||
    (!isVoteOnly && gamesInSession < 1)
  ) {
    return { ok: false, error: 'Invalid gamesInSession' };
  }

  const sessionDuration = gameResult.sessionDuration === undefined
    ? 0
    : parseFiniteNumber(gameResult.sessionDuration);
  if (sessionDuration === null || sessionDuration < 0 || sessionDuration > MAX_SESSION_SECONDS) {
    return { ok: false, error: 'Invalid sessionDuration' };
  }

  const firstPlaces = gameResult.firstPlaces === undefined ? 0 : parseInteger(gameResult.firstPlaces);
  if (firstPlaces === null || firstPlaces < 0 || firstPlaces > gamesInSession) {
    return { ok: false, error: 'Invalid firstPlaces' };
  }

  const lastPlaces = gameResult.lastPlaces === undefined ? 0 : parseInteger(gameResult.lastPlaces);
  if (lastPlaces === null || lastPlaces < 0 || lastPlaces > gamesInSession) {
    return { ok: false, error: 'Invalid lastPlaces' };
  }
  if (firstPlaces + lastPlaces > gamesInSession) {
    return { ok: false, error: 'Invalid firstPlaces/lastPlaces total' };
  }

  let relativeRank = gameResult.relativeRank;
  if (relativeRank !== undefined && relativeRank !== null) {
    relativeRank = parseInteger(relativeRank);
    if (relativeRank === null || relativeRank < 1 || relativeRank > maxRankForMode) {
      return { ok: false, error: 'Invalid relativeRank' };
    }
  } else {
    relativeRank = undefined;
  }

  const teamWon = normalizeOptionalBoolean(gameResult.teamWon, 'teamWon');
  if (!teamWon.ok) return teamWon;

  const votedMVP = normalizeOptionalBoolean(gameResult.votedMVP, 'votedMVP');
  if (!votedMVP.ok) return votedMVP;

  const votedBurden = normalizeOptionalBoolean(gameResult.votedBurden, 'votedBurden');
  if (!votedBurden.ok) return votedBurden;

  const mvpVoteCount = normalizeOptionalVoteCount(gameResult.mvpVoteCount, 'mvpVoteCount');
  if (!mvpVoteCount.ok) return mvpVoteCount;

  const burdenVoteCount = normalizeOptionalVoteCount(gameResult.burdenVoteCount, 'burdenVoteCount');
  if (!burdenVoteCount.ok) return burdenVoteCount;

  const teammates = normalizeHandleList(gameResult.teammates, 'teammates');
  if (!teammates.ok) return teammates;

  const opponents = normalizeHandleList(gameResult.opponents, 'opponents');
  if (!opponents.ok) return opponents;

  const gameSessionKey = normalizeOptionalSessionKey(gameResult.gameSessionKey, 'gameSessionKey');
  if (!gameSessionKey.ok) return gameSessionKey;
  if (!isVoteOnly && gameSessionKey.data === undefined) {
    return { ok: false, error: 'Invalid gameSessionKey' };
  }

  const voteSessionKey = normalizeOptionalSessionKey(gameResult.voteSessionKey, 'voteSessionKey');
  if (!voteSessionKey.ok) return voteSessionKey;

  const honorsEarned = normalizeHonorsEarned(gameResult.honorsEarned);
  if (!honorsEarned.ok) return honorsEarned;

  return {
    ok: true,
    data: {
      ...gameResult,
      roomCode,
      ranking,
      team,
      gamesInSession,
      sessionDuration,
      firstPlaces,
      lastPlaces,
      relativeRank,
      teamWon: teamWon.data,
      votedMVP: votedMVP.data,
      votedBurden: votedBurden.data,
      mvpVoteCount: mvpVoteCount.data,
      burdenVoteCount: burdenVoteCount.data,
      teammates: teammates.data,
      opponents: opponents.data,
      gameSessionKey: gameSessionKey.data,
      voteSessionKey: voteSessionKey.data,
      honorsEarned: honorsEarned.data,
      mode
    }
  };
}

const MODE_STATS_KEYS = ['stats4P', 'stats6P', 'stats8P'];
const MODE_BREAKDOWN_KEYS = ['4P', '6P', '8P'];
const STATS_INTEGER_FIELDS = [
  'sessionsPlayed',
  'sessionsWon',
  'longestSessionRounds',
  'roundsPlayed',
  'totalPlayTimeSeconds',
  'longestSessionSeconds',
  'currentWinStreak',
  'longestWinStreak',
  'currentLossStreak',
  'longestLossStreak'
];
const STATS_NUMBER_FIELDS = [
  'sessionWinRate',
  'avgRankingPerSession',
  'avgRoundsPerSession',
  'avgRankingPerRound',
  'avgSessionSeconds'
];
const STATS_LEGACY_INTEGER_FIELDS = ['mvpVotes', 'burdenVotes', 'gamesPlayed', 'wins'];
const STATS_LEGACY_NUMBER_FIELDS = ['winRate', 'avgRanking'];
const MAX_RECENT_RANKINGS = 10;
const MAX_RELATIVE_RANKING = 8;

function isPlainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function normalizeNonNegativeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeRecentRankings(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => Number(item))
    .filter(item => Number.isSafeInteger(item) && item > 0 && item <= MAX_RELATIVE_RANKING)
    .slice(0, MAX_RECENT_RANKINGS);
}

function rankingsChanged(before, after) {
  if (!Array.isArray(before) || before.length !== after.length) return true;
  return after.some((item, index) => before[index] !== item);
}

function normalizeStatsBucketShape(current, defaults) {
  const source = isPlainRecord(current) ? current : {};
  const next = { ...defaults, ...source };
  let changed = source !== current;

  STATS_INTEGER_FIELDS.forEach(field => {
    if (!(field in source)) changed = true;
    const normalized = normalizeNonNegativeInteger(next[field], defaults[field] || 0);
    if (next[field] !== normalized) changed = true;
    next[field] = normalized;
  });

  STATS_NUMBER_FIELDS.forEach(field => {
    if (!(field in source)) changed = true;
    const normalized = normalizeNonNegativeNumber(next[field], defaults[field] || 0);
    if (next[field] !== normalized) changed = true;
    next[field] = normalized;
  });

  if (!('recentRankings' in source)) changed = true;
  const recentRankings = normalizeRecentRankings(next.recentRankings);
  if (rankingsChanged(next.recentRankings, recentRankings)) changed = true;
  next.recentRankings = recentRankings;

  return { stats: next, changed };
}

function applyStatsBucketShape(target, normalized) {
  STATS_INTEGER_FIELDS.forEach(field => {
    target[field] = normalized[field];
  });
  STATS_NUMBER_FIELDS.forEach(field => {
    target[field] = normalized[field];
  });
  target.recentRankings = normalized.recentRankings;
}

function normalizeProfileStatsShape(stats) {
  const freshStats = initializePlayerStats();
  let changed = false;

  const overallStats = normalizeStatsBucketShape(stats, freshStats);
  applyStatsBucketShape(stats, overallStats.stats);
  if (overallStats.changed) changed = true;

  STATS_LEGACY_INTEGER_FIELDS.forEach(field => {
    const normalized = normalizeNonNegativeInteger(stats[field], freshStats[field] || 0);
    if (stats[field] !== normalized) changed = true;
    stats[field] = normalized;
  });

  STATS_LEGACY_NUMBER_FIELDS.forEach(field => {
    const normalized = normalizeNonNegativeNumber(stats[field], freshStats[field] || 0);
    if (stats[field] !== normalized) changed = true;
    stats[field] = normalized;
  });

  MODE_STATS_KEYS.forEach(key => {
    const normalizedModeStats = normalizeStatsBucketShape(stats[key], freshStats[key]);
    stats[key] = normalizedModeStats.stats;
    if (normalizedModeStats.changed) changed = true;
  });

  if (!isPlainRecord(stats.modeBreakdown)) {
    stats.modeBreakdown = { ...freshStats.modeBreakdown };
    changed = true;
  }

  MODE_BREAKDOWN_KEYS.forEach(key => {
    const count = normalizeNonNegativeInteger(stats.modeBreakdown[key], freshStats.modeBreakdown[key] || 0);
    if (stats.modeBreakdown[key] !== count) {
      stats.modeBreakdown[key] = count;
      changed = true;
    }
  });

  return changed;
}

// Migrate historical games to mode-specific stats (runs once per player)
function migrateToModeStats(player) {
  if (!player.stats || typeof player.stats !== 'object') {
    player.stats = initializePlayerStats();
    return true;
  }

  player.stats.honors = normalizeHonorCounter(player.stats.honors);
  player.stats.sessionHistory = normalizeRecordMap(player.stats.sessionHistory);

  // Check if already migrated
  if (player.stats.stats4P && player.stats.stats4P.sessionsPlayed !== undefined) {
    return normalizeProfileStatsShape(player.stats); // Already migrated; repair partial legacy shapes.
  }

  console.log(`Migrating historical games for @${player.handle}`);

  // Initialize mode-specific stats (initializePlayerStats imported at top — Edge runtime is ESM-only,
  // a CommonJS `require` here was dead code that would have thrown if this branch ever ran)
  const freshStats = initializePlayerStats();
  player.stats.stats4P = { ...freshStats.stats4P };
  player.stats.stats6P = { ...freshStats.stats6P };
  player.stats.stats8P = { ...freshStats.stats8P };
  player.stats.modeBreakdown = { '4P': 0, '6P': 0, '8P': 0 };

  // Replay recent games to populate mode stats
  // Note: recentGames is stored newest-first, so reverse for chronological replay
  if (player.recentGames && Array.isArray(player.recentGames)) {
    applyLegacyRecentGamesToModeStats(player, {
      preferOverallRecentRankings: true,
      log: true
    });

    console.log(`Migration complete: 4P=${player.stats.modeBreakdown['4P']}, 6P=${player.stats.modeBreakdown['6P']}, 8P=${player.stats.modeBreakdown['8P']}`);
    console.log(`Time stats BEFORE aggregation: 6P=${player.stats.stats6P?.totalPlayTimeSeconds}, 8P=${player.stats.stats8P?.totalPlayTimeSeconds}`);

    // ===== AGGREGATE ALL STATS FROM MODE-SPECIFIC TO OVERALL =====
    const s4 = player.stats.stats4P || {};
    const s6 = player.stats.stats6P || {};
    const s8 = player.stats.stats8P || {};

    // Session stats (sum across modes)
    player.stats.sessionsPlayed = (s4.sessionsPlayed || 0) + (s6.sessionsPlayed || 0) + (s8.sessionsPlayed || 0);
    player.stats.sessionsWon = (s4.sessionsWon || 0) + (s6.sessionsWon || 0) + (s8.sessionsWon || 0);
    player.stats.sessionWinRate = player.stats.sessionsPlayed > 0
      ? player.stats.sessionsWon / player.stats.sessionsPlayed
      : 0;

    // Avg ranking per session (weighted average)
    const totalRankingSum =
      (s4.avgRankingPerSession || 0) * (s4.sessionsPlayed || 0) +
      (s6.avgRankingPerSession || 0) * (s6.sessionsPlayed || 0) +
      (s8.avgRankingPerSession || 0) * (s8.sessionsPlayed || 0);
    player.stats.avgRankingPerSession = player.stats.sessionsPlayed > 0
      ? totalRankingSum / player.stats.sessionsPlayed
      : 0;

    // Avg rounds per session (weighted average)
    const totalRoundsSum =
      (s4.avgRoundsPerSession || 0) * (s4.sessionsPlayed || 0) +
      (s6.avgRoundsPerSession || 0) * (s6.sessionsPlayed || 0) +
      (s8.avgRoundsPerSession || 0) * (s8.sessionsPlayed || 0);
    player.stats.avgRoundsPerSession = player.stats.sessionsPlayed > 0
      ? totalRoundsSum / player.stats.sessionsPlayed
      : 0;

    // Longest session (max across modes)
    player.stats.longestSessionRounds = Math.max(
      s4.longestSessionRounds || 0,
      s6.longestSessionRounds || 0,
      s8.longestSessionRounds || 0
    );

    // Round stats (sum across modes)
    player.stats.roundsPlayed = (s4.roundsPlayed || 0) + (s6.roundsPlayed || 0) + (s8.roundsPlayed || 0);
    const totalRoundRankSum =
      (s4.avgRankingPerRound || 0) * (s4.roundsPlayed || 0) +
      (s6.avgRankingPerRound || 0) * (s6.roundsPlayed || 0) +
      (s8.avgRankingPerRound || 0) * (s8.roundsPlayed || 0);
    player.stats.avgRankingPerRound = player.stats.roundsPlayed > 0
      ? totalRoundRankSum / player.stats.roundsPlayed
      : 0;

    // Time stats (sum and max)
    player.stats.totalPlayTimeSeconds =
      (s4.totalPlayTimeSeconds || 0) +
      (s6.totalPlayTimeSeconds || 0) +
      (s8.totalPlayTimeSeconds || 0);

    player.stats.longestSessionSeconds = Math.max(
      s4.longestSessionSeconds || 0,
      s6.longestSessionSeconds || 0,
      s8.longestSessionSeconds || 0
    );

    player.stats.avgSessionSeconds = player.stats.sessionsPlayed > 0
      ? player.stats.totalPlayTimeSeconds / player.stats.sessionsPlayed
      : 0;

    // Streaks (use overall, not mode-specific)
    // Current streaks are per-mode, overall tracks the latest game across all modes
    // For now, use the most recent mode's streak (can enhance later)
    const modes = ['4P', '6P', '8P'];
    let maxLongestWin = 0;
    let maxLongestLoss = 0;
    modes.forEach(mode => {
      const mStats = player.stats[`stats${mode}`];
      if (mStats) {
        maxLongestWin = Math.max(maxLongestWin, mStats.longestWinStreak || 0);
        maxLongestLoss = Math.max(maxLongestLoss, mStats.longestLossStreak || 0);
      }
    });
    player.stats.longestWinStreak = maxLongestWin;
    player.stats.longestLossStreak = maxLongestLoss;

    // Legacy fields (for backward compat)
    player.stats.gamesPlayed = player.stats.sessionsPlayed;
    player.stats.wins = player.stats.sessionsWon;
    player.stats.winRate = player.stats.sessionWinRate;
    player.stats.avgRanking = player.stats.avgRankingPerSession;
  }

  normalizeProfileStatsShape(player.stats);

  return true; // Migration performed
}

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'GET, PUT, OPTIONS', 'Content-Type, Authorization');
  if (preflight) return preflight;

  // Only allow GET and PUT requests
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed' }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    // Extract handle from URL
    const url = new URL(request.url);
    const handle = url.pathname.split('/').pop().toLowerCase();

    // Validate handle format
    if (!validateHandle(handle)) {
      return jsonResponse({
        error: 'Invalid handle format'
      }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    if (request.method === 'GET') {
      // Migration is a write and must not be triggered by a public GET.
      // Reject before any KV access so unauthenticated maintenance attempts
      // fail closed even when storage env vars are unavailable locally.
      if (url.searchParams.get('migrate') === 'true') {
        return jsonResponse({
          error: 'Manual migration requires an admin-gated maintenance endpoint'
        }, { ...RESPONSE_OPTIONS, status: 403 });
      }

      // Get player data from KV
      const playerData = await kv.get(`player:${handle}`);

      if (!playerData) {
        return jsonResponse({
          error: 'Player not found'
        }, { ...RESPONSE_OPTIONS, status: 404 });
      }

      const player = parsePlayerRecord(playerData);
      if (!player) {
        return jsonResponse({
          error: 'Player not found'
        }, { ...RESPONSE_OPTIONS, status: 404 });
      }
      if (!player.stats || typeof player.stats !== 'object') {
        player.stats = initializePlayerStats();
      } else {
        player.stats.honors = normalizeHonorCounter(player.stats.honors);
        player.stats.sessionHistory = normalizeRecordMap(player.stats.sessionHistory);
      }

      // Return full player profile (strip token hash — internal-only)
      return jsonResponse({
        success: true,
        player: sanitizePlayer(player)
      }, RESPONSE_OPTIONS);

    } else if (request.method === 'PUT') {
      // Parse request body
      const parsedBody = await parseJsonBody(request);
      if (!parsedBody.ok) {
        return jsonResponse({ error: parsedBody.error }, { ...RESPONSE_OPTIONS, status: 400 });
      }
      const requestData = parsedBody.data;

      // Check if this is a profile update (not a game stats update)
      if (requestData.mode === 'PROFILE_UPDATE') {
        // ===== PROFILE UPDATE MODE =====
        const updates = requestData;

        // Get existing player FIRST — needed both for the ownership check
        // (must compare Bearer against stored hash) and for the update target.
        const existingData = await kv.get(`player:${handle}`);
        if (!existingData) {
          return jsonResponse({
            error: 'Player not found'
          }, { ...RESPONSE_OPTIONS, status: 404 });
        }
        const player = parsePlayerRecord(existingData);
        if (!player) {
          return jsonResponse({
            error: 'Player not found'
          }, { ...RESPONSE_OPTIONS, status: 404 });
        }

        // Auth: admin token (body) OR ownership Bearer (header).
        // Admin always overrides; owner only works if the player record was created
        // with the new ownership-token flow (legacy records have no hash, fall through to admin-only).
        const adminOk = validateAdminToken(updates.adminToken);
        let ownerOk = false;
        if (!adminOk) {
          const bearer = extractBearerToken(request);
          if (bearer && player.ownershipTokenHash) {
            ownerOk = await validateOwnershipToken(bearer, player.ownershipTokenHash);
          }
        }

        if (!adminOk && !ownerOk) {
          return jsonResponse({
            error: 'Unauthorized — profile updates require ownership token or admin token'
          }, { ...RESPONSE_OPTIONS, status: 403 });
        }
        const nextPhotoBase64 = updates.photoBase64 !== undefined
          ? updates.photoBase64
          : player.photoBase64;
        const validation = validatePlayerData({
          handle,  // For validation only (not updated)
          displayName: updates.displayName !== undefined ? updates.displayName : (player.displayName || 'Profile'),
          emoji: updates.emoji !== undefined ? updates.emoji : (player.emoji || '🐶'),
          photoBase64: nextPhotoBase64 === null ? undefined : nextPhotoBase64,
          playStyle: updates.playStyle !== undefined ? updates.playStyle : (player.playStyle || 'steady'),
          tagline: updates.tagline !== undefined ? updates.tagline : (player.tagline || 'Profile')
        });

        if (!validation.valid) {
          return jsonResponse({
            error: validation.error
          }, { ...RESPONSE_OPTIONS, status: 400 });
        }

        // Update ONLY profile fields (not stats, not handle, not ownershipTokenHash)
        if (updates.displayName !== undefined) player.displayName = updates.displayName;
        if (updates.emoji !== undefined) player.emoji = updates.emoji;
        if (updates.photoBase64 !== undefined) player.photoBase64 = updates.photoBase64;  // Can be null to remove
        if (updates.playStyle !== undefined) player.playStyle = updates.playStyle;
        if (updates.tagline !== undefined) player.tagline = updates.tagline;

        // Update lastActiveAt
        player.lastActiveAt = new Date().toISOString();

        // Save to KV
        await kv.set(`player:${handle}`, JSON.stringify(player));

        console.log(`Profile updated for @${handle} (auth: ${adminOk ? 'admin' : 'owner'})`);

        return jsonResponse({
          success: true,
          player: sanitizePlayer(player)
        }, RESPONSE_OPTIONS);
      }

      // ===== ROTATE OWNERSHIP TOKEN MODE =====
      // Issues a fresh ownership token for the player and invalidates the old
      // one (by replacing the stored hash). Auth: same as PROFILE_UPDATE — admin
      // body token OR current ownership Bearer. The new raw token is returned
      // ONCE in the response; client persists it (overwriting the old one).
      // Use case: shared device cleanup, token rotation hygiene, or admin
      // re-issuing for a user who lost their token.
      if (requestData.mode === 'ROTATE_TOKEN') {
        const existingData = await kv.get(`player:${handle}`);
        if (!existingData) {
          return jsonResponse({
            error: 'Player not found'
          }, { ...RESPONSE_OPTIONS, status: 404 });
        }
        const player = parsePlayerRecord(existingData);
        if (!player) {
          return jsonResponse({
            error: 'Player not found'
          }, { ...RESPONSE_OPTIONS, status: 404 });
        }

        const adminOk = validateAdminToken(requestData.adminToken);
        let ownerOk = false;
        if (!adminOk) {
          const bearer = extractBearerToken(request);
          if (bearer && player.ownershipTokenHash) {
            ownerOk = await validateOwnershipToken(bearer, player.ownershipTokenHash);
          }
        }
        if (!adminOk && !ownerOk) {
          return jsonResponse({
            error: 'Unauthorized — token rotation requires current ownership Bearer or admin token'
          }, {
            ...RESPONSE_OPTIONS,
            status: 403,
            headers: {
              'WWW-Authenticate': 'Bearer realm="player-rotate"'
            }
          });
        }

        const newToken = generateOwnershipToken();
        player.ownershipTokenHash = await hashToken(newToken);
        player.lastActiveAt = new Date().toISOString();

        // Race trade-off (accepted): KV has no CAS, so concurrent rotation
        // requests are last-write-wins. The "loser" client gets a 200 but its
        // returned token's hash is no longer stored — they'd be silently
        // logged out. User-initiated rotation rate is near zero in practice,
        // so the additional infrastructure for atomic CAS isn't justified.
        await kv.set(`player:${handle}`, JSON.stringify(player));
        console.log(`Token rotated for @${handle} (auth: ${adminOk ? 'admin' : 'owner'})`);

        return jsonResponse({
          success: true,
          ownershipToken: newToken,  // shown ONCE — client persists, server forgets
          player: sanitizePlayer(player)
        }, RESPONSE_OPTIONS);
      }

      // ===== GAME STATS UPDATE MODE (existing logic) =====
      const statsInput = normalizeGameStatsUpdate(requestData);
      if (!statsInput.ok) {
        return jsonResponse({
          error: statsInput.error
        }, { ...RESPONSE_OPTIONS, status: 400 });
      }
      const gameResult = statsInput.data;

      // Get existing player data
      const playerData = await kv.get(`player:${handle}`);
      if (!playerData) {
        return jsonResponse({
          error: 'Player not found'
        }, { ...RESPONSE_OPTIONS, status: 404 });
      }

      const player = parsePlayerRecord(playerData);
      if (!player) {
        return jsonResponse({
          error: 'Player not found'
        }, { ...RESPONSE_OPTIONS, status: 404 });
      }
      if (!player.stats || typeof player.stats !== 'object') {
        player.stats = initializePlayerStats();
      }
      player.stats.honors = normalizeHonorCounter(player.stats.honors);
      player.stats.sessionHistory = normalizeRecordMap(player.stats.sessionHistory);

      // Load the room once (single KV roundtrip) — used by BOTH the auth gate
      // (host-Bearer check needs room.authToken + room.players[]) and the
      // authoritative vote-count fetch later (P1 #2 fix: don't trust
      // client-supplied mvpVoteCount / burdenVoteCount). LOCAL games and
      // malformed roomCodes skip the load — `_room` stays null.
      // ACCEPTED LOW (security review 2026-05-03): timing oracle for "room
      // exists?" is acceptable since room codes are already public via
      // /api/rooms/list.
      const submittedRoomCode = gameResult.roomCode;
      const isRealRoomCode = typeof submittedRoomCode === 'string' && /^[A-Z0-9]{6}$/.test(submittedRoomCode);
      let _room = null;
      if (isRealRoomCode) {
        const roomData = await kv.get(`room:${submittedRoomCode}`);
        if (roomData) {
          _room = parseRoomRecord(roomData);
        }
      }
      const _roomPlayers = Array.isArray(_room?.players) ? _room.players : [];
      const _targetRoomPlayer = _room
        ? findRoomPlayerByProfileHandle(_roomPlayers, handle)
        : null;

      // ===== AUTH GATE for stats path =====
      // Three valid credentials, in priority order. Any one passes:
      //   1. adminToken in body — admin override (always valid)
      //   2. Authorization: Bearer <ownershipToken> matching THIS player's hash —
      //      owner self-update from their own device
      //   3. Authorization: Bearer <roomAuthToken> matching the stored token of
      //      the room identified by gameResult.roomCode AND target handle is
      //      listed in that room's players[] — host writing for a participant
      //
      // For LOCAL games (no room), only paths 1 and 2 are available. Without this
      // gate, an unauthenticated client could pollute any player's career stats
      // (ranking averages, MVP votes, partner graph, win streaks) by spamming PUT.
      const _bearer = extractBearerToken(request);
      const _adminOk = validateAdminToken(gameResult.adminToken);
      let _ownerOk = false;
      let _hostOk = false;

      if (!_adminOk && _bearer) {
        if (player.ownershipTokenHash) {
          _ownerOk = await validateOwnershipToken(_bearer, player.ownershipTokenHash);
        }

        if (!_ownerOk && _room && _room.authToken && constantTimeEqual(_bearer, _room.authToken)) {
          if (_targetRoomPlayer) _hostOk = true;
        }
      }

      if (!_adminOk && isRealRoomCode && !_hostOk) {
        return jsonResponse({
          error: 'Unauthorized — real-room stats updates require room-host bearer or admin token'
        }, {
          ...RESPONSE_OPTIONS,
          status: 403,
          headers: {
            'WWW-Authenticate': 'Bearer realm="player-stats"'
          }
        });
      }

      if (!_adminOk && !_ownerOk && !_hostOk) {
        return jsonResponse({
          error: 'Unauthorized — stats updates require room-host bearer, owner bearer, or admin token'
        }, {
          ...RESPONSE_OPTIONS,
          status: 403,
          headers: {
            'WWW-Authenticate': 'Bearer realm="player-stats"'
          }
        });
      }

      // ===== AUTHORITATIVE VOTE COUNTS (P1 #2 fix) =====
      // For room games, override client-supplied mvpVoteCount / burdenVoteCount
      // with the server's actual stored counts from an active vote window.
      // Even an authenticated host shouldn't be able to inflate vote totals —
      // auth proves identity, not truth-of-claim. For LOCAL games there's no
      // shared store, so client values are the only source — accepted (LOCAL
      // stats only update the client's own profile via owner-Bearer, so the
      // worst case is self-spam).
      if (_room) {
        if (_targetRoomPlayer && _targetRoomPlayer.id !== undefined) {
          const voteStore = publicVoteStoreForRoom(_room);
          const mvpMap = voteStore.mvp || {};
          const burdenMap = voteStore.burden || {};
          gameResult.mvpVoteCount = normalizeProfileVoteCount(mvpMap[_targetRoomPlayer.id]);
          gameResult.burdenVoteCount = normalizeProfileVoteCount(burdenMap[_targetRoomPlayer.id]);
        } else {
          // Defensive (LOW finding from review 2026-05-03): if room metadata is
          // malformed and targetPlayer.id can't be resolved, force authoritative
          // values to 0 rather than leaving client values to flow through. The
          // host-Bearer path already passed (target handle was in players[]),
          // but a missing/undefined id means we can't index the vote map, so
          // refusing to inherit anything is the safest behavior.
          gameResult.mvpVoteCount = 0;
          gameResult.burdenVoteCount = 0;
        }
      }

      // Defense in depth: even with the gate above, snapshot security-sensitive
      // fields BEFORE any mutation so the stats path cannot mutate
      // `ownershipTokenHash` or `id` even if `gameResult` smuggled in matching
      // keys via a future code path. Restore the snapshot before save.
      const _frozenOwnershipHash = player.ownershipTokenHash;
      const _frozenId = player.id;

      // Run migration if needed (once per player)
      const migrated = migrateToModeStats(player);
      if (migrated) {
        console.log(`✅ Migrated @${player.handle} to mode-specific stats`);
      }

      // Update stats - now receiving SESSION stats (multiple rounds)
      const gamesInSession = gameResult.gamesInSession || 1;
      const currentHonorTitles = new Set(CURRENT_HONOR_TITLES);
      const votingHistoryKey = deriveVoteProfileHistoryKey(
        gameResult.roomCode,
        _room,
        player.stats.votingHistory || {},
        gameResult.voteSessionKey
      );
      const gameSessionHistoryKey = deriveGameProfileHistoryKey(
        gameResult.roomCode,
        _room,
        gameResult.gameSessionKey || gameResult.voteSessionKey
      );

      // Check if this is vote-only update
      const isVoteOnly = gameResult.mode === 'VOTE_ONLY';
      const authoritativeTeamWon = isVoteOnly
        ? null
        : resolveRoomPlayerTeamWon(_room, _targetRoomPlayer);
      if (authoritativeTeamWon !== null) {
        gameResult.teamWon = authoritativeTeamWon;
      }
      
      if (!isVoteOnly) {
        player.stats.sessionHistory = normalizeRecordMap(player.stats.sessionHistory);
        const duplicateSessionIgnored =
          gameSessionHistoryKey &&
          Object.prototype.hasOwnProperty.call(player.stats.sessionHistory, gameSessionHistoryKey);
        if (duplicateSessionIgnored) {
          applyProfileVoteStats(player.stats, votingHistoryKey, gameResult);
          player.lastActiveAt = new Date().toISOString();

          // Restore the snapshotted security-sensitive fields. The stats path
          // shouldn't be able to overwrite these even by accident.
          if (_frozenOwnershipHash !== undefined) player.ownershipTokenHash = _frozenOwnershipHash;
          if (_frozenId !== undefined) player.id = _frozenId;

          await kv.set(`player:${handle}`, JSON.stringify(player));

          return jsonResponse({
            success: true,
            updatedStats: player.stats,
            newAchievements: [],
            duplicateSessionIgnored: true
          }, RESPONSE_OPTIONS);
        }

        // ===== UPDATE OVERALL STATS =====
        // Snapshot the OLD count BEFORE incrementing — running averages must use N_old.
        // Previously: prevSessionTotal multiplied by (sessionsPlayed - 1) AFTER increment,
        // which is mathematically `N_new - 1 = N_old`, but only by accident on first session
        // (because `|| 1` masked N_old=0). On subsequent sessions, the new ranking was
        // double-counted in the running average.
        const prevSessionsPlayed = player.stats.sessionsPlayed || 0;

        player.stats.sessionsPlayed = prevSessionsPlayed + 1;
        if (gameResult.teamWon) {
          player.stats.sessionsWon = (player.stats.sessionsWon || 0) + 1;
        }
        player.stats.sessionWinRate = player.stats.sessionsPlayed > 0
          ? player.stats.sessionsWon / player.stats.sessionsPlayed
          : 0;

        // Running average using N_old (snapshotted above)
        const prevSessionTotal = (player.stats.avgRankingPerSession || 0) * prevSessionsPlayed;
        player.stats.avgRankingPerSession = (prevSessionTotal + gameResult.ranking) / player.stats.sessionsPlayed;

        const prevRoundsTotal = (player.stats.avgRoundsPerSession || 0) * prevSessionsPlayed;
        player.stats.avgRoundsPerSession = (prevRoundsTotal + gamesInSession) / player.stats.sessionsPlayed;
        
        // Update longest session by rounds
        if (gamesInSession > (player.stats.longestSessionRounds || 0)) {
          player.stats.longestSessionRounds = gamesInSession;
        }
        
        // Round-level stats (weighted by actual rounds)
        player.stats.roundsPlayed = (player.stats.roundsPlayed || 0) + gamesInSession;
        const prevRoundTotal = (player.stats.avgRankingPerRound || 0) * ((player.stats.roundsPlayed || gamesInSession) - gamesInSession);
        player.stats.avgRankingPerRound = (prevRoundTotal + (gameResult.ranking * gamesInSession)) / player.stats.roundsPlayed;
        
        // Time tracking
        const sessionDuration = gameResult.sessionDuration || 0;
        if (sessionDuration > 0) {
          player.stats.totalPlayTimeSeconds = (player.stats.totalPlayTimeSeconds || 0) + sessionDuration;
          
          if (sessionDuration > (player.stats.longestSessionSeconds || 0)) {
            player.stats.longestSessionSeconds = sessionDuration;
          }
          
          player.stats.avgSessionSeconds = player.stats.totalPlayTimeSeconds / player.stats.sessionsPlayed;
        }
        
        // Legacy fields (for backward compatibility)
        player.stats.gamesPlayed = player.stats.sessionsPlayed;
        player.stats.wins = player.stats.sessionsWon;
        player.stats.winRate = player.stats.sessionWinRate;
        player.stats.avgRanking = player.stats.avgRankingPerSession;

        // Update recent rankings - add relative position within session
        player.stats.recentRankings = player.stats.recentRankings || [];
        player.stats.recentRankings.unshift(gameResult.relativeRank || Math.round(gameResult.ranking));
        if (player.stats.recentRankings.length > 10) {
          player.stats.recentRankings = player.stats.recentRankings.slice(0, 10);
        }

        // Update honors (from session calculation)
        if (gameResult.honorsEarned && Array.isArray(gameResult.honorsEarned)) {
          gameResult.honorsEarned.forEach(honor => {
            if (currentHonorTitles.has(honor)) {
              player.stats.honors[honor] = (player.stats.honors[honor] || 0) + 1;
            }
          });
        }

        // Update community voting stats (idempotent with votingHistory)
        applyProfileVoteStats(player.stats, votingHistoryKey, gameResult);

        // Update partner/opponent tracking
        player.stats.partners = normalizeRecordMap(player.stats.partners);
        player.stats.opponents = normalizeRecordMap(player.stats.opponents);

        // Track teammates
        if (gameResult.teammates && Array.isArray(gameResult.teammates)) {
          gameResult.teammates.forEach(teammateHandle => {
            if (!player.stats.partners[teammateHandle]) {
              player.stats.partners[teammateHandle] = { games: 0, wins: 0, winRate: 0 };
            }
            player.stats.partners[teammateHandle].games += 1;
            if (gameResult.teamWon) {
              player.stats.partners[teammateHandle].wins += 1;
            }
            player.stats.partners[teammateHandle].winRate = 
              player.stats.partners[teammateHandle].wins / player.stats.partners[teammateHandle].games;
          });
        }

        // Track opponents
        if (gameResult.opponents && Array.isArray(gameResult.opponents)) {
          gameResult.opponents.forEach(opponentHandle => {
            if (!player.stats.opponents[opponentHandle]) {
              player.stats.opponents[opponentHandle] = { games: 0, wins: 0, winRate: 0 };
            }
            player.stats.opponents[opponentHandle].games += 1;
            if (gameResult.teamWon) {
              player.stats.opponents[opponentHandle].wins += 1;
            }
            player.stats.opponents[opponentHandle].winRate = 
              player.stats.opponents[opponentHandle].wins / player.stats.opponents[opponentHandle].games;
          });
        }

        // Update win/loss streaks (session counts as 1)
        // Defensive `|| 0` guards against legacy players where a NaN/undefined could
        // poison the field permanently (NaN + 1 = NaN forever after).
        if (gameResult.teamWon) {
          player.stats.currentWinStreak = (player.stats.currentWinStreak || 0) + 1;
          player.stats.currentLossStreak = 0;
          if (player.stats.currentWinStreak > (player.stats.longestWinStreak || 0)) {
            player.stats.longestWinStreak = player.stats.currentWinStreak;
          }
        } else {
          player.stats.currentLossStreak = (player.stats.currentLossStreak || 0) + 1;
          player.stats.currentWinStreak = 0;
          if (player.stats.currentLossStreak > (player.stats.longestLossStreak || 0)) {
            player.stats.longestLossStreak = player.stats.currentLossStreak;
          }
        }

        // Add to recent games (keep last 20)
        player.recentGames = player.recentGames || [];
        player.recentGames.unshift({
          roomCode: gameResult.roomCode,
          date: new Date().toISOString(),
          sessionKey: gameSessionHistoryKey || undefined,
          mode: gameResult.mode,
          ranking: Math.round(gameResult.ranking * 10) / 10,  // Session average
          team: gameResult.team,
          teamWon: gameResult.teamWon,
          rounds: gamesInSession,  // How many rounds in this session
          duration: sessionDuration,  // Session duration in seconds
          firstPlaces: gameResult.firstPlaces || 0,
          lastPlaces: gameResult.lastPlaces || 0,
          honorsEarned: gameResult.honorsEarned || []
        });
        if (player.recentGames.length > 20) {
          player.recentGames = player.recentGames.slice(0, 20);
        }

        // Update lastActiveAt
        player.lastActiveAt = new Date().toISOString();

        if (gameSessionHistoryKey) {
          player.stats.sessionHistory[gameSessionHistoryKey] = {
            roomCode: gameResult.roomCode,
            mode: gameResult.mode,
            team: gameResult.team,
            teamWon: !!gameResult.teamWon,
            ranking: Math.round(gameResult.ranking * 10) / 10,
            rounds: gamesInSession,
            recordedAt: player.lastActiveAt
          };
        }

        // Check for new achievements
        const oldAchievements = player.achievements;
        const newAchievements = checkAchievements(player.stats, gameResult);
        player.achievements = newAchievements;
        const unlockedAchievements = getNewAchievements(oldAchievements, newAchievements);

        // ===== UPDATE MODE-SPECIFIC STATS =====
        const gameMode = gameResult.mode; // '4P', '6P', '8P'
        if (gameMode && player.stats[`stats${gameMode}`]) {
          const modeStats = player.stats[`stats${gameMode}`];

          // Snapshot OLD count before increment — same fix as overall stats above
          const mPrevSessionsPlayed = modeStats.sessionsPlayed || 0;

          modeStats.sessionsPlayed = mPrevSessionsPlayed + 1;
          if (gameResult.teamWon) {
            modeStats.sessionsWon = (modeStats.sessionsWon || 0) + 1;
          }
          modeStats.sessionWinRate = modeStats.sessionsPlayed > 0
            ? modeStats.sessionsWon / modeStats.sessionsPlayed
            : 0;

          // Running averages using N_old
          const mPrevSessionTotal = (modeStats.avgRankingPerSession || 0) * mPrevSessionsPlayed;
          modeStats.avgRankingPerSession = (mPrevSessionTotal + gameResult.ranking) / modeStats.sessionsPlayed;

          const mPrevRoundsTotal = (modeStats.avgRoundsPerSession || 0) * mPrevSessionsPlayed;
          modeStats.avgRoundsPerSession = (mPrevRoundsTotal + gamesInSession) / modeStats.sessionsPlayed;
          
          // Update longest session by rounds
          if (gamesInSession > (modeStats.longestSessionRounds || 0)) {
            modeStats.longestSessionRounds = gamesInSession;
          }
          
          // Round-level stats
          modeStats.roundsPlayed = (modeStats.roundsPlayed || 0) + gamesInSession;
          const mPrevRoundTotal = (modeStats.avgRankingPerRound || 0) * ((modeStats.roundsPlayed || gamesInSession) - gamesInSession);
          modeStats.avgRankingPerRound = (mPrevRoundTotal + (gameResult.ranking * gamesInSession)) / modeStats.roundsPlayed;
          
          // Time tracking
          const sessionDuration = gameResult.sessionDuration || 0;
          if (sessionDuration > 0) {
            modeStats.totalPlayTimeSeconds = (modeStats.totalPlayTimeSeconds || 0) + sessionDuration;
            
            if (sessionDuration > (modeStats.longestSessionSeconds || 0)) {
              modeStats.longestSessionSeconds = sessionDuration;
            }
            
            modeStats.avgSessionSeconds = modeStats.totalPlayTimeSeconds / modeStats.sessionsPlayed;
          }
          
          // Update mode breakdown counter
          player.stats.modeBreakdown = player.stats.modeBreakdown || { '4P': 0, '6P': 0, '8P': 0 };
          player.stats.modeBreakdown[gameMode] = (player.stats.modeBreakdown[gameMode] || 0) + 1;
          
          // Add to mode-specific recent rankings
          modeStats.recentRankings = modeStats.recentRankings || [];
          modeStats.recentRankings.unshift(gameResult.relativeRank || Math.round(gameResult.ranking));
          if (modeStats.recentRankings.length > 10) {
            modeStats.recentRankings = modeStats.recentRankings.slice(0, 10);
          }
          
          // Update streaks for this mode
          if (gameResult.teamWon) {
            modeStats.currentWinStreak = (modeStats.currentWinStreak || 0) + 1;
            modeStats.currentLossStreak = 0;
            if (modeStats.currentWinStreak > (modeStats.longestWinStreak || 0)) {
              modeStats.longestWinStreak = modeStats.currentWinStreak;
            }
          } else {
            modeStats.currentLossStreak = (modeStats.currentLossStreak || 0) + 1;
            modeStats.currentWinStreak = 0;
            if (modeStats.currentLossStreak > (modeStats.longestLossStreak || 0)) {
              modeStats.longestLossStreak = modeStats.currentLossStreak;
            }
          }
        }

        // Restore the snapshotted security-sensitive fields. The stats path
        // shouldn't be able to overwrite these even by accident.
        if (_frozenOwnershipHash !== undefined) player.ownershipTokenHash = _frozenOwnershipHash;
        if (_frozenId !== undefined) player.id = _frozenId;

        // Save updated player
        await kv.set(`player:${handle}`, JSON.stringify(player));

        return jsonResponse({
          success: true,
          updatedStats: player.stats,
          newAchievements: unlockedAchievements  // Return newly unlocked achievements
        }, RESPONSE_OPTIONS);
      } else {
        // Vote-only mode: only update voting stats (idempotent with votingHistory)
        applyProfileVoteStats(player.stats, votingHistoryKey, gameResult);

        // Restore the snapshotted security-sensitive fields (see stats path above)
        if (_frozenOwnershipHash !== undefined) player.ownershipTokenHash = _frozenOwnershipHash;
        if (_frozenId !== undefined) player.id = _frozenId;

        // Save updated player
        await kv.set(`player:${handle}`, JSON.stringify(player));

        return jsonResponse({
          success: true,
          updatedStats: player.stats,
          newAchievements: []  // No new achievements in vote-only mode
        }, RESPONSE_OPTIONS);
      }
    }

  } catch (error) {
    console.error('Failed to get player:', error);
    return jsonResponse({
      error: 'Internal server error'
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

// Handle CORS preflight requests
export const config = {
  runtime: 'edge'
};
