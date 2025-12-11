// Delete player profile - Vercel Edge Function
// Use with caution - permanent deletion

import { kv } from '@vercel/kv';

export default async function handler(request) {
  // Only allow POST requests (safer than DELETE)
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { handle, adminToken } = await request.json();

    if (!handle) {
      return new Response(JSON.stringify({
        error: 'Missing handle'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Require admin token for deletion
    if (adminToken !== 'xiaofei0214') {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Invalid admin token'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const normalizedHandle = handle.toLowerCase();

    // Get player to find ID
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

    // Delete player data
    await kv.del(`player:${normalizedHandle}`);

    // Delete reverse lookup
    if (player.id) {
      await kv.del(`player_id:${player.id}`);
    }

    return new Response(JSON.stringify({
      success: true,
      deletedPlayer: player.handle
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
    console.error('Failed to delete player:', error);
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
