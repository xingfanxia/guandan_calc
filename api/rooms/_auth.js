import { kv } from '@vercel/kv';
import { jsonResponse } from '../_cors.js';
import { parseRoomRecord } from './_record.js';

const DEFAULT_AUTH_RESPONSE_OPTIONS = {
  methods: 'POST, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization'
};

export function extractBearerToken(request) {
  const header = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function roomAuthError(
  message = 'Unauthorized — only the host can update this room',
  responseOptions = DEFAULT_AUTH_RESPONSE_OPTIONS
) {
  return jsonResponse({ error: message }, {
    ...DEFAULT_AUTH_RESPONSE_OPTIONS,
    ...responseOptions,
    status: 403,
    headers: {
      'WWW-Authenticate': 'Bearer realm="room"'
    }
  });
}

export async function authorizeRoomHost(request, roomCode, responseOptions = DEFAULT_AUTH_RESPONSE_OPTIONS) {
  const providedToken = extractBearerToken(request);
  if (!providedToken) {
    return {
      ok: false,
      response: roomAuthError('Unauthorized — auth token required', responseOptions)
    };
  }

  const roomData = await kv.get(`room:${roomCode}`);
  if (!roomData) {
    return {
      ok: false,
      response: jsonResponse({ error: 'Room not found' }, {
        ...DEFAULT_AUTH_RESPONSE_OPTIONS,
        ...responseOptions,
        status: 404
      })
    };
  }

  const room = parseRoomRecord(roomData);
  if (!room) {
    return {
      ok: false,
      response: jsonResponse({ error: 'Room not found' }, {
        ...DEFAULT_AUTH_RESPONSE_OPTIONS,
        ...responseOptions,
        status: 404
      })
    };
  }

  if (!room.authToken || !constantTimeEqual(providedToken, room.authToken)) {
    return {
      ok: false,
      response: roomAuthError(undefined, responseOptions)
    };
  }

  return { ok: true, room };
}
