// Create new game room - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import { addRoomIndexEntry } from './_index.js';
import {
  canonicalizeRoomSnapshotPayload,
  isValidRoomSnapshotPayload
} from '../../shared/roomSnapshotValidation.js';
import { ROOM_SCHEMA_VERSION } from '../../shared/version.js';

const RESPONSE_OPTIONS = { methods: 'POST, OPTIONS' };

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
    const gameData = canonicalizeRoomSnapshotPayload(parsedBody.data);

    if (
      !gameData.settings ||
      !gameData.state ||
      !gameData.players ||
      !isValidRoomSnapshotPayload(gameData)
    ) {
      return jsonResponse({
        error: 'Invalid game data structure'
      }, { ...RESPONSE_OPTIONS, status: 400 });
    }
    const canonicalGameData = gameData;

    // Generate unique room code
    let roomCode;
    let attempts = 0;
    let roomCodeAvailable = false;
    do {
      roomCode = generateRoomCode();
      attempts++;
      const existing = await kv.get(`room:${roomCode}`);
      if (!existing) {
        roomCodeAvailable = true;
        break;
      }
    } while (attempts < 10);

    if (!roomCodeAvailable) {
      return jsonResponse({
        error: 'Failed to generate unique room code'
      }, { ...RESPONSE_OPTIONS, status: 500 });
    }

    // Server-side host auth token. Stored in KV; required on all PUTs.
    // Returned to creator ONCE in this response — never exposed via GET.
    const authToken = generateAuthToken();

    const now = new Date().toISOString();
    const gameEnded = canonicalGameData.state?.gameStatus?.ended === true;
    const roomData = {
      ...canonicalGameData,
      roomCode,
      authToken,
      createdAt: now,
      finishedAt: gameEnded ? now : null,
      lastUpdated: now,
      isFavorite: false,
      endGameVotes: { mvp: {}, burden: {}, fingerprints: [] },
      endGameVotesHistory: [],
      version: ROOM_SCHEMA_VERSION
    };
    delete roomData.favoritedAt;
    delete roomData.unfavoritedAt;

    // 1 year TTL (favorite-aware updates extend permanently)
    await kv.setex(`room:${roomCode}`, 31536000, JSON.stringify(roomData));

    // Add to rooms index for browsing (best-effort — non-critical)
    try {
      const roomsIndexKey = 'rooms:index';
      const roomsIndex = addRoomIndexEntry(
        await kv.get(roomsIndexKey),
        { roomCode, createdAt: roomData.createdAt }
      );
      await kv.set(roomsIndexKey, roomsIndex);
    } catch (indexError) {
      console.error('Failed to update rooms index:', indexError);
    }

    return jsonResponse({
      success: true,
      roomCode,
      authToken,           // host must persist — not retrievable later
      createdAt: roomData.createdAt,
      finishedAt: roomData.finishedAt,
      expiresIn: 31536000  // 1 year
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('Failed to create room:', error);
    return jsonResponse({
      error: 'Internal server error'
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge'
};
