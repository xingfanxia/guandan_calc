/**
 * Ladder application inside the per-player PUT (api/players/[handle].js).
 * Verifies: first session seeds from web history, the applied delta matches the
 * pure shared/ladderLogic computation over frozen ratings, idempotency per
 * session key, and that ONLY the target profile is written (other participants
 * are read-only — no cross-profile clobber).
 */
import assert from 'node:assert/strict';
import { hashToken, initializePlayerStats } from '../../api/players/_utils.js';
import { computeLadderDeltas, seedLadderRating, applyLadderDelta } from '../../shared/ladderLogic.js';

process.env.KV_REST_API_URL ||= 'https://kv.example.test';
process.env.KV_REST_API_TOKEN ||= 'test-kv-token';

const ownerToken = 'room-host-token';

// alice: strong web history, never ranked on the ladder → seeds on first session.
const aliceWeb = { sessionsPlayed: 18, sessionsWon: 13, avgRankingPerSession: 3.2 };
const aliceSeed = seedLadderRating(aliceWeb);
assert.ok(aliceSeed > 1050, `precondition: alice should seed above 1000 (got ${aliceSeed})`);

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
  alice: playerWith('alice', { web: aliceWeb }),
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

// Independent expectation: the pure algorithm over the same frozen ratings.
const expectedDeltas = computeLadderDeltas({
  mode: 4,
  winnerTeam: 1,
  players: [
    { id: '1', team: 1, rating: aliceSeed, avgRanking: 2.5 },
    { id: '2', team: 2, rating: 1000, avgRanking: 3.5 },
    { id: '3', team: 1, rating: 1100, avgRanking: 2.8 },
    { id: '4', team: 2, rating: 1050, avgRanking: 3.2 }
  ]
});
const expectedAliceDelta = expectedDeltas.get('1');
const expectedAliceLadder = applyLadderDelta({ rating: aliceSeed, sessions: 0, peak: aliceSeed }, expectedAliceDelta);

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
      assert.equal(key, 'player:alice', `ladder application must write ONLY the target profile, not ${key}`);
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

// First sync — seeds + applies the delta.
const res1 = await putAlice();
assert.equal(res1.status, 200, await res1.text());
assert.ok(savedAlice, 'alice profile should be written');
assert.deepEqual(
  savedAlice.stats.ladder,
  expectedAliceLadder,
  `ladder should seed from web history then apply the pure delta (expected ${JSON.stringify(expectedAliceLadder)})`
);
assert.equal(savedAlice.stats.ladder.sessions, 1, 'first ladder session → sessions=1');
const ladderHistoryKeys = Object.keys(savedAlice.stats.ladderHistory);
assert.equal(ladderHistoryKeys.length, 1, 'one ladder session recorded');
assert.equal(
  savedAlice.stats.ladderHistory[ladderHistoryKeys[0]],
  expectedAliceDelta,
  'ladderHistory should record the applied delta for the session key'
);
assert.ok(writes.every(k => k === 'player:alice'), 'only the target profile was written (no clobber of other participants)');

// Second sync (same session) — idempotent, no double application.
const ladderAfterFirst = { ...savedAlice.stats.ladder };
const res2 = await putAlice();
assert.equal(res2.status, 200, await res2.text());
assert.deepEqual(
  savedAlice.stats.ladder,
  ladderAfterFirst,
  're-syncing the same session must not move the ladder rating'
);
assert.equal(Object.keys(savedAlice.stats.ladderHistory).length, 1, 'no extra ladder session on re-sync');

console.log('ladder sync (per-player application) checks passed');
