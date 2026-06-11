import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveVoteProfileHistoryKey,
  deriveVoteSessionKey
} from '../../shared/voteSessionKey.js';
import { normalizeProfileVoteCount } from '../../api/players/[handle].js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const endedGame = {
  ts: '2026-06-10 20:15:00',
  gameEndedAt: '2026-06-10T20:15:00.000Z',
  winKey: 't1',
  gameStatus: {
    ended: true,
    winnerKey: 't1',
    winnerName: '蓝队',
    reason: 'A_LEVEL_CLEARED'
  }
};

const firstRoom = {
  roomCode: 'ABC123',
  state: {
    gameStatus: endedGame.gameStatus,
    history: [endedGame]
  },
  finishedAt: '2026-06-10T20:15:00.000Z',
  endGameVotesHistory: []
};

const resetRoom = {
  ...firstRoom,
  endGameVotesHistory: [
    {
      mvp: { 1: 2 },
      burden: { 2: 1 },
      fingerprints: ['fp-a'],
      completedAt: '2026-06-10T20:16:00.000Z'
    }
  ]
};

const legacyEndedRoom = {
  roomCode: 'ABC123',
  state: {
    gameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    },
    history: [
      {
        ts: endedGame.ts,
        gameEndedAt: endedGame.gameEndedAt,
        win: '蓝队',
        winKey: 't1',
        aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
      }
    ]
  },
  finishedAt: '2026-06-10T20:15:00.000Z',
  endGameVotesHistory: []
};

const legacyHistEndedRoom = {
  ...legacyEndedRoom,
  state: {
    gameStatus: legacyEndedRoom.state.gameStatus,
    hist: legacyEndedRoom.state.history
  }
};

const firstSessionKey = deriveVoteSessionKey({
  roomCode: firstRoom.roomCode,
  gameStatus: firstRoom.state.gameStatus,
  history: firstRoom.state.history,
  finishedAt: firstRoom.finishedAt,
  endGameVotesHistory: firstRoom.endGameVotesHistory
});
const resetSessionKey = deriveVoteSessionKey({
  roomCode: resetRoom.roomCode,
  gameStatus: resetRoom.state.gameStatus,
  history: resetRoom.state.history,
  finishedAt: resetRoom.finishedAt,
  endGameVotesHistory: resetRoom.endGameVotesHistory
});

assert.notEqual(firstSessionKey, resetSessionKey);

assert.equal(
  deriveVoteProfileHistoryKey('ABC123', firstRoom, {}),
  firstSessionKey,
  'new profile vote syncs should use a session-scoped history key'
);
assert.equal(
  deriveVoteProfileHistoryKey('ABC123', legacyEndedRoom, {}),
  firstSessionKey,
  'legacy completed room histories should still derive session-scoped profile vote keys'
);
assert.equal(
  deriveVoteProfileHistoryKey('ABC123', legacyHistEndedRoom, {}),
  firstSessionKey,
  'legacy hist-only completed rooms should still derive session-scoped profile vote keys'
);
assert.equal(
  deriveVoteProfileHistoryKey('ABC123', resetRoom, {}),
  resetSessionKey,
  'reset vote windows in the same room should not overwrite the previous profile vote history'
);
assert.equal(
  deriveVoteProfileHistoryKey('ABC123', firstRoom, { ABC123: { mvp: 2, burden: 0 } }),
  'ABC123',
  'first-epoch sync should preserve legacy roomCode keys to avoid double-counting old data'
);
assert.equal(
  deriveVoteProfileHistoryKey('ABC123', resetRoom, { ABC123: { mvp: 2, burden: 0 } }),
  resetSessionKey,
  'later vote epochs should never reuse the legacy roomCode key'
);
assert.equal(
  deriveVoteProfileHistoryKey('LOCAL', null, {}),
  'LOCAL',
  'local/non-room games should keep the existing roomCode history key'
);
assert.equal(
  deriveVoteProfileHistoryKey('LOCAL', null, {}, 'LOCAL:vote:1:t1:2026-06-10T20%3A15%3A00.000Z:0'),
  'LOCAL:vote:1:t1:2026-06-10T20%3A15%3A00.000Z:0',
  'local/non-room games should use a client-provided session key when owner-auth is the only authority'
);

assert.equal(normalizeProfileVoteCount(undefined, true), 1);
assert.equal(normalizeProfileVoteCount(undefined, false), 0);
assert.equal(normalizeProfileVoteCount('3', false), 3);
assert.equal(normalizeProfileVoteCount(0, true), 0);
assert.equal(normalizeProfileVoteCount(-1, true), 0);
assert.equal(normalizeProfileVoteCount('bad', true), 0);
assert.equal(normalizeProfileVoteCount(1.5, false), 0);
assert.equal(
  normalizeProfileVoteCount(1001, false),
  0,
  'profile vote counts above the room fingerprint cap should be invalid instead of inflating lifetime stats'
);

const playerApiSource = readFileSync(resolve(repoRoot, 'api/players/[handle].js'), 'utf8');
const playerClientSource = readFileSync(resolve(repoRoot, 'src/api/playerApi.js'), 'utf8');
assert.ok(
  playerApiSource.includes('deriveVoteProfileHistoryKey'),
  'player stats API should derive profile voting history keys from authoritative room state'
);
assert.ok(
  playerApiSource.includes('gameResult.voteSessionKey'),
  'player stats API should only use a client voteSessionKey as a non-room fallback'
);
assert.ok(
  playerClientSource.includes('deriveVoteSessionKey'),
  'syncProfileStats should derive a local vote session key from the completed history entry'
);
assert.ok(
  playerClientSource.includes('voteSessionKey,'),
  'syncProfileStats should send the local vote session key with profile updates'
);
assert.equal(
  playerApiSource.includes('player.stats.votingHistory[roomCode]'),
  false,
  'player stats API should not hard-code roomCode as the vote history key'
);

console.log('profile vote session history checks passed');
