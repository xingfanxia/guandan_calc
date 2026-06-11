// Manual Migration Endpoint - Migrate all players to mode-specific stats
// Run this once to migrate existing players without waiting for next game

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import { initializePlayerStats, normalizeRecordMap, parsePlayerRecord, validateAdminToken } from './_utils.js';
import { applyLegacyRecentGamesToModeStats } from './_modeMigration.js';
import { normalizeHonorCounter } from '../../shared/honorCatalog.js';

const RESPONSE_OPTIONS = { methods: 'POST, OPTIONS' };

// Migrate single player's historical games to mode-specific stats
function migratePlayerToModeStats(player) {
  const honorsBefore = JSON.stringify(player.stats?.honors || null);

  if (!player.stats || typeof player.stats !== 'object') {
    player.stats = initializePlayerStats();
    return {
      migrated: true,
      gamesProcessed: 0,
      breakdown: player.stats.modeBreakdown,
      reason: 'initialized_missing_stats'
    };
  }

  player.stats.honors = normalizeHonorCounter(player.stats.honors);
  const normalizedSessionHistory = normalizeRecordMap(player.stats.sessionHistory);
  const sessionHistoryChanged = normalizedSessionHistory !== player.stats.sessionHistory;
  player.stats.sessionHistory = normalizedSessionHistory;
  const honorsChanged = honorsBefore !== JSON.stringify(player.stats.honors);

  // Check if already migrated
  if (player.stats.stats4P && player.stats.stats4P.sessionsPlayed !== undefined) {
    if (honorsChanged || sessionHistoryChanged) {
      return {
        migrated: true,
        gamesProcessed: 0,
        breakdown: player.stats.modeBreakdown,
        reason: honorsChanged ? 'normalized_honors' : 'normalized_session_history'
      };
    }
    return { migrated: false, reason: 'already_migrated' };
  }

  // Initialize mode-specific stats
  const freshStats = initializePlayerStats();
  player.stats.stats4P = { ...freshStats.stats4P };
  player.stats.stats6P = { ...freshStats.stats6P };
  player.stats.stats8P = { ...freshStats.stats8P };
  player.stats.modeBreakdown = { '4P': 0, '6P': 0, '8P': 0 };

  let migratedGames = 0;

  // Replay recent games to populate mode stats
  if (player.recentGames && Array.isArray(player.recentGames)) {
    migratedGames = applyLegacyRecentGamesToModeStats(player);
  }

  return {
    migrated: true,
    gamesProcessed: migratedGames,
    breakdown: player.stats.modeBreakdown
  };
}

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'POST, OPTIONS');
  if (preflight) return preflight;

  // Only allow POST requests
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    // Admin auth — previously this endpoint was PUBLIC, allowing anyone to trigger
    // a mass-rewrite of every player profile in KV (DoS + data corruption risk).
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return jsonResponse({ error: parsedBody.error }, { ...RESPONSE_OPTIONS, status: 400 });
    }
    if (!validateAdminToken(parsedBody.data.adminToken)) {
      return jsonResponse({
        error: 'Unauthorized - Invalid admin token'
      }, { ...RESPONSE_OPTIONS, status: 403 });
    }

    // Get all player keys
    const keys = [];
    let cursor = 0;

    do {
      const result = await kv.scan(cursor, { match: 'player:*', count: 100 });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0);

    console.log(`Found ${keys.length} players to check for migration`);

    const results = {
      totalPlayers: keys.length,
      migrated: 0,
      alreadyMigrated: 0,
      failed: 0,
      details: []
    };

    // Process each player
    for (const key of keys) {
      try {
        const playerData = await kv.get(key);
        if (!playerData) continue;

        const player = parsePlayerRecord(playerData);
        if (!player) {
          results.failed++;
          results.details.push({
            handle: key.replace(/^player:/, ''),
            status: 'failed',
            reason: 'invalid_player_record'
          });
          continue;
        }

        const migrationResult = migratePlayerToModeStats(player);

        if (migrationResult.migrated) {
          // Save migrated player
          await kv.set(key, JSON.stringify(player));
          results.migrated++;
          results.details.push({
            handle: player.handle,
            status: 'migrated',
            games: migrationResult.gamesProcessed,
            breakdown: migrationResult.breakdown
          });
          console.log(`✅ Migrated @${player.handle}: ${migrationResult.gamesProcessed} games`);
        } else {
          results.alreadyMigrated++;
          results.details.push({
            handle: player.handle,
            status: 'skipped',
            reason: migrationResult.reason
          });
        }
      } catch (error) {
        console.error(`Failed to migrate player ${key}:`, error);
        results.failed++;
      }
    }

    return jsonResponse({
      success: true,
      message: `Migration complete: ${results.migrated} migrated, ${results.alreadyMigrated} already done`,
      ...results
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('Migration failed:', error);
    return jsonResponse({
      error: 'Migration failed',
      details: error.message
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge',
  maxDuration: 60 // Allow up to 60 seconds for large migrations
};
