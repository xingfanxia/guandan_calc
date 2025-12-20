// Backfill game duration from room timestamps
// GET /api/players/backfill-duration?handle=xxx

import { kv } from '@vercel/kv';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const handle = url.searchParams.get('handle');

    if (!handle) {
      return new Response(JSON.stringify({ error: 'Missing handle parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get player
    const playerData = await kv.get(`player:${handle.toLowerCase()}`);
    if (!playerData) {
      return new Response(JSON.stringify({ error: 'Player not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;

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

          const room = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;

          // Calculate duration from timestamps
          if (room.createdAt && room.finishedAt) {
            const duration = Math.floor(
              (new Date(room.finishedAt).getTime() - new Date(room.createdAt).getTime()) / 1000
            );

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

    return new Response(JSON.stringify({
      success: true,
      handle,
      updated,
      failed,
      results
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({
      error: 'Backfill failed',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  runtime: 'edge',
  maxDuration: 30
};
