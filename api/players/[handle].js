// Get player profile - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { validateHandle } from './_utils.js';

export default async function handler(request) {
  // Only allow GET and PUT requests
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Extract handle from URL
    const url = new URL(request.url);
    const handle = url.pathname.split('/').pop().toLowerCase();

    // Validate handle format
    if (!validateHandle(handle)) {
      return new Response(JSON.stringify({
        error: 'Invalid handle format'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'GET') {
      // Get player data from KV
      const playerData = await kv.get(`player:${handle}`);

      if (!playerData) {
        return new Response(JSON.stringify({
          error: 'Player not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Parse player data (might be string or object)
      const player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;

      // Return full player profile
      return new Response(JSON.stringify({
        success: true,
        player: player
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });

    } else if (request.method === 'PUT') {
      // Update player stats after game
      const gameResult = await request.json();

      // Validate required fields
      if (!gameResult.roomCode || gameResult.ranking === undefined || !gameResult.team) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: roomCode, ranking, team'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get existing player data
      const playerData = await kv.get(`player:${handle}`);
      if (!playerData) {
        return new Response(JSON.stringify({
          error: 'Player not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;

      // Update stats - now receiving SESSION stats (multiple rounds)
      const gamesInSession = gameResult.gamesInSession || 1;
      
      // Session-level stats
      player.stats.sessionsPlayed = (player.stats.sessionsPlayed || 0) + 1;
      if (gameResult.teamWon) {
        player.stats.sessionsWon = (player.stats.sessionsWon || 0) + 1;
      }
      player.stats.sessionWinRate = player.stats.sessionsPlayed > 0
        ? player.stats.sessionsWon / player.stats.sessionsPlayed
        : 0;
      
      // Update avgRankingPerSession (average of session averages)
      const prevSessionTotal = (player.stats.avgRankingPerSession || 0) * ((player.stats.sessionsPlayed || 1) - 1);
      player.stats.avgRankingPerSession = (prevSessionTotal + gameResult.ranking) / player.stats.sessionsPlayed;
      
      // Update avgRoundsPerSession
      const prevRoundsTotal = (player.stats.avgRoundsPerSession || 0) * ((player.stats.sessionsPlayed || 1) - 1);
      player.stats.avgRoundsPerSession = (prevRoundsTotal + gamesInSession) / player.stats.sessionsPlayed;
      
      // Round-level stats (weighted by actual rounds)
      player.stats.roundsPlayed = (player.stats.roundsPlayed || 0) + gamesInSession;
      const prevRoundTotal = (player.stats.avgRankingPerRound || 0) * ((player.stats.roundsPlayed || gamesInSession) - gamesInSession);
      player.stats.avgRankingPerRound = (prevRoundTotal + (gameResult.ranking * gamesInSession)) / player.stats.roundsPlayed;
      
      // Legacy fields (for backward compatibility)
      player.stats.gamesPlayed = player.stats.sessionsPlayed;
      player.stats.wins = player.stats.sessionsWon;
      player.stats.winRate = player.stats.sessionWinRate;
      player.stats.avgRanking = player.stats.avgRankingPerSession;

      // Update recent rankings - add session average as one entry
      player.stats.recentRankings = player.stats.recentRankings || [];
      player.stats.recentRankings.unshift(Math.round(gameResult.ranking));
      if (player.stats.recentRankings.length > 10) {
        player.stats.recentRankings = player.stats.recentRankings.slice(0, 10);
      }

      // Update honors (from session calculation)
      if (gameResult.honorsEarned && Array.isArray(gameResult.honorsEarned)) {
        gameResult.honorsEarned.forEach(honor => {
          if (player.stats.honors[honor] !== undefined) {
            player.stats.honors[honor] = (player.stats.honors[honor] || 0) + 1;
          }
        });
      }

      // Update win/loss streaks (session counts as 1)
      if (gameResult.teamWon) {
        player.stats.currentWinStreak += 1;
        player.stats.currentLossStreak = 0;
        if (player.stats.currentWinStreak > player.stats.longestWinStreak) {
          player.stats.longestWinStreak = player.stats.currentWinStreak;
        }
      } else {
        player.stats.currentLossStreak += 1;
        player.stats.currentWinStreak = 0;
        if (player.stats.currentLossStreak > player.stats.longestLossStreak) {
          player.stats.longestLossStreak = player.stats.currentLossStreak;
        }
      }

      // Add to recent games (keep last 20)
      player.recentGames = player.recentGames || [];
      player.recentGames.unshift({
        roomCode: gameResult.roomCode,
        date: new Date().toISOString(),
        mode: gameResult.mode || '8P',
        ranking: Math.round(gameResult.ranking * 10) / 10,  // Session average
        team: gameResult.team,
        teamWon: gameResult.teamWon,
        rounds: gamesInSession,  // How many rounds in this session
        firstPlaces: gameResult.firstPlaces || 0,
        lastPlaces: gameResult.lastPlaces || 0,
        honorsEarned: gameResult.honorsEarned || []
      });
      if (player.recentGames.length > 20) {
        player.recentGames = player.recentGames.slice(0, 20);
      }

      // Update lastActiveAt
      player.lastActiveAt = new Date().toISOString();

      // Save updated player
      await kv.set(`player:${handle}`, JSON.stringify(player));

      return new Response(JSON.stringify({
        success: true,
        updatedStats: player.stats
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

  } catch (error) {
    console.error('Failed to get player:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle CORS preflight requests
export const config = {
  runtime: 'edge'
};
