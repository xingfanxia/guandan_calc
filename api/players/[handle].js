// Get player profile - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { validateHandle } from './_utils.js';

export default async function handler(request) {
  // Only allow GET requests
  if (request.method !== 'GET') {
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

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
