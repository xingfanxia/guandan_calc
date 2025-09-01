// Get or update game room data - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';

export default async function handler(request) {
  const url = new URL(request.url);
  const roomCode = url.pathname.split('/').pop();

  // Validate room code format (6-digit alphanumeric)
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
      // Get room data
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
      
      return new Response(JSON.stringify({
        success: true,
        data: parsedData
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });

    } else if (request.method === 'PUT') {
      // Update room data
      const gameData = await request.json();
      
      // Validate required fields
      if (!gameData.settings || !gameData.state || !gameData.players) {
        return new Response(JSON.stringify({ 
          error: 'Invalid game data structure' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if room exists
      const existingRoom = await kv.get(`room:${roomCode}`);
      if (!existingRoom) {
        return new Response(JSON.stringify({ 
          error: 'Room not found or expired' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update room data
      const updatedData = {
        ...gameData,
        roomCode: roomCode,
        lastUpdated: new Date().toISOString(),
        version: 'v9.0'
      };

      // Store updated data without expiration (persistent)
      await kv.set(`room:${roomCode}`, JSON.stringify(updatedData));

      return new Response(JSON.stringify({
        success: true,
        lastUpdated: updatedData.lastUpdated
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
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

// Handle CORS preflight requests
export const config = {
  runtime: 'edge'
};