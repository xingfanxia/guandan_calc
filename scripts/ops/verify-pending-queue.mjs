/**
 * Anti-cheat review queue (ported from wxapp 战绩审核队列) — end-to-end behavior
 * over a mocked KV pipeline, exercising both api/players/[handle].js (the queue
 * gate) and api/players/pending.js (admin list/approve/reject).
 *
 * Verifies:
 *   1. A real-room, non-admin host write QUEUES (pending:true) and does NOT apply.
 *   2. Re-submitting the same session overwrites (one pending entry, same id).
 *   3. Admin approval replays the stored payload through the handler → applies
 *      exactly once, removes the entry; a second approve is a 404 no-op.
 *   4. A host re-sync after approval hits the idempotency gate (no double count).
 *   5. An admin-token write bypasses the queue (applies directly).
 *   6. A LOCAL game bypasses the queue (owner self-stats).
 *   7. A vote-only write bypasses the queue (server-authoritative votes).
 *   8. Reject removes the entry and never applies.
 *   9. The pending endpoint rejects a bad admin token.
 */
import assert from 'node:assert/strict';
import { hashToken, initializePlayerStats } from '../../api/players/_utils.js';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';
process.env.ADMIN_TOKEN = 'test-admin-token';

const HOST_TOKEN = 'room-host-token';
const ADMIN_TOKEN = 'test-admin-token';

let store = new Map();

function patternToRegex(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === '*' ? '.*' : '\\' + m));
  return new RegExp('^' + escaped + '$');
}

function execCommand(cmd) {
  const [opRaw, key, ...args] = cmd;
  const op = String(opRaw).toLowerCase();
  if (op === 'get') return { result: store.has(key) ? store.get(key) : null };
  if (op === 'set') { store.set(key, args[0]); return { result: 'OK' }; }
  if (op === 'del') { return { result: store.delete(key) ? 1 : 0 }; }
  if (op === 'keys') {
    const re = patternToRegex(key);
    return { result: [...store.keys()].filter((k) => re.test(k)) };
  }
  throw new Error(`Unexpected KV command: ${op} ${key}`);
}

globalThis.fetch = async (url, options = {}) => {
  // @vercel/kv auto-pipelines get/set/del as [[op,key,...],...], but kv.keys is
  // a single un-pipelined op (["keys", pattern]) on a different endpoint — both
  // shapes are real and must be handled.
  const body = JSON.parse(options.body || '[]');
  const isPipeline = Array.isArray(body[0]);
  const out = isPipeline ? body.map(execCommand) : execCommand(body);
  return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const { default: statsHandler } = await import('../../api/players/[handle].js');
const { default: pendingHandler } = await import('../../api/players/pending.js');

const room = {
  roomCode: 'REVQ01',
  authToken: HOST_TOKEN,
  settings: {},
  state: {
    gameStatus: { ended: true, winnerKey: 't1', winnerName: '蓝队', reason: 'A_LEVEL_CLEARED' },
    history: [{
      ts: '2026-06-15 20:15:00',
      gameEndedAt: '2026-06-15T20:15:00.000Z',
      winKey: 't1',
      gameStatus: { ended: true, winnerKey: 't1', winnerName: '蓝队', reason: 'A_LEVEL_CLEARED' }
    }]
  },
  finishedAt: '2026-06-15T20:15:00.000Z',
  players: [
    { id: 1, handle: 'alice', name: 'alice', team: 1 },
    { id: 2, handle: 'bob', name: 'bob', team: 2 },
    { id: 3, handle: 'carol', name: 'carol', team: 1 },
    { id: 4, handle: 'dave', name: 'dave', team: 2 }
  ],
  playerStats: {
    1: { games: 10, totalRank: 25 },
    2: { games: 10, totalRank: 35 },
    3: { games: 10, totalRank: 28 },
    4: { games: 10, totalRank: 32 }
  },
  endGameVotes: { mvp: {}, burden: {}, fingerprints: [] },
  endGameVotesHistory: [],
  createdAt: '2026-06-15T10:00:00.000Z'
};

function freshProfile(handle) {
  return {
    id: `PLR_${handle.toUpperCase()}`,
    handle,
    displayName: handle,
    emoji: handle[0].toUpperCase(),
    playStyle: 'steady',
    tagline: '',
    ownershipTokenHash: '',
    stats: initializePlayerStats(),
    recentGames: [],
    achievements: [],
    createdAt: '2026-06-15T10:00:00.000Z',
    lastActiveAt: '2026-06-15T10:00:00.000Z'
  };
}

async function seedStore({ carolOwner } = {}) {
  store = new Map();
  for (const handle of ['alice', 'bob', 'carol', 'dave']) {
    const profile = freshProfile(handle);
    if (handle === 'carol' && carolOwner) profile.ownershipTokenHash = await hashToken(carolOwner);
    store.set(`player:${handle}`, JSON.stringify(profile));
  }
  store.set(`room:${room.roomCode}`, JSON.stringify(room));
}

function getProfile(handle) {
  const value = store.get(`player:${handle}`);
  return value ? JSON.parse(value) : null;
}

function pendingKeys() {
  return [...store.keys()].filter((k) => k.startsWith('pending_session:'));
}

function baseSession(team) {
  return {
    roomCode: room.roomCode,
    mode: '4P',
    ranking: 2.5,
    relativeRank: 1,
    team,
    teamWon: team === 1,
    gamesInSession: 10,
    gameSessionKey: 'client-session-key',
    teammates: team === 1 ? ['carol'] : ['dave'],
    opponents: team === 1 ? ['bob', 'dave'] : ['alice', 'carol'],
    honorsEarned: []
  };
}

function putStats(handle, body, { bearer, admin } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const payload = { ...body };
  if (admin) payload.adminToken = admin;
  return statsHandler(new Request(`https://example.test/api/players/${handle}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  }));
}

function adminPost(extra, token = ADMIN_TOKEN) {
  return pendingHandler(new Request('https://example.test/api/players/pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminToken: token, ...extra })
  }));
}

// ===== 1 + 2: host write queues; resubmit dedups =====
await seedStore();
const queued1 = await putStats('alice', baseSession(1), { bearer: HOST_TOKEN });
const queuedData1 = await queued1.json();
assert.equal(queued1.status, 200, JSON.stringify(queuedData1));
assert.equal(queuedData1.pending, true, 'real-room non-admin host write should queue');
assert.equal(pendingKeys().length, 1, 'one pending entry created');
assert.equal(getProfile('alice').stats.sessionsPlayed, 0, 'queued write must NOT apply stats');

const queued2 = await putStats('alice', baseSession(1), { bearer: HOST_TOKEN });
const queuedData2 = await queued2.json();
assert.equal(queuedData2.pending, true, 're-submit still queues');
assert.equal(pendingKeys().length, 1, 'deterministic id → resubmission overwrites (no clutter)');
assert.equal(queuedData2.pendingId, queuedData1.pendingId, 'same pending id on resubmit');

// ===== 3 + 4: approve applies once, removes, idempotent =====
const listRes = await adminPost({ action: 'list' });
const listData = await listRes.json();
assert.equal(listRes.status, 200, JSON.stringify(listData));
assert.equal(listData.items.length, 1, 'list returns the queued item');
assert.equal(listData.items[0].id, queuedData1.pendingId, 'list item id matches');
assert.equal(listData.items[0].gameResult, undefined, 'list projection must not leak the raw gameResult');

const approveRes = await adminPost({ action: 'approve', id: queuedData1.pendingId });
const approveData = await approveRes.json();
assert.equal(approveRes.status, 200, JSON.stringify(approveData));
assert.equal(approveData.approved, true, 'approve succeeds');
assert.equal(getProfile('alice').stats.sessionsPlayed, 1, 'approval applied the session exactly once');
assert.equal(getProfile('alice').stats.ladder.sessions, 1, 'approval applied the ladder too');
assert.equal(pendingKeys().length, 0, 'approved entry removed from the queue');

const approveAgain = await adminPost({ action: 'approve', id: queuedData1.pendingId });
assert.equal(approveAgain.status, 404, 'approving an already-removed entry → 404 no-op');

const reSync = await putStats('alice', baseSession(1), { bearer: HOST_TOKEN });
const reSyncData = await reSync.json();
assert.notEqual(reSyncData.pending, true, 'an already-applied session is not re-queued');
assert.equal(reSyncData.duplicateSessionIgnored, true, 'host re-sync hits the idempotency gate');
assert.equal(getProfile('alice').stats.sessionsPlayed, 1, 'no double count on re-sync');

// ===== 5: admin-token write bypasses the queue =====
await seedStore();
const adminWrite = await putStats('alice', baseSession(1), { bearer: HOST_TOKEN, admin: ADMIN_TOKEN });
const adminWriteData = await adminWrite.json();
assert.equal(adminWrite.status, 200, JSON.stringify(adminWriteData));
assert.notEqual(adminWriteData.pending, true, 'admin write bypasses the queue');
assert.equal(pendingKeys().length, 0, 'admin write creates no pending entry');
assert.equal(getProfile('alice').stats.sessionsPlayed, 1, 'admin write applies directly');

// ===== 6: LOCAL game bypasses the queue =====
await seedStore({ carolOwner: 'carol-owner-token' });
const localWrite = await putStats('carol', {
  ...baseSession(1), roomCode: 'LOCAL', teammates: [], opponents: []
}, { bearer: 'carol-owner-token' });
const localData = await localWrite.json();
assert.equal(localWrite.status, 200, JSON.stringify(localData));
assert.notEqual(localData.pending, true, 'LOCAL game bypasses the queue');
assert.equal(pendingKeys().length, 0, 'LOCAL game creates no pending entry');
assert.equal(getProfile('carol').stats.sessionsPlayed, 1, 'LOCAL game applies directly');

// ===== 7: vote-only bypasses the queue =====
await seedStore();
const voteOnly = await putStats('alice', {
  roomCode: room.roomCode, mode: 'VOTE_ONLY', ranking: 0, team: 1, gamesInSession: 0,
  votedMVP: true, voteSessionKey: 'vote-key'
}, { bearer: HOST_TOKEN });
const voteData = await voteOnly.json();
assert.equal(voteOnly.status, 200, JSON.stringify(voteData));
assert.notEqual(voteData.pending, true, 'vote-only bypasses the queue');
assert.equal(pendingKeys().length, 0, 'vote-only creates no pending entry');

// ===== 8: reject removes, never applies =====
await seedStore();
const toReject = await putStats('alice', baseSession(1), { bearer: HOST_TOKEN });
const toRejectData = await toReject.json();
assert.equal(toRejectData.pending, true);
const rejectRes = await adminPost({ action: 'reject', id: toRejectData.pendingId });
const rejectData = await rejectRes.json();
assert.equal(rejectRes.status, 200, JSON.stringify(rejectData));
assert.equal(rejectData.rejected, true, 'reject succeeds');
assert.equal(pendingKeys().length, 0, 'rejected entry removed');
assert.equal(getProfile('alice').stats.sessionsPlayed, 0, 'rejected session never applied');

// ===== 9: server-authoritative teamWon/vote override survives enqueue→replay =====
// A lying host claims bob (team 2, the LOSING side) won and inflates the vote
// count. The server must correct both BEFORE persisting to the queue, and the
// correction must survive the round-trip and apply on approval.
await seedStore();
const lie = await putStats('bob', {
  ...baseSession(2),
  teamWon: true,
  mvpVoteCount: 999,
  finalLevel: 'A',                 // realistic extra field synced by the client
  paddingJunk: 'x'.repeat(5000)    // a host padding the stored record with junk
}, { bearer: HOST_TOKEN });
const lieData = await lie.json();
assert.equal(lie.status, 200, JSON.stringify(lieData));
assert.equal(lieData.pending, true, 'lying host write queues');
const storedLie = JSON.parse(store.get(`pending_session:${lieData.pendingId}`));
assert.equal(storedLie.gameResult.teamWon, false, 'pending record stores server-corrected teamWon (loss), not the host claim');
assert.equal(storedLie.gameResult.mvpVoteCount, 0, 'pending record stores server-authoritative vote count, not the inflated claim');
assert.equal(storedLie.gameResult.finalLevel, undefined, 'allowlist drops non-apply fields (finalLevel) from the stored record');
assert.equal(storedLie.gameResult.paddingJunk, undefined, 'allowlist drops arbitrary padded client keys from the stored record');
const lieApprove = await adminPost({ action: 'approve', id: lieData.pendingId });
const lieApproveData = await lieApprove.json();
assert.equal(lieApprove.status, 200, JSON.stringify(lieApproveData));
const bob = getProfile('bob');
assert.equal(bob.stats.sessionsPlayed, 1, 'approved session applied');
assert.equal(bob.stats.sessionsWon, 0, 'corrected loss applied (host lie rejected)');
assert.equal(bob.stats.mvpVotes, 0, 'inflated vote count rejected');

// ===== 10: ladder snapshot — approval after the room's 24h TTL still applies =====
await seedStore();
const ladderQueue = await putStats('alice', baseSession(1), { bearer: HOST_TOKEN });
const ladderQueueData = await ladderQueue.json();
assert.equal(ladderQueueData.pending, true);
const ladderRecord = JSON.parse(store.get(`pending_session:${ladderQueueData.pendingId}`));
assert.ok(Number.isFinite(ladderRecord.ladderDelta), 'enqueue snapshots a finite ladder delta from the live room');
// Room expires (24h TTL) before the admin reviews.
store.delete(`room:${room.roomCode}`);
const ladderApprove = await adminPost({ action: 'approve', id: ladderQueueData.pendingId });
const ladderApproveData = await ladderApprove.json();
assert.equal(ladderApprove.status, 200, JSON.stringify(ladderApproveData));
const aliceLadder = getProfile('alice');
assert.equal(aliceLadder.stats.sessionsPlayed, 1, 'stats apply even with the room gone');
assert.equal(aliceLadder.stats.ladder.sessions, 1, 'ladder applies from the snapshot even with the room gone');
assert.equal(
  aliceLadder.stats.ladder.rating,
  1000 + ladderRecord.ladderDelta,
  'applied rating matches the snapshotted delta (1000 base + snapshot)'
);

// ===== 11: bad admin token rejected =====
const badAuth = await adminPost({ action: 'list' }, 'wrong-token');
assert.equal(badAuth.status, 403, 'pending endpoint rejects a bad admin token');

console.log('anti-cheat review queue checks passed');
