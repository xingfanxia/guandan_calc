import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeGameStatsUpdate } from '../../api/players/[handle].js';
import { validateHandle } from '../../api/players/_utils.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function validPayload(overrides = {}) {
  return {
    roomCode: 'LOCAL',
    ranking: 2.5,
    team: 1,
    gamesInSession: 12,
    sessionDuration: 3600,
    firstPlaces: 3,
    lastPlaces: 1,
    relativeRank: 2,
    gameSessionKey: 'LOCAL:game:1:t1:2026-06-10T20%3A15%3A00.000Z',
    mode: '6P',
    ...overrides
  };
}

[
  [{ roomCode: 'bad<script>' }, 'roomCode'],
  [{ roomCode: 'ABC12' }, 'roomCode'],
  [{ roomCode: 'A'.repeat(501) }, 'roomCode'],
  [{ mode: undefined }, 'mode'],
  [{ ranking: 'bad' }, 'ranking'],
  [{ ranking: 0 }, 'ranking'],
  [{ mode: '4P', ranking: 5 }, 'ranking'],
  [{ mode: '6P', ranking: 7 }, 'ranking'],
  [{ team: 3 }, 'team'],
  [{ team: 0 }, 'team'],
  [{ gamesInSession: -5 }, 'gamesInSession'],
  [{ gamesInSession: 1.5 }, 'gamesInSession'],
  [{ sessionDuration: -1 }, 'sessionDuration'],
  [{ sessionDuration: '   ' }, 'sessionDuration'],
  [{ firstPlaces: -1 }, 'firstPlaces'],
  [{ firstPlaces: '' }, 'firstPlaces'],
  [{ lastPlaces: 20 }, 'lastPlaces'],
  [{ lastPlaces: '   ' }, 'lastPlaces'],
  [{ gamesInSession: 2, firstPlaces: 2, lastPlaces: 1 }, 'firstPlaces'],
  [{ relativeRank: 9 }, 'relativeRank'],
  [{ mode: '4P', relativeRank: 5 }, 'relativeRank'],
  [{ mode: '6P', relativeRank: 7 }, 'relativeRank'],
  [{ mode: '10P' }, 'mode'],
  [{ teamWon: 'false' }, 'teamWon'],
  [{ votedMVP: 'true' }, 'votedMVP'],
  [{ votedBurden: 1 }, 'votedBurden'],
  [{ mvpVoteCount: '' }, 'mvpVoteCount'],
  [{ mvpVoteCount: '   ' }, 'mvpVoteCount'],
  [{ mvpVoteCount: -1 }, 'mvpVoteCount'],
  [{ mvpVoteCount: 1.5 }, 'mvpVoteCount'],
  [{ mvpVoteCount: 1001 }, 'mvpVoteCount'],
  [{ burdenVoteCount: '' }, 'burdenVoteCount'],
  [{ burdenVoteCount: '   ' }, 'burdenVoteCount'],
  [{ burdenVoteCount: -1 }, 'burdenVoteCount'],
  [{ burdenVoteCount: 1.5 }, 'burdenVoteCount'],
  [{ burdenVoteCount: 1001 }, 'burdenVoteCount'],
  [{ teammates: 'alice' }, 'teammates'],
  [{ opponents: ['bob', '__proto__'] }, 'opponents'],
  [{ teammates: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'] }, 'teammates'],
  [{ gameSessionKey: '' }, 'gameSessionKey'],
  [{ gameSessionKey: '   ' }, 'gameSessionKey'],
  [{ voteSessionKey: '' }, 'voteSessionKey'],
  [{ voteSessionKey: '   ' }, 'voteSessionKey'],
  [{ gameSessionKey: 'x'.repeat(501) }, 'gameSessionKey'],
  [{ voteSessionKey: 'x'.repeat(501) }, 'voteSessionKey'],
  [{ gameSessionKey: '__proto__' }, 'gameSessionKey'],
  [{ voteSessionKey: '__proto__' }, 'voteSessionKey'],
  [{ gameSessionKey: 'constructor' }, 'gameSessionKey'],
  [{ voteSessionKey: 'prototype' }, 'voteSessionKey'],
  [{ honorsEarned: '吕布' }, 'honorsEarned'],
  [{ honorsEarned: ['吕布', '__proto__'] }, 'honorsEarned'],
  [{ honorsEarned: Array(17).fill('吕布') }, 'honorsEarned']
].forEach(([overrides, field]) => {
  const result = normalizeGameStatsUpdate(validPayload(overrides));
  assert.equal(result.ok, false, `${field} should be rejected when invalid`);
  assert.match(result.error, new RegExp(field), `${field} rejection should mention the field`);
});

const normalized = normalizeGameStatsUpdate(validPayload({
  ranking: '2.5',
  team: '2',
  gamesInSession: '8',
  sessionDuration: '90',
  firstPlaces: '2',
  lastPlaces: '0',
  relativeRank: '3'
}));

assert.equal(normalized.ok, true);
assert.equal(normalized.data.ranking, 2.5);
assert.equal(normalized.data.team, 2);
assert.equal(normalized.data.gamesInSession, 8);
assert.equal(normalized.data.sessionDuration, 90);
assert.equal(normalized.data.firstPlaces, 2);
assert.equal(normalized.data.lastPlaces, 0);
assert.equal(normalized.data.relativeRank, 3);

const normalizedRoomCodes = normalizeGameStatsUpdate(validPayload({
  roomCode: ' abc123 '
}));
assert.equal(normalizedRoomCodes.ok, true);
assert.equal(
  normalizedRoomCodes.data.roomCode,
  'ABC123',
  'profile stats updates should normalize real room codes before storing profile history'
);

const normalizedLocalRoomCode = normalizeGameStatsUpdate(validPayload({
  roomCode: ' local '
}));
assert.equal(normalizedLocalRoomCode.ok, true);
assert.equal(
  normalizedLocalRoomCode.data.roomCode,
  'LOCAL',
  'profile stats updates should normalize local sessions to the canonical LOCAL room code'
);

const missingFullSessionKey = normalizeGameStatsUpdate(validPayload({
  gameSessionKey: undefined
}));
assert.equal(
  missingFullSessionKey.ok,
  false,
  'full-session profile stats updates should require a gameSessionKey for idempotency'
);
assert.match(missingFullSessionKey.error, /gameSessionKey/);

const withRelations = normalizeGameStatsUpdate(validPayload({
  teammates: [' Alice ', 'bob', 'alice'],
  opponents: ['Carol_1', 'dave2'],
  teamWon: true,
  votedMVP: false,
  votedBurden: true,
  gameSessionKey: 'ABC123:game:1:t1:ended',
  voteSessionKey: 'ABC123:vote:1:t1:ended:0'
}));

assert.equal(withRelations.ok, true);
assert.deepEqual(withRelations.data.teammates, ['alice', 'bob']);
assert.deepEqual(withRelations.data.opponents, ['carol_1', 'dave2']);
assert.equal(withRelations.data.teamWon, true);
assert.equal(withRelations.data.votedMVP, false);
assert.equal(withRelations.data.votedBurden, true);

const withVoteCounts = normalizeGameStatsUpdate(validPayload({
  mvpVoteCount: '2',
  burdenVoteCount: 0
}));

assert.equal(withVoteCounts.ok, true);
assert.equal(
  withVoteCounts.data.mvpVoteCount,
  2,
  'profile stats updates should normalize explicit MVP vote counts before applying vote deltas'
);
assert.equal(
  withVoteCounts.data.burdenVoteCount,
  0,
  'profile stats updates should preserve explicit zero burden vote counts'
);

const withTrimmedSessionKeys = normalizeGameStatsUpdate(validPayload({
  gameSessionKey: ' ABC123:game:1:t1:ended ',
  voteSessionKey: ' ABC123:vote:1:t1:ended:0 '
}));

assert.equal(withTrimmedSessionKeys.ok, true);
assert.equal(
  withTrimmedSessionKeys.data.gameSessionKey,
  'ABC123:game:1:t1:ended',
  'profile stats session keys should be trimmed before idempotency checks'
);
assert.equal(
  withTrimmedSessionKeys.data.voteSessionKey,
  'ABC123:vote:1:t1:ended:0',
  'profile vote session keys should be trimmed before voting history checks'
);

const withHonors = normalizeGameStatsUpdate(validPayload({
  honorsEarned: ['吕布', '抗压王', '吕布', '连胜王', '连段王']
}));

assert.equal(withHonors.ok, true);
assert.deepEqual(
  withHonors.data.honorsEarned,
  ['吕布', '抗压王', '连段王'],
  'honorsEarned should accept current and legacy honor titles, canonicalize them, and de-duplicate before stats mutation'
);

const voteOnly = normalizeGameStatsUpdate(validPayload({
  mode: 'VOTE_ONLY',
  ranking: 0,
  gamesInSession: 0,
  firstPlaces: 0,
  lastPlaces: 0,
  relativeRank: undefined,
  team: '1'
}));

assert.equal(voteOnly.ok, true);
assert.equal(voteOnly.data.ranking, 0);
assert.equal(voteOnly.data.gamesInSession, 0);
assert.equal(voteOnly.data.team, 1);

assert.equal(validateHandle('__proto__'), false);
assert.equal(validateHandle('constructor'), false);
assert.equal(validateHandle('prototype'), false);
assert.equal(validateHandle('valid_handle'), true);

const playerHandlerSource = readFileSync(resolve(repoRoot, 'api/players/[handle].js'), 'utf8');
assert.ok(
  playerHandlerSource.includes('normalizeGameStatsUpdate(requestData)'),
  'player stats handler should use normalized validated stats input before mutating profile stats'
);
assert.ok(
  playerHandlerSource.includes('normalizeHandleList'),
  'player stats handler should sanitize relation handles before using them as object keys'
);
assert.equal(
  playerHandlerSource.includes("gameResult.mode || '8P'"),
  false,
  'player stats handler should not silently store missing full-session modes as 8P'
);

console.log('player stats input validation checks passed');
