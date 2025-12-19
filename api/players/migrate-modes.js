// Manual Migration Endpoint - Migrate all players to mode-specific stats
// Run this once to migrate existing players without waiting for next game

import { kv } from '@vercel/kv';
import { initializePlayerStats } from './_utils.js';

// Migrate single player's historical games to mode-specific stats
function migratePlayerToModeStats(player) {
  // Check if already migrated
  if (player.stats.stats4P && player.stats.stats4P.sessionsPlayed !== undefined) {
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
    player.recentGames.forEach(game => {
      const mode = game.mode;
      if (!mode) return;

      const modeStats = player.stats[`stats${mode}`];
      if (!modeStats) return;

      migratedGames++;

      // Increment session counter
      modeStats.sessionsPlayed++;
      if (game.teamWon) modeStats.sessionsWon++;

      // Update win rate
      modeStats.sessionWinRate = modeStats.sessionsWon / modeStats.sessionsPlayed;

      // Update average ranking per session
      const prevTotal = modeStats.avgRankingPerSession * (modeStats.sessionsPlayed - 1);
      modeStats.avgRankingPerSession = (prevTotal + game.ranking) / modeStats.sessionsPlayed;

      // Update rounds tracking
      if (game.rounds) {
        modeStats.roundsPlayed += game.rounds;
        const prevRoundsTotal = modeStats.avgRoundsPerSession * (modeStats.sessionsPlayed - 1);
        modeStats.avgRoundsPerSession = (prevRoundsTotal + game.rounds) / modeStats.sessionsPlayed;

        if (game.rounds > modeStats.longestSessionRounds) {
          modeStats.longestSessionRounds = game.rounds;
        }
      }

      // Update time tracking
      if (game.duration) {
        modeStats.totalPlayTimeSeconds += game.duration;
        if (game.duration > modeStats.longestSessionSeconds) {
          modeStats.longestSessionSeconds = game.duration;
        }
        modeStats.avgSessionSeconds = modeStats.totalPlayTimeSeconds / modeStats.sessionsPlayed;
      }

      // Add to recent rankings (keep last 10 per mode)
      if (!modeStats.recentRankings) modeStats.recentRankings = [];
      const relativeRank = game.relativeRank || Math.round(game.ranking);
      modeStats.recentRankings.push(relativeRank);
      if (modeStats.recentRankings.length > 10) {
        modeStats.recentRankings = modeStats.recentRankings.slice(-10);
      }

      // Update mode breakdown
      player.stats.modeBreakdown[mode]++;
    });
  }

  return {
    migrated: true,
    gamesProcessed: migratedGames,
    breakdown: player.stats.modeBreakdown
  };
}

export default async function handler(request) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
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

        const player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;
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

    return new Response(JSON.stringify({
      success: true,
      message: `Migration complete: ${results.migrated} migrated, ${results.alreadyMigrated} already done`,
      ...results
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Migration failed:', error);
    return new Response(JSON.stringify({
      error: 'Migration failed',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  runtime: 'edge',
  maxDuration: 60 // Allow up to 60 seconds for large migrations
};
