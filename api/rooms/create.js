// Create new game room - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';

// Generate random room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'ROOM-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

    // Generate unique room code
    let roomCode;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      attempts++;
      
      // Check if room code already exists
      const existing = await kv.get(`room:${roomCode}`);
      if (!existing) {
        break;
      }
    } while (attempts < 10);

    if (attempts >= 10) {
      return new Response(JSON.stringify({ 
        error: 'Failed to generate unique room code' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prepare room data
    const roomData = {
      ...gameData,
      roomCode: roomCode,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version: 'v9.0'
    };

    // Store in Vercel KV with 24 hour expiration
    await kv.setex(`room:${roomCode}`, 86400, JSON.stringify(roomData));

    // Return room code
    return new Response(JSON.stringify({
      success: true,
      roomCode: roomCode,
      expiresIn: 86400 // 24 hours
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
    console.error('Failed to create room:', error);
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