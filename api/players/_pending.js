// Anti-cheat review queue — pending session store (ported from the wxapp
// 战绩入库管理员审核队列, 2026-06-15).
//
// A real-room host's bearer proves they control the room, not that the session
// numbers are true — so a host could fabricate stats for any participant
// (including themselves). api/players/[handle].js routes real-room, non-admin
// stats writes here instead of applying them; an admin approves via
// api/players/pending.js, which replays the stored gameResult through the same
// handler with an admin token (reusing the apply + sessionHistory idempotency).
//
// Storage: one KV entry per pending submission, `pending_session:<id>`, where
// <id> is deterministic per (handle, sessionKey) so a host's auto-sync retry
// overwrites rather than piling duplicate review items.

import { kv } from '@vercel/kv';
import { hashToken } from './_utils.js';

export const PENDING_PREFIX = 'pending_session:';
const MAX_SUMMARY_LENGTH = 200;
const ID_PATTERN = /^[a-f0-9]{1,64}$/;

// The exact fields the approval replay consumes (everything the [handle].js apply
// path reads off gameResult). Persist ONLY these so a host can't pad the stored
// record with arbitrary extra JSON — the gameResult that reaches enqueue is a
// `{ ...rawClient, ...validatedOverrides }` spread, so unvalidated client keys
// would otherwise ride through. roomCode/mode/ranking/team/handle-lists/keys are
// already range-validated upstream; this just bounds the stored SHAPE.
const PENDING_GAMERESULT_FIELDS = [
  'roomCode', 'mode', 'ranking', 'relativeRank', 'team', 'teamWon',
  'gamesInSession', 'sessionDuration', 'firstPlaces', 'lastPlaces',
  'mvpVoteCount', 'burdenVoteCount', 'votedMVP', 'votedBurden',
  'teammates', 'opponents', 'gameSessionKey', 'voteSessionKey', 'honorsEarned'
];

function pickGameResultFields(gameResult) {
  const src = gameResult && typeof gameResult === 'object' ? gameResult : {};
  const out = {};
  for (const field of PENDING_GAMERESULT_FIELDS) {
    if (src[field] !== undefined) out[field] = src[field];
  }
  return out;
}

/**
 * Deterministic id per (handle, sessionKey): SHA-256 hex (edge crypto), first 32
 * chars. Same session re-submitted → same id → KV.set overwrites (no clutter).
 */
export async function derivePendingId(handle, sessionKey) {
  const digest = await hashToken(`${handle}|${sessionKey || ''}`);
  return digest.slice(0, 32);
}

function buildSummary(handle, gameResult) {
  const code = gameResult.roomCode || '';
  const mode = gameResult.mode || '';
  const outcome = gameResult.teamWon ? '胜' : '负';
  const rounds = Number(gameResult.gamesInSession) || 0;
  const rankNum = Number(gameResult.ranking);
  const rank = Number.isFinite(rankNum) ? `均名次 ${rankNum.toFixed(1)}` : '';
  const parts = [`房间 ${code}`, mode, `@${handle}`, outcome];
  if (rounds) parts.push(`${rounds} 局`);
  if (rank) parts.push(rank);
  return parts.filter(Boolean).join(' · ').slice(0, MAX_SUMMARY_LENGTH);
}

/**
 * Persist a pending submission. Stores an allowlisted projection of the
 * server-authoritative gameResult (teamWon + vote counts already overridden by
 * the handler) — never the raw client object, never an admin token. The ladder
 * delta is snapshotted from the still-live room here so replay-on-approval stays
 * correct (stats AND ladder) even after the room's 24h TTL expires.
 *
 * `sessionKey` (the derived gameSessionHistoryKey) is REQUIRED — it salts the
 * deterministic id so a host's auto-sync retry overwrites the same entry. A
 * falsy key would collapse every session to one id and silently evict unreviewed
 * submissions, so we reject it loudly rather than swallow it.
 */
export async function enqueuePendingSession({ handle, gameResult, sessionKey, ladderDelta }) {
  if (!sessionKey) {
    throw new Error('enqueuePendingSession requires a non-empty sessionKey');
  }
  const id = await derivePendingId(handle, sessionKey);
  const record = {
    id,
    handle,
    gameResult: pickGameResultFields(gameResult),
    roomCode: gameResult?.roomCode || null,
    mode: gameResult?.mode || null,
    summary: buildSummary(handle, gameResult || {}),
    submittedAt: new Date().toISOString()
  };
  // Captured while the room is live; applied on approval if the room has expired.
  if (Number.isFinite(ladderDelta)) record.ladderDelta = ladderDelta;
  await kv.set(`${PENDING_PREFIX}${id}`, JSON.stringify(record));
  return record;
}

export function parsePendingRecord(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function getPendingSession(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  return parsePendingRecord(await kv.get(`${PENDING_PREFIX}${id}`));
}

export async function removePendingSession(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return false;
  await kv.del(`${PENDING_PREFIX}${id}`);
  return true;
}

/** Display-only projection — the admin list never needs the raw gameResult. */
export function summarizePending(record) {
  if (!record) return null;
  return {
    id: record.id,
    handle: record.handle,
    summary: record.summary || `房间 ${record.roomCode || ''}`,
    mode: record.mode || '',
    roomCode: record.roomCode || '',
    submittedAt: record.submittedAt || null
  };
}

export async function listPendingSessions() {
  const keys = await kv.keys(`${PENDING_PREFIX}*`);
  const values = await Promise.all(keys.map((key) => kv.get(key)));
  return values
    .map(parsePendingRecord)
    .map(summarizePending)
    .filter(Boolean)
    // Newest first — ISO-8601 strings sort lexicographically.
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
}
