// Update player lastActiveAt timestamp - Vercel Edge Function
// Called when a player is added to a game

import { kv } from '@vercel/kv';

export default async function handler(request) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse request body
    const { handle } = await request.json();

    if (!handle) {
      return new Response(JSON.stringify({
        error: 'Missing handle'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get player data
    const playerData = await kv.get(`player:${handle.toLowerCase()}`);

    if (!playerData) {
      return new Response(JSON.stringify({
        error: 'Player not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse and update lastActiveAt
    const player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;
    player.lastActiveAt = new Date().toISOString();

    // Save back to KV
    await kv.set(`player:${handle.toLowerCase()}`, JSON.stringify(player));

    return new Response(JSON.stringify({
      success: true,
      lastActiveAt: player.lastActiveAt
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
    console.error('Failed to update lastActiveAt:', error);
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
