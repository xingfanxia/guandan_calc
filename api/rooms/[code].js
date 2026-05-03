// Get or update game room data - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';

// Constant-time string compare to defeat token-length / prefix timing attacks
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function extractBearerToken(request) {
  const header = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export default async function handler(request) {
  const url = new URL(request.url);
  const roomCode = url.pathname.split('/').pop();

  if (!roomCode || !roomCode.match(/^[A-Z0-9]{6}$/)) {
    return new Response(JSON.stringify({
      error: 'Invalid room code format - should be 6 alphanumeric characters'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    if (request.method === 'GET') {
      const roomData = await kv.get(`room:${roomCode}`);

      if (!roomData) {
        return new Response(JSON.stringify({
          error: 'Room not found or expired'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const parsedData = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;

      // SECURITY: strip authToken from response — viewers must NEVER see it.
      // Without this, anyone with the room URL could read the host token and forge PUTs.
      const { authToken, ...publicRoomData } = parsedData;

      return new Response(JSON.stringify({
        success: true,
        data: publicRoomData
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });

    } else if (request.method === 'PUT') {
      const gameData = await request.json();

      if (!gameData.settings || !gameData.state || !gameData.players) {
        return new Response(JSON.stringify({
          error: 'Invalid game data structure'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const existingRoom = await kv.get(`room:${roomCode}`);
      if (!existingRoom) {
        return new Response(JSON.stringify({
          error: 'Room not found or expired'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const existingData = typeof existingRoom === 'string' ? JSON.parse(existingRoom) : existingRoom;
      const storedToken = existingData.authToken || null;
      const providedToken = extractBearerToken(request);

      // Auth gate:
      //   - Stored token present → strict constant-time match required.
      //   - Stored token absent (legacy room created before this fix) → TOFU:
      //     accept the first PUT's token and pin it as the host token going forward.
      //     Without this, in-flight rooms would break on rotation.
      let effectiveToken;
      if (storedToken) {
        if (!providedToken || !constantTimeEqual(providedToken, storedToken)) {
          return new Response(JSON.stringify({
            error: 'Unauthorized — only the host can update this room'
          }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'WWW-Authenticate': 'Bearer realm="room"'
            }
          });
        }
        effectiveToken = storedToken;
      } else {
        if (!providedToken) {
          return new Response(JSON.stringify({
            error: 'Unauthorized — auth token required to update room'
          }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'WWW-Authenticate': 'Bearer realm="room"'
            }
          });
        }
        effectiveToken = providedToken;
        console.log(`Room ${roomCode}: TOFU pinned host token`);
      }

      const updatedData = {
        ...gameData,
        roomCode,
        authToken: effectiveToken,  // preserve through update — never accept from client body
        lastUpdated: new Date().toISOString(),
        version: 'v9.0'
      };

      // Favorite rooms get permanent storage; otherwise 1 year TTL
      if (existingData.isFavorite) {
        await kv.set(`room:${roomCode}`, JSON.stringify(updatedData));
      } else {
        await kv.setex(`room:${roomCode}`, 31536000, JSON.stringify(updatedData));
      }

      return new Response(JSON.stringify({
        success: true,
        lastUpdated: updatedData.lastUpdated
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });

    } else {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Room API error:', error);
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
