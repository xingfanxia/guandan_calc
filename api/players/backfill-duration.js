// Backfill game duration from room timestamps
// POST /api/players/backfill-duration with { handle, adminToken }

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import { parsePlayerRecord, validateAdminToken, validateHandle } from './_utils.js';
import { parseRoomRecord } from '../rooms/_record.js';

const RESPONSE_OPTIONS = { methods: 'POST, OPTIONS' };

function calculateRoomDurationSeconds(createdAt, finishedAt) {
  if (typeof createdAt !== 'string' || typeof finishedAt !== 'string') {
    return null;
  }

  const createdTime = new Date(createdAt).getTime();
  const finishedTime = new Date(finishedAt).getTime();
  if (!Number.isFinite(createdTime) || !Number.isFinite(finishedTime)) {
    return null;
  }

  const duration = Math.floor((finishedTime - createdTime) / 1000);
  return duration >= 0 ? duration : null;
}

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'POST, OPTIONS');
  if (preflight) return preflight;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return jsonResponse({ error: parsedBody.error }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    const { handle, adminToken } = parsedBody.data;

    if (!validateAdminToken(adminToken)) {
      return jsonResponse({
        error: 'Unauthorized - Invalid admin token'
      }, { ...RESPONSE_OPTIONS, status: 403 });
    }

    if (!handle) {
      return jsonResponse({ error: 'Missing handle' }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    if (!validateHandle(handle)) {
      return jsonResponse({ error: 'Invalid handle format' }, { ...RESPONSE_OPTIONS, status: 400 });
    }

    // Get player
    const playerData = await kv.get(`player:${handle.toLowerCase()}`);
    if (!playerData) {
      return jsonResponse({ error: 'Player not found' }, { ...RESPONSE_OPTIONS, status: 404 });
    }

    const player = parsePlayerRecord(playerData);
    if (!player) {
      return jsonResponse({ error: 'Player not found' }, { ...RESPONSE_OPTIONS, status: 404 });
    }

    let updated = 0;
    let failed = 0;
    const results = [];

    // Process each recent game
    if (player.recentGames && Array.isArray(player.recentGames)) {
      for (const game of player.recentGames) {
        const roomCode = game.roomCode;

        // Skip LOCAL games or games that already have duration
        if (!roomCode || roomCode === 'LOCAL' || (game.duration && game.duration > 0)) {
          continue;
        }

        try {
          // Fetch room data
          const roomData = await kv.get(`room:${roomCode}`);
          if (!roomData) {
            results.push({ roomCode, status: 'room_not_found' });
            failed++;
            continue;
          }

          const room = parseRoomRecord(roomData);
          if (!room) {
            results.push({ roomCode, status: 'invalid_room_record' });
            failed++;
            continue;
          }

          // Calculate duration from timestamps
          if (room.createdAt && room.finishedAt) {
            const duration = calculateRoomDurationSeconds(room.createdAt, room.finishedAt);
            if (duration === null) {
              results.push({ roomCode, status: 'invalid_timestamps' });
              failed++;
              continue;
            }

            // Update game duration
            game.duration = duration;
            updated++;
            results.push({
              roomCode,
              status: 'updated',
              duration: duration,
              minutes: Math.floor(duration / 60)
            });
          } else {
            results.push({ roomCode, status: 'no_timestamps' });
            failed++;
          }
        } catch (error) {
          results.push({ roomCode, status: 'error', error: error.message });
          failed++;
        }
      }

      // Save updated player data
      if (updated > 0) {
        await kv.set(`player:${handle.toLowerCase()}`, JSON.stringify(player));
      }
    }

    return jsonResponse({
      success: true,
      handle,
      updated,
      failed,
      results
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('Backfill error:', error);
    return jsonResponse({
      error: 'Backfill failed',
      details: error.message
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge',
  maxDuration: 30
};
