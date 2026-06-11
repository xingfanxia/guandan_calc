// Reset voting for new round
// UTF-8 encoding for Chinese characters

import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse } from '../../_cors.js';
import { authorizeRoomHost } from '../_auth.js';
import { normalizeVoteStore, saveRoomWithFavoriteTtl } from '../_votes.js';

const RESPONSE_OPTIONS = {
  methods: 'POST, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization'
};

function voteStoreHasData(votes) {
  return Object.keys(votes.mvp).length > 0 ||
    Object.keys(votes.burden).length > 0 ||
    votes.fingerprints.length > 0;
}

export function resetRoomVotingState(room, completedAt = new Date().toISOString()) {
  let changed = false;

  // Legacy/current-round voting model. Keep a short archive so a manual reset
  // does not silently erase the host's last visible voting panel data.
  if (room.voting?.currentRound) {
    if (!Array.isArray(room.voting.history)) {
      room.voting.history = [];
    }

    room.voting.history.push({
      ...room.voting.currentRound,
      completedAt
    });
    room.voting.history = room.voting.history.slice(-20);

    room.voting.currentRound = {
      roundId: null,
      votes: {},
      results: { mvp: {}, burden: {} }
    };
    changed = true;
  }

  // Current end-game voting model used by /api/rooms/vote/[code].js.
  // Resetting only `room.voting.currentRound` leaves old vote counts and
  // fingerprints active, so viewers can see stale results or be rejected as
  // duplicate voters after the host starts a new voting window.
  const currentEndGameVotes = normalizeVoteStore(room.endGameVotes);
  const hasEndGameVotes = voteStoreHasData(currentEndGameVotes);
  if (hasEndGameVotes) {
    room.endGameVotesHistory = Array.isArray(room.endGameVotesHistory)
      ? room.endGameVotesHistory
      : [];
    room.endGameVotesHistory.push({
      ...currentEndGameVotes,
      completedAt
    });
    room.endGameVotesHistory = room.endGameVotesHistory.slice(-20);
  }

  if (hasEndGameVotes || room.endGameVotes !== undefined) {
    changed = true;
  }
  room.endGameVotes = { mvp: {}, burden: {}, fingerprints: [] };

  return { changed };
}

export async function saveResetRoomVotingState(kvClient, roomCode, room) {
  await saveRoomWithFavoriteTtl(kvClient, roomCode, room);
}

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'POST, OPTIONS', 'Content-Type, Authorization');
  if (preflight) return preflight;

  const url = new URL(request.url);
  const roomCode = url.pathname.split('/').pop();

  // Validate room code format
  if (!roomCode || !roomCode.match(/^[A-Z0-9]{6}$/)) {
    return jsonResponse({
      error: 'Invalid room code format' 
    }, { ...RESPONSE_OPTIONS, status: 400 });
  }

  if (request.method !== 'POST') {
    return jsonResponse({
      error: 'Method not allowed' 
    }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    const auth = await authorizeRoomHost(request, roomCode, RESPONSE_OPTIONS);
    if (!auth.ok) return auth.response;
    const parsedRoom = auth.room;

    const completedAt = new Date().toISOString();
    resetRoomVotingState(parsedRoom, completedAt);
    parsedRoom.lastUpdated = completedAt;
    await saveResetRoomVotingState(kv, roomCode, parsedRoom);

    return jsonResponse({
      success: true,
      message: 'Voting reset for new round'
    }, RESPONSE_OPTIONS);

  } catch (error) {
    console.error('Reset vote error:', error);
    return jsonResponse({
      error: 'Internal server error' 
    }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge'
};
