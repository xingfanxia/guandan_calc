// End-game voting - with fingerprint deduplication
import { kv } from '@vercel/kv';
import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../../_cors.js';
import { parseRoomRecord } from '../_record.js';
import {
  isValidRoomCode,
  normalizeVoteStore,
  publicVoteStoreForRoom,
  saveRoomWithFavoriteTtl,
  validateVotePayload,
  VOTE_FINGERPRINT_CAP
} from '../_votes.js';

const RESPONSE_OPTIONS = { methods: 'GET, POST, OPTIONS' };

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'GET, POST, OPTIONS');
  if (preflight) return preflight;

  const url = new URL(request.url);
  const roomCode = url.pathname.split('/').pop();
  if (!isValidRoomCode(roomCode)) {
    return jsonResponse({ error: 'Invalid room code format' }, { ...RESPONSE_OPTIONS, status: 400 });
  }

  if (request.method === 'POST') {
    try {
      const parsedBody = await parseJsonBody(request);
      if (!parsedBody.ok) {
        return jsonResponse({ error: parsedBody.error }, { ...RESPONSE_OPTIONS, status: 400 });
      }
      const { mvpPlayerId, burdenPlayerId, fingerprint } = parsedBody.data;

      if (!mvpPlayerId || !burdenPlayerId) {
        return jsonResponse({ error: 'Missing player IDs' }, { ...RESPONSE_OPTIONS, status: 400 });
      }

      // Validate: MVP and burden cannot be the same person
      if (mvpPlayerId === burdenPlayerId) {
        return jsonResponse({ error: 'same_person' }, { ...RESPONSE_OPTIONS, status: 400 });
      }

      // Get room
      const roomData = await kv.get(`room:${roomCode}`);
      if (!roomData) {
        return jsonResponse({ error: 'Room not found' }, { ...RESPONSE_OPTIONS, status: 404 });
      }

      const room = parseRoomRecord(roomData);
      if (!room) {
        return jsonResponse({ error: 'Room not found' }, { ...RESPONSE_OPTIONS, status: 404 });
      }
      const validation = validateVotePayload(room, { mvpPlayerId, burdenPlayerId, fingerprint });
      if (!validation.ok) {
        return jsonResponse({ error: validation.error }, { ...RESPONSE_OPTIONS, status: validation.status });
      }

      room.endGameVotes = normalizeVoteStore(room.endGameVotes);

      // Check for duplicate fingerprint
      if (room.endGameVotes.fingerprints.includes(validation.fingerprint)) {
        console.log('Duplicate vote fingerprint detected');
        return jsonResponse({ error: 'duplicate_fingerprint' }, { ...RESPONSE_OPTIONS, status: 400 });
      }

      // Store vote
      room.endGameVotes.mvp[validation.mvpPlayerId] = (room.endGameVotes.mvp[validation.mvpPlayerId] || 0) + 1;
      room.endGameVotes.burden[validation.burdenPlayerId] = (room.endGameVotes.burden[validation.burdenPlayerId] || 0) + 1;

      // Store fingerprint to prevent duplicate voting.
      // Cap to last 1000 — without this, fingerprint storage grows linearly forever,
      // bloating the KV record and slowing JSON serialization on every read/write.
      // 1000 is a couple orders of magnitude above realistic vote counts per room
      // (each room has at most a handful of viewers); when the cap is reached,
      // the oldest fingerprints fall off, allowing those clients to re-vote — an
      // acceptable trade in this app's threat model (casual vote, not high-stakes).
      room.endGameVotes.fingerprints.push(validation.fingerprint);
      if (room.endGameVotes.fingerprints.length > VOTE_FINGERPRINT_CAP) {
        room.endGameVotes.fingerprints = room.endGameVotes.fingerprints.slice(-VOTE_FINGERPRINT_CAP);
      }

      // Save
      await saveRoomWithFavoriteTtl(kv, roomCode, room);

      console.log('Votes saved successfully');

      return jsonResponse({ success: true }, RESPONSE_OPTIONS);

    } catch (error) {
      console.error('Vote error:', error);
      return jsonResponse({ error: 'Internal error' }, { ...RESPONSE_OPTIONS, status: 500 });
    }

  } else if (request.method === 'GET') {
    try {
      const roomData = await kv.get(`room:${roomCode}`);

      if (!roomData) {
        return jsonResponse({
          success: true,
          votes: { mvp: {}, burden: {} }
        }, RESPONSE_OPTIONS);
      }

      const room = parseRoomRecord(roomData);
      if (!room) {
        return jsonResponse({
          success: true,
          votes: { mvp: {}, burden: {} }
        }, RESPONSE_OPTIONS);
      }

      return jsonResponse({
        success: true,
        votes: publicVoteStoreForRoom(room)
      }, RESPONSE_OPTIONS);

    } catch (error) {
      console.error('GET error:', error);
      return jsonResponse({ error: 'Error' }, { ...RESPONSE_OPTIONS, status: 500 });
    }

  } else {
    return jsonResponse({ error: 'Method not allowed' }, { ...RESPONSE_OPTIONS, status: 405 });
  }
}

export const config = {
  runtime: 'edge'
};
