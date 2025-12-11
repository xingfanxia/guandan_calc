// Create new player profile - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import {
  generatePlayerId,
  validatePlayerData,
  initializePlayerStats
} from './_utils.js';

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
    const playerData = await request.json();

    // Validate player data
    const validation = validatePlayerData(playerData);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: validation.error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Normalize handle to lowercase
    const handle = playerData.handle.toLowerCase();

    // Check if handle already exists
    const existing = await kv.get(`player:${handle}`);
    if (existing) {
      return new Response(JSON.stringify({
        error: 'Handle already exists. Please choose a different handle.'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique player ID
    let playerId;
    let idAttempts = 0;
    do {
      playerId = generatePlayerId();
      idAttempts++;

      // Check if ID already exists (very unlikely but check anyway)
      const existingId = await kv.get(`player_id:${playerId}`);
      if (!existingId) {
        break;
      }
    } while (idAttempts < 10);

    if (idAttempts >= 10) {
      return new Response(JSON.stringify({
        error: 'Failed to generate unique player ID'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create player object
    const player = {
      id: playerId,
      handle: handle,
      displayName: playerData.displayName,
      emoji: playerData.emoji,
      playStyle: playerData.playStyle,
      tagline: playerData.tagline,
      ...(playerData.photoBase64 && { photoBase64: playerData.photoBase64 }),  // Optional photo
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      stats: initializePlayerStats(),
      recentGames: [],
      achievements: []  // Array of achievement IDs
    };

    // Store player data (no TTL - permanent)
    await kv.set(`player:${handle}`, JSON.stringify(player));

    // Store reverse lookup: ID -> handle
    await kv.set(`player_id:${playerId}`, handle);

    // Return created player
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
    console.error('Failed to create player:', error);
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
