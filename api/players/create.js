// Create new player profile - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import {
  generatePlayerId,
  validatePlayerData,
  initializePlayerStats,
  generateOwnershipToken,
  hashToken,
  sanitizePlayer
} from './_utils.js';

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
    const playerData = parsedBody.data;

    // Validate player data
    const validation = validatePlayerData(playerData);
    if (!validation.valid) {
      return jsonResponse({
        error: validation.error
      }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    // Normalize handle to lowercase
    const handle = playerData.handle.toLowerCase();

    // Check if handle already exists
    const existing = await kv.get(`player:${handle}`);
    if (existing) {
      return jsonResponse({
        error: 'Handle already exists. Please choose a different handle.'
      }, { ...RESPONSE_OPTIONS, status: 409 });
    }

    // Generate unique player ID
    let playerId;
    let idAttempts = 0;
    let playerIdAvailable = false;
    do {
      playerId = generatePlayerId();
      idAttempts++;

      // Check if ID already exists (very unlikely but check anyway)
      const existingId = await kv.get(`player_id:${playerId}`);
      if (!existingId) {
        playerIdAvailable = true;
        break;
      }
    } while (idAttempts < 10);

    if (!playerIdAvailable) {
      return jsonResponse({
        error: 'Failed to generate unique player ID'
      }, { ...RESPONSE_OPTIONS, status: 500 });
    }

    // Issue per-user ownership token. Raw token is returned ONCE in this response;
    // only the hash is persisted, so a KV read can't recover usable tokens.
    const ownershipToken = generateOwnershipToken();
    const ownershipTokenHash = await hashToken(ownershipToken);

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
      ownershipTokenHash,
      stats: initializePlayerStats(),
      recentGames: [],
      achievements: []  // Array of achievement IDs
    };

    // Store player data (no TTL - permanent)
    await kv.set(`player:${handle}`, JSON.stringify(player));

    // Store reverse lookup: ID -> handle
    await kv.set(`player_id:${playerId}`, handle);

    // Return created player + raw token (shown once, client persists to localStorage)
    return jsonResponse({
      success: true,
      player: sanitizePlayer(player),
      ownershipToken
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('Failed to create player:', error);
    return jsonResponse({
      error: 'Internal server error'
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

// Handle CORS preflight requests
export const config = {
  runtime: 'edge'
};
