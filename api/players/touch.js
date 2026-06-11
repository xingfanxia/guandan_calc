// Update player lastActiveAt timestamp - Vercel Edge Function
// Called when a player is added to a game

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import { applyStorageHandle, parsePlayerRecord, validateHandle } from './_utils.js';

const RESPONSE_OPTIONS = { methods: 'POST, OPTIONS' };

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'POST, OPTIONS');
  if (preflight) return preflight;

  // Only allow POST requests
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    // Parse request body
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return jsonResponse({ error: parsedBody.error }, { ...RESPONSE_OPTIONS, status: 400 });
    }
    const { handle } = parsedBody.data;

    if (!handle) {
      return jsonResponse({
        error: 'Missing handle'
      }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    if (!validateHandle(handle)) {
      return jsonResponse({
        error: 'Invalid handle format'
      }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    // Get player data
    const playerData = await kv.get(`player:${handle.toLowerCase()}`);

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
    applyStorageHandle(player, handle);

    // Update lastActiveAt
    player.lastActiveAt = new Date().toISOString();

    // Save back to KV
    await kv.set(`player:${handle.toLowerCase()}`, JSON.stringify(player));

    return jsonResponse({
      success: true,
      lastActiveAt: player.lastActiveAt
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('Failed to update lastActiveAt:', error);
    return jsonResponse({
      error: 'Internal server error'
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

// Handle CORS preflight requests
export const config = {
  runtime: 'edge'
};
