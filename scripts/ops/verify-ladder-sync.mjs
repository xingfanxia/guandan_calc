/**
 * D5 web 天梯冻结回归：正常战绩仍入库，但 live/admin/pending replay 都不得再
 * 改 rating/peak/sessions/ladderHistory；页面必须明确旧分与小程序不互通、已停更。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hashToken, initializePlayerStats } from '../../api/players/_utils.js';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';
// Admin-authorize the PUT so it bypasses the anti-cheat review queue and exercises
// the same stats path an approved pending session replays.
process.env.ADMIN_TOKEN ||= 'ladder-sync-admin-secret';

const ownerToken = 'room-host-token';

// Alice 已有旧版 web 分；冻结后必须逐字段保持不变。
const aliceWeb = { sessionsPlayed: 18, sessionsWon: 13, avgRankingPerSession: 3.2 };

function playerWith(handle, { web = {}, ladder } = {}) {
  const stats = initializePlayerStats();
  Object.assign(stats, web);
  if (ladder) stats.ladder = ladder;
  return {
    id: `PLR_${handle.toUpperCase()}`,
    handle,
    displayName: handle,
    emoji: handle[0].toUpperCase(),
    playStyle: 'steady',
    tagline: '',
    ownershipTokenHash: '',
    stats,
    recentGames: [],
    achievements: [],
    createdAt: '2026-06-10T10:00:00.000Z',
    lastActiveAt: '2026-06-10T10:00:00.000Z'
  };
}

// Other participants already ranked (sessions>0) so their frozen ratings are explicit.
const profiles = {
  alice: playerWith('alice', { web: aliceWeb, ladder: { rating: 1088, sessions: 7, peak: 1120 } }),
  bob: playerWith('bob', { ladder: { rating: 1000, sessions: 4, peak: 1020 } }),
  carol: playerWith('carol', { ladder: { rating: 1100, sessions: 6, peak: 1120 } }),
  dave: playerWith('dave', { ladder: { rating: 1050, sessions: 5, peak: 1060 } })
};
// Distinct from the room host token — real-room stats require the host bearer,
// and a collision would route through the owner path instead.
profiles.alice.ownershipTokenHash = await hashToken('alice-distinct-owner-token');

const room = {
  roomCode: 'LADDR1',
  authToken: ownerToken,
  settings: {},
  state: {
    gameStatus: { ended: true, winnerKey: 't1', winnerName: '蓝队', reason: 'A_LEVEL_CLEARED' },
    history: [{
      ts: '2026-06-10 20:15:00',
      gameEndedAt: '2026-06-10T20:15:00.000Z',
      winKey: 't1',
      gameStatus: { ended: true, winnerKey: 't1', winnerName: '蓝队', reason: 'A_LEVEL_CLEARED' }
    }]
  },
  finishedAt: '2026-06-10T20:15:00.000Z',
  players: [
    { id: 1, handle: 'alice', name: 'alice', team: 1 },
    { id: 2, handle: 'bob', name: 'bob', team: 2 },
    { id: 3, handle: 'carol', name: 'carol', team: 1 },
    { id: 4, handle: 'dave', name: 'dave', team: 2 }
  ],
  playerStats: {
    1: { games: 10, totalRank: 25 }, // alice avg 2.5
    2: { games: 10, totalRank: 35 }, // bob   avg 3.5
    3: { games: 10, totalRank: 28 }, // carol avg 2.8
    4: { games: 10, totalRank: 32 }  // dave  avg 3.2
  },
  endGameVotes: { mvp: {}, burden: {}, fingerprints: [] },
  endGameVotesHistory: [],
  createdAt: '2026-06-10T10:00:00.000Z'
};

const frozenLadder = structuredClone(profiles.alice.stats.ladder);

let savedAlice = null;
const writes = [];

globalThis.fetch = async (url, options = {}) => {
  assert.ok(String(url).endsWith('/pipeline'), 'ladder sync test should only hit the mocked KV pipeline');
  const commands = JSON.parse(options.body || '[]');
  return new Response(JSON.stringify(commands.map(command => {
    const [operation, key, ...args] = command;
    const op = String(operation).toLowerCase();
    if (op === 'get') {
      if (key === `room:${room.roomCode}`) return { result: JSON.stringify(room) };
      const handle = key.startsWith('player:') ? key.slice('player:'.length) : null;
      if (handle && profiles[handle]) {
        return { result: JSON.stringify(handle === 'alice' && savedAlice ? savedAlice : profiles[handle]) };
      }
      return { result: null };
    }
    if (op === 'set') {
      writes.push(key);
      assert.equal(key, 'player:alice', `stats application must write ONLY the target profile, not ${key}`);
      savedAlice = JSON.parse(args[0]);
      return { result: 'OK' };
    }
    throw new Error(`Unexpected KV command: ${op} ${key}`);
  })), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const { default: handler } = await import('../../api/players/[handle].js');

function putAlice() {
  return handler(new Request('https://example.test/api/players/alice', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      adminToken: process.env.ADMIN_TOKEN,  // bypass review queue → test apply path
      roomCode: room.roomCode,
      mode: '4P',
      ranking: 2.5,
      relativeRank: 1,
      team: 1,
      teamWon: true,
      gamesInSession: 10,
      gameSessionKey: 'client-fallback-key',
      teammates: ['carol'],
      opponents: ['bob', 'dave'],
      honorsEarned: []
    })
  }));
}

// First sync — stats applies, ladder stays frozen.
const res1 = await putAlice();
assert.equal(res1.status, 200, await res1.text());
assert.ok(savedAlice, 'alice profile should be written');
assert.deepEqual(
  savedAlice.stats.ladder,
  frozenLadder,
  'frozen web ladder must preserve rating/sessions/peak exactly'
);
assert.deepEqual(savedAlice.stats.ladderHistory, {}, 'freeze must not append ladderHistory');
assert.equal(savedAlice.stats.sessionsPlayed, 19, 'career stats must continue after ladder freeze');
assert.ok(writes.every(k => k === 'player:alice'), 'only the target profile was written (no clobber of other participants)');

// Second sync (same session) — session idempotency remains, ladder still exact.
const res2 = await putAlice();
assert.equal(res2.status, 200, await res2.text());
assert.deepEqual(
  savedAlice.stats.ladder,
  frozenLadder,
  're-syncing the same session must not move frozen ladder state'
);
assert.deepEqual(savedAlice.stats.ladderHistory, {}, 'no ladder history may appear on retry');
assert.equal(savedAlice.stats.sessionsPlayed, 19, 'duplicate session must not double-apply career stats');

const statsSource = readFileSync(new URL('../../api/players/[handle].js', import.meta.url), 'utf8');
const pendingSource = readFileSync(new URL('../../api/players/_pending.js', import.meta.url), 'utf8');
const approvalSource = readFileSync(new URL('../../api/players/pending.js', import.meta.url), 'utf8');
const playersPage = readFileSync(new URL('../../players.html', import.meta.url), 'utf8');
const profilePage = readFileSync(new URL('../../player-profile.html', import.meta.url), 'utf8');

assert.match(statsSource, /WEB LADDER FREEZE · 2026-08-10/);
assert.doesNotMatch(statsSource, /applyLadderForSession|computeSessionLadderDelta/, 'no settlement helper may remain callable');
assert.doesNotMatch(pendingSource, /record\.ladderDelta|ladderDelta\s*\}/, 'new pending records must not snapshot ladder deltas');
assert.doesNotMatch(approvalSource, /_pendingLadderDelta/, 'legacy pending deltas must not be replayed');
for (const page of [playersPage, profilePage]) {
  assert.match(page, /与小程序.*不互通/);
  assert.match(page, /已停更/);
}

console.log('web ladder freeze checks passed');
