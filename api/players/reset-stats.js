// Reset player stats - Vercel Edge Function
// Clears game history and stats but keeps profile identity

import { kv } from '@vercel/kv';
import { initializePlayerStats } from './_utils.js';

export default async function handler(request) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { handle } = await request.json();

    if (!handle) {
      return new Response(JSON.stringify({
        error: 'Missing handle'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const normalizedHandle = handle.toLowerCase();

    // Get player data
    const playerData = await kv.get(`player:${normalizedHandle}`);
    if (!playerData) {
      return new Response(JSON.stringify({
        error: 'Player not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;

    // Reset stats and game history while keeping identity
    player.stats = initializePlayerStats();
    player.recentGames = [];
    player.lastActiveAt = new Date().toISOString();

    // Save updated player
    await kv.set(`player:${normalizedHandle}`, JSON.stringify(player));

    return new Response(JSON.stringify({
      success: true,
      player: player
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Failed to reset stats:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  runtime: 'edge'
};
