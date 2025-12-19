// Single Player Migration - Faster, no timeout
// POST /api/players/migrate-single with { handle: "fufu" }

import { kv } from '@vercel/kv';
import { initializePlayerStats } from './_utils.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { handle } = await request.json();

    if (!handle) {
      return new Response(JSON.stringify({ error: 'Missing handle' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get player
    const playerData = await kv.get(`player:${handle.toLowerCase()}`);
    if (!playerData) {
      return new Response(JSON.stringify({ error: 'Player not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;

    // Check if already migrated
    if (player.stats.stats4P && player.stats.stats4P.sessionsPlayed !== undefined) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Already migrated',
        breakdown: player.stats.modeBreakdown
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Initialize mode stats
    const freshStats = initializePlayerStats();
    player.stats.stats4P = { ...freshStats.stats4P };
    player.stats.stats6P = { ...freshStats.stats6P };
    player.stats.stats8P = { ...freshStats.stats8P };
    player.stats.modeBreakdown = { '4P': 0, '6P': 0, '8P': 0 };

    let migratedGames = 0;

    // Process recent games
    if (player.recentGames && Array.isArray(player.recentGames)) {
      player.recentGames.forEach(game => {
        const mode = game.mode;
        if (!mode) return;

        const modeStats = player.stats[`stats${mode}`];
        if (!modeStats) return;

        migratedGames++;
        modeStats.sessionsPlayed++;
        if (game.teamWon) modeStats.sessionsWon++;

        modeStats.sessionWinRate = modeStats.sessionsWon / modeStats.sessionsPlayed;

        const prevTotal = modeStats.avgRankingPerSession * (modeStats.sessionsPlayed - 1);
        modeStats.avgRankingPerSession = (prevTotal + game.ranking) / modeStats.sessionsPlayed;

        if (game.rounds) {
          modeStats.roundsPlayed += game.rounds;
          const prevRoundsTotal = modeStats.avgRoundsPerSession * (modeStats.sessionsPlayed - 1);
          modeStats.avgRoundsPerSession = (prevRoundsTotal + game.rounds) / modeStats.sessionsPlayed;

          if (game.rounds > modeStats.longestSessionRounds) {
            modeStats.longestSessionRounds = game.rounds;
          }
        }

        if (game.duration) {
          modeStats.totalPlayTimeSeconds += game.duration;
          if (game.duration > modeStats.longestSessionSeconds) {
            modeStats.longestSessionSeconds = game.duration;
          }
          modeStats.avgSessionSeconds = modeStats.totalPlayTimeSeconds / modeStats.sessionsPlayed;
        }

        modeStats.recentRankings = modeStats.recentRankings || [];
        modeStats.recentRankings.push(game.relativeRank || Math.round(game.ranking));
        if (modeStats.recentRankings.length > 10) {
          modeStats.recentRankings = modeStats.recentRankings.slice(-10);
        }

        player.stats.modeBreakdown[mode]++;
      });
    }

    // Save
    await kv.set(`player:${handle.toLowerCase()}`, JSON.stringify(player));

    return new Response(JSON.stringify({
      success: true,
      handle,
      migratedGames,
      breakdown: player.stats.modeBreakdown
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  runtime: 'edge'
};
