// Anti-cheat review queue — admin endpoint (list / approve / reject).
// Ported from the wxapp `admin` cloud function (2026-06-15).
//
// All actions are admin-gated (ADMIN_TOKEN, constant-time compare). POST-only so
// the token rides in the body, never a query string. Approve REPLAYS the stored
// gameResult through the [handle] stats handler with an admin token injected,
// which reuses the hardened apply + the sessionHistory idempotency gate — no
// duplicated apply logic, double-approve is a no-op.

import { handleCorsPreflight, jsonResponse, parseJsonBody } from '../_cors.js';
import { validateAdminToken } from './_utils.js';
import {
  listPendingSessions,
  getPendingSession,
  removePendingSession
} from './_pending.js';
import statsHandler from './[handle].js';

const RESPONSE_OPTIONS = { methods: 'POST, OPTIONS' };

// Replay an approved submission through the stats handler with an admin token,
// so it applies through exactly the same validated path the live PUT uses.
async function replayApprovedSession(record, adminToken) {
  const replayBody = { ...record.gameResult, adminToken };
  // If the room has expired since the session was queued, the handler can't
  // recompute the ladder from a live snapshot — feed it the delta captured at
  // enqueue time so the rating change still applies (api/players/[handle].js).
  if (Number.isFinite(record.ladderDelta)) replayBody._pendingLadderDelta = record.ladderDelta;
  const replayRequest = new Request(
    `https://internal/api/players/${encodeURIComponent(record.handle)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replayBody)
    }
  );
  const replayResponse = await statsHandler(replayRequest);
  const data = await replayResponse.json().catch(() => ({}));
  return { ok: replayResponse.ok, status: replayResponse.status, data };
}

export default async function handler(request) {
  const preflight = handleCorsPreflight(request, 'POST, OPTIONS');
  if (preflight) return preflight;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { ...RESPONSE_OPTIONS, status: 405 });
  }

  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) {
      return jsonResponse({ error: parsed.error }, { ...RESPONSE_OPTIONS, status: 400 });
    }
    const { adminToken, action, id } = parsed.data;

    if (!validateAdminToken(adminToken)) {
      return jsonResponse({ error: 'Unauthorized - Invalid admin token' }, { ...RESPONSE_OPTIONS, status: 403 });
    }

    if (action === 'list') {
      return jsonResponse({ success: true, items: await listPendingSessions() }, RESPONSE_OPTIONS);
    }

    if (action === 'approve') {
      const record = await getPendingSession(id);
      if (!record) {
        return jsonResponse({ error: 'Pending session not found' }, { ...RESPONSE_OPTIONS, status: 404 });
      }
      const replay = await replayApprovedSession(record, adminToken);
      if (!replay.ok) {
        // Apply rejected (e.g. player deleted since submit) — keep the pending
        // entry so the admin can retry or reject explicitly.
        return jsonResponse({
          error: 'Approve failed — apply rejected',
          detail: replay.data?.error || null
        }, { ...RESPONSE_OPTIONS, status: 502 });
      }
      await removePendingSession(id);
      return jsonResponse({
        success: true,
        approved: true,
        id,
        duplicateSessionIgnored: replay.data?.duplicateSessionIgnored === true
      }, RESPONSE_OPTIONS);
    }

    if (action === 'reject') {
      const record = await getPendingSession(id);
      if (!record) {
        return jsonResponse({ error: 'Pending session not found' }, { ...RESPONSE_OPTIONS, status: 404 });
      }
      await removePendingSession(id);
      return jsonResponse({ success: true, rejected: true, id }, RESPONSE_OPTIONS);
    }

    return jsonResponse({ error: 'Invalid action' }, { ...RESPONSE_OPTIONS, status: 400 });
  } catch (error) {
    console.error('Pending queue error:', error);
    return jsonResponse({ error: 'Internal server error' }, { ...RESPONSE_OPTIONS, status: 500 });
  }
}

export const config = {
  runtime: 'edge'
};
