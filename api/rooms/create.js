// Create new game room - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';

// Cryptographically random room code (6 alphanumeric)
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

// Cryptographically random host auth token (32 bytes hex = 64 chars)
function generateAuthToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const gameData = await request.json();

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
      const existing = await kv.get(`room:${roomCode}`);
      if (!existing) break;
    } while (attempts < 10);

    if (attempts >= 10) {
      return new Response(JSON.stringify({
        error: 'Failed to generate unique room code'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Server-side host auth token. Stored in KV; required on all PUTs.
    // Returned to creator ONCE in this response — never exposed via GET.
    const authToken = generateAuthToken();

    const roomData = {
      ...gameData,
      roomCode,
      authToken,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version: 'v9.0'
    };

    // 1 year TTL (favorite-aware updates extend permanently)
    await kv.setex(`room:${roomCode}`, 31536000, JSON.stringify(roomData));

    // Add to rooms index for browsing (best-effort — non-critical)
    try {
      const roomsIndexKey = 'rooms:index';
      let roomsIndex = await kv.get(roomsIndexKey) || [];
      if (!Array.isArray(roomsIndex)) roomsIndex = [];
      roomsIndex.unshift({ roomCode, createdAt: roomData.createdAt });
      if (roomsIndex.length > 100) roomsIndex = roomsIndex.slice(0, 100);
      await kv.set(roomsIndexKey, roomsIndex);
    } catch (indexError) {
      console.error('Failed to update rooms index:', indexError);
    }

    return new Response(JSON.stringify({
      success: true,
      roomCode,
      authToken,           // host must persist — not retrievable later
      expiresIn: 31536000  // 1 year
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

export const config = {
  runtime: 'edge'
};
