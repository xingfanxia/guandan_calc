import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { findRoomPlayerByProfileHandle } from '../../api/players/[handle].js';

const legacyRoomPlayers = [
  { id: 1, profileHandle: 'legacy_alice' },
  { id: 2, handle: 'modern_bob' },
  { id: 3, handle: 'Mixed_Case' },
  { id: 4, profileHandle: 'session' },
  { id: 5, profileHandle: { nested: true } },
  { id: 6, handle: 'session', profileHandle: 'legacy_carol' },
  { id: 7, handle: '__proto__', profileHandle: 'legacy_dan' }
];

assert.equal(
  findRoomPlayerByProfileHandle(legacyRoomPlayers, 'legacy_alice')?.id,
  1,
  'host room auth should accept legacy room players stored with profileHandle'
);
assert.equal(
  findRoomPlayerByProfileHandle(legacyRoomPlayers, 'modern_bob')?.id,
  2,
  'host room auth should continue accepting modern room players stored with handle'
);
assert.equal(
  findRoomPlayerByProfileHandle(legacyRoomPlayers, 'mixed_case')?.id,
  3,
  'host room auth should compare profile handles case-insensitively'
);
assert.equal(
  findRoomPlayerByProfileHandle(legacyRoomPlayers, 'legacy_carol')?.id,
  6,
  'host room auth should fall back to legacy profileHandle when modern handle is a placeholder'
);
assert.equal(
  findRoomPlayerByProfileHandle(legacyRoomPlayers, 'legacy_dan')?.id,
  7,
  'host room auth should fall back to legacy profileHandle when modern handle is unsafe'
);
assert.equal(
  findRoomPlayerByProfileHandle(legacyRoomPlayers, 'session'),
  null,
  'session-only placeholder players should not authorize profile writes'
);
assert.equal(
  findRoomPlayerByProfileHandle(legacyRoomPlayers, '__proto__'),
  null,
  'unsafe object-prototype names should not authorize profile writes'
);

const controllerSource = readFileSync(new URL('../../src/controllers/gameControls.js', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const finalWinSource = readFileSync(new URL('../../src/controllers/finalWinSideEffects.js', import.meta.url), 'utf8');
const playerApiSource = readFileSync(new URL('../../api/players/[handle].js', import.meta.url), 'utf8');

function assertUsesFinalWinHelper(source, label) {
  assert.match(
    source,
    /handleFinalWinSideEffects/,
    `${label} should route final-win profile sync through the shared helper`
  );
}

assertUsesFinalWinHelper(controllerSource, 'gameControls');
assert.match(
  controllerSource,
  /await\s+handleFinalWinSideEffects/,
  'gameControls should wait for room sync before running final-win profile side effects'
);
assert.match(
  mainSource,
  /applyCalculatedRankingResult/,
  'main should route final-win profile sync through the shared apply workflow'
);
assert.doesNotMatch(
  mainSource,
  /syncProfileStats\(/,
  'main should not bypass the shared final-win side-effect helper with direct profile sync'
);

const callIndex = finalWinSource.indexOf('syncProfileStats(');
assert.notEqual(callIndex, -1, 'final-win helper should call syncProfileStats');
const callSource = finalWinSource.slice(callIndex, finalWinSource.indexOf(');', callIndex) + 2);
assert.match(
  callSource,
  /capturedRoomInfo\.authToken\s*\|\|\s*null/,
  'final-win helper should pass room host auth token to profile sync'
);
assert.match(
  playerApiSource,
  /findRoomPlayerByProfileHandle\(roomPlayers, handle\)/,
  'player stats API should use shared room-player handle matching for host auth and authoritative vote counts'
);

console.log('room profile sync auth checks passed');
