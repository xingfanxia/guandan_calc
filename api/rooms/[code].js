// Get or update game room data - Vercel Edge Function
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import { constantTimeEqual, extractBearerToken, roomAuthError } from './_auth.js';
import { parseRoomRecord } from './_record.js';
import { normalizeVoteStore, publicVoteStoreForRoom } from './_votes.js';
import { getHistoryEntries, resolveGameStatus } from '../../shared/gameStatus.js';
import {
  canonicalizeRoomSnapshotPayload,
  isValidRoomSnapshotPayload
} from '../../shared/roomSnapshotValidation.js';
import { deriveGameSessionKey } from '../../shared/voteSessionKey.js';
import { ROOM_SCHEMA_VERSION } from '../../shared/version.js';

const RESPONSE_OPTIONS = {
  methods: 'GET, PUT, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization'
};

function publicEndGameVotesHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
    .map(entry => {
      const { fingerprints, ...publicEntry } = entry;
      return publicEntry;
    });
}

function publicRoomSnapshot(roomData) {
  const { authToken, ...publicRoomData } = canonicalizeRoomSnapshotPayload(roomData);

  if (publicRoomData.endGameVotes !== undefined) {
    publicRoomData.endGameVotes = publicVoteStoreForRoom(publicRoomData);
  }
  if (publicRoomData.endGameVotesHistory !== undefined) {
    publicRoomData.endGameVotesHistory = publicEndGameVotesHistory(publicRoomData.endGameVotesHistory);
  }

  return publicRoomData;
}

function emptyVoteStore() {
  return { mvp: {}, burden: {}, fingerprints: [] };
}

function completedGameSessionKey(roomCode, roomData) {
  const history = getHistoryEntries(roomData?.state);
  const gameStatus = resolveGameStatus(roomData?.state?.gameStatus, history);
  if (!gameStatus.ended) return null;

  return deriveGameSessionKey({
    roomCode,
    gameStatus,
    history,
    finishedAt: roomData?.finishedAt
  });
}

function latestHistoryEntry(history) {
  const entries = getHistoryEntries(history);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

function completedGameHistoryAnchorKey(roomCode, roomData) {
  const history = getHistoryEntries(roomData?.state);
  const latestGame = latestHistoryEntry(history);
  if (!latestGame) return null;

  const gameStatus = resolveGameStatus(roomData?.state?.gameStatus, history);
  if (!gameStatus.ended) return null;

  const endedAt = latestGame.gameEndedAt || latestGame.ts;
  if (!endedAt) return null;

  return [
    roomCode,
    'game-history',
    history.length,
    gameStatus.winnerKey || latestGame.winKey || 'unknown',
    endedAt
  ].map(part => encodeURIComponent(String(part))).join(':');
}

function isSameCompletedGame(roomCode, gameData, existingData) {
  const nextGameKey = completedGameSessionKey(roomCode, gameData);
  const existingGameKey = completedGameSessionKey(roomCode, existingData);
  if (nextGameKey && existingGameKey && nextGameKey === existingGameKey) {
    return true;
  }

  const nextHistoryKey = completedGameHistoryAnchorKey(roomCode, gameData);
  const existingHistoryKey = completedGameHistoryAnchorKey(roomCode, existingData);
  return Boolean(
    nextHistoryKey &&
    existingHistoryKey &&
    nextHistoryKey === existingHistoryKey
  );
}

function authoritativeVoteStateForUpdate(roomCode, gameData, existingData) {
  const gameStatus = resolveGameStatus(gameData?.state?.gameStatus, getHistoryEntries(gameData?.state));
  const existingHistory = Array.isArray(existingData?.endGameVotesHistory)
    ? existingData.endGameVotesHistory
    : [];

  if (gameStatus.ended) {
    const sameCompletedGame = isSameCompletedGame(roomCode, gameData, existingData);

    return {
      endGameVotes: sameCompletedGame
        ? normalizeVoteStore(existingData?.endGameVotes)
        : emptyVoteStore(),
      endGameVotesHistory: existingHistory,
      sameCompletedGame
    };
  }

  return {
    endGameVotes: emptyVoteStore(),
    endGameVotesHistory: existingHistory,
    sameCompletedGame: false
  };
}

function validTimestampOrNull(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return Number.isFinite(new Date(value).getTime()) ? value : null;
}

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'GET, PUT, OPTIONS', 'Content-Type, Authorization');
  if (preflight) return preflight;

  const url = new URL(request.url);
  const roomCode = url.pathname.split('/').pop();

  if (!roomCode || !roomCode.match(/^[A-Z0-9]{6}$/)) {
    return jsonResponse({
      error: 'Invalid room code format - should be 6 alphanumeric characters'
    }, { ...RESPONSE_OPTIONS, status: 400 });
  }

  try {
    if (request.method === 'GET') {
      const roomData = await kv.get(`room:${roomCode}`);

      if (!roomData) {
        return jsonResponse({
          error: 'Room not found or expired'
        }, { ...RESPONSE_OPTIONS, status: 404 });
      }

      const parsedData = parseRoomRecord(roomData);
      if (!parsedData) {
        return jsonResponse({
          error: 'Room not found or expired'
        }, { ...RESPONSE_OPTIONS, status: 404 });
      }
      const providedToken = extractBearerToken(request);
      const storedToken = parsedData.authToken || null;
      const hostVerified = Boolean(storedToken && providedToken && constantTimeEqual(providedToken, storedToken));

      if (providedToken && storedToken && !hostVerified) {
        return roomAuthError('Unauthorized — invalid host token for this room', RESPONSE_OPTIONS);
      }

      // SECURITY: strip server-private fields from response. Viewers must NEVER
      // see the host token or vote fingerprints.
      const publicRoomData = publicRoomSnapshot(parsedData);

      return jsonResponse({
        success: true,
        data: publicRoomData,
        ...(hostVerified ? { hostVerified: true } : {})
      }, RESPONSE_OPTIONS);

    } else if (request.method === 'PUT') {
      const providedToken = extractBearerToken(request);
      if (!providedToken) {
        return roomAuthError('Unauthorized — auth token required to update room', RESPONSE_OPTIONS);
      }

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

      const existingRoom = await kv.get(`room:${roomCode}`);
      if (!existingRoom) {
        return jsonResponse({
          error: 'Room not found or expired'
        }, { ...RESPONSE_OPTIONS, status: 404 });
      }

      const existingData = parseRoomRecord(existingRoom);
      if (!existingData) {
        return jsonResponse({
          error: 'Room not found or expired'
        }, { ...RESPONSE_OPTIONS, status: 404 });
      }
      const storedToken = existingData.authToken || null;

      // Auth gate:
      //   - Stored token present → strict constant-time match required.
      //   - Stored token absent (legacy room created before this fix) → TOFU:
      //     accept the first PUT's token and pin it as the host token going forward.
      //     Without this, in-flight rooms would break on rotation.
      let effectiveToken;
      if (storedToken) {
        if (!providedToken || !constantTimeEqual(providedToken, storedToken)) {
          return jsonResponse({
            error: 'Unauthorized — only the host can update this room'
          }, {
            ...RESPONSE_OPTIONS,
            status: 403,
            headers: {
              'WWW-Authenticate': 'Bearer realm="room"'
            }
          });
        }
        effectiveToken = storedToken;
      } else {
        if (!providedToken) {
          return jsonResponse({
            error: 'Unauthorized — auth token required to update room'
          }, {
            ...RESPONSE_OPTIONS,
            status: 403,
            headers: {
              'WWW-Authenticate': 'Bearer realm="room"'
            }
          });
        }
        effectiveToken = providedToken;
        console.log(`Room ${roomCode}: TOFU pinned host token`);
      }

      const now = new Date().toISOString();
      const gameStatus = resolveGameStatus(canonicalGameData?.state?.gameStatus, getHistoryEntries(canonicalGameData?.state));
      const authoritativeVoteState = authoritativeVoteStateForUpdate(roomCode, canonicalGameData, existingData);
      const createdAt = validTimestampOrNull(existingData.createdAt) || now;
      const finishedAt = gameStatus.ended
        ? (authoritativeVoteState.sameCompletedGame ? (validTimestampOrNull(existingData.finishedAt) || now) : now)
        : null;
      const updatedData = {
        ...canonicalGameData,
        ...authoritativeVoteState,
        roomCode,
        authToken: effectiveToken,  // preserve through update — never accept from client body
        createdAt,
        finishedAt,
        isFavorite: Boolean(existingData.isFavorite),
        lastUpdated: now,
        version: ROOM_SCHEMA_VERSION
      };

      // Favorite rooms get permanent storage; otherwise 1 year TTL
      if (existingData.isFavorite) {
        updatedData.favoritedAt = existingData.favoritedAt || gameData.favoritedAt || new Date().toISOString();
        delete updatedData.unfavoritedAt;
        await kv.set(`room:${roomCode}`, JSON.stringify(updatedData));
      } else {
        delete updatedData.favoritedAt;
        await kv.setex(`room:${roomCode}`, 31536000, JSON.stringify(updatedData));
      }

      return jsonResponse({
        success: true,
        lastUpdated: updatedData.lastUpdated
      }, RESPONSE_OPTIONS);

    } else {
      return jsonResponse({
        error: 'Method not allowed'
      }, { ...RESPONSE_OPTIONS, status: 405 });
    }

  } catch (error) {
    console.error('Room API error:', error);
    return jsonResponse({
      error: 'Internal server error'
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge'
};
