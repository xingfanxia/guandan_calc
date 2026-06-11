// Reset player stats - Vercel Edge Function
// Clears game history and stats but keeps profile identity

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import { initializePlayerStats, parsePlayerRecord, validateAdminToken, validateHandle, sanitizePlayer } from './_utils.js';

const RESPONSE_OPTIONS = { methods: 'POST, OPTIONS' };

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'POST, OPTIONS');
  if (preflight) return preflight;

  // Only allow POST requests
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return jsonResponse({ error: parsedBody.error }, { ...RESPONSE_OPTIONS, status: 400 });
    }
    const { handle, adminToken } = parsedBody.data;

    if (!handle) {
      return jsonResponse({
        error: 'Missing handle'
      }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    // Admin auth — token validated against ADMIN_TOKEN env var with constant-time compare
    if (!validateAdminToken(adminToken)) {
      return jsonResponse({
        error: 'Unauthorized - Invalid admin token'
      }, { ...RESPONSE_OPTIONS, status: 403 });
    }

    if (!validateHandle(handle)) {
      return jsonResponse({
        error: 'Invalid handle format'
      }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    const normalizedHandle = handle.toLowerCase();

    // Get player data
    const playerData = await kv.get(`player:${normalizedHandle}`);
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

    // Reset stats and game history while keeping identity
    player.stats = initializePlayerStats();
    player.recentGames = [];
    player.lastActiveAt = new Date().toISOString();

    // Save updated player
    await kv.set(`player:${normalizedHandle}`, JSON.stringify(player));

    return jsonResponse({
      success: true,
      player: sanitizePlayer(player)
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('Failed to reset stats:', error);
    return jsonResponse({
      error: 'Internal server error'
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge'
};
