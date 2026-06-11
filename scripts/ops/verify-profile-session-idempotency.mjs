import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveGameProfileHistoryKey,
  deriveGameSessionKey,
  deriveVoteSessionKey
} from '../../shared/voteSessionKey.js';
import { initializePlayerStats } from '../../api/players/_utils.js';

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

const resetVoteRoom = {
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

const gameSessionKey = deriveGameSessionKey({
  roomCode: firstRoom.roomCode,
  gameStatus: firstRoom.state.gameStatus,
  history: firstRoom.state.history,
  finishedAt: firstRoom.finishedAt
});
const firstVoteSessionKey = deriveVoteSessionKey({
  roomCode: firstRoom.roomCode,
  gameStatus: firstRoom.state.gameStatus,
  history: firstRoom.state.history,
  finishedAt: firstRoom.finishedAt,
  endGameVotesHistory: firstRoom.endGameVotesHistory
});
const resetVoteSessionKey = deriveVoteSessionKey({
  roomCode: resetVoteRoom.roomCode,
  gameStatus: resetVoteRoom.state.gameStatus,
  history: resetVoteRoom.state.history,
  finishedAt: resetVoteRoom.finishedAt,
  endGameVotesHistory: resetVoteRoom.endGameVotesHistory
});

assert.ok(gameSessionKey, 'completed rooms should derive a game session key');
assert.notEqual(
  firstVoteSessionKey,
  resetVoteSessionKey,
  'vote windows should still get distinct vote session keys'
);
assert.equal(
  deriveGameProfileHistoryKey('ABC123', firstRoom),
  gameSessionKey,
  'first full-profile sync should use the completed game identity'
);
assert.equal(
  deriveGameProfileHistoryKey('ABC123', resetVoteRoom),
  gameSessionKey,
  'full-profile sync idempotency must not change when voting is reset'
);
assert.equal(
  deriveGameProfileHistoryKey('LOCAL', null, 'LOCAL:game:1:t1:2026-06-10T20%3A15%3A00.000Z'),
  'LOCAL:game:1:t1:2026-06-10T20%3A15%3A00.000Z',
  'local/non-room games should use a client-provided full-session key'
);

const playerApiSource = readFileSync(resolve(repoRoot, 'api/players/[handle].js'), 'utf8');
const playerClientSource = readFileSync(resolve(repoRoot, 'src/api/playerApi.js'), 'utf8');
const playerUtilsSource = readFileSync(resolve(repoRoot, 'api/players/_utils.js'), 'utf8');
const migrateModesSource = readFileSync(resolve(repoRoot, 'api/players/migrate-modes.js'), 'utf8');
const migrateSingleSource = readFileSync(resolve(repoRoot, 'api/players/migrate-single.js'), 'utf8');

const initializedStats = initializePlayerStats();
assert.deepEqual(
  initializedStats.sessionHistory,
  {},
  'fresh player stats should include completed-session idempotency history'
);
assert.match(
  playerApiSource,
  /player\.stats\.sessionHistory/,
  'player stats API should record completed profile sessions for idempotency'
);
assert.match(
  playerApiSource,
  /duplicateSessionIgnored/,
  'player stats API should explicitly short-circuit duplicate full-session updates'
);
assert.match(
  playerClientSource,
  /gameSessionKey,/,
  'syncProfileStats should send a completed-game session key alongside voteSessionKey'
);
assert.match(
  playerUtilsSource,
  /sessionHistory:\s*\{\}/,
  'initializePlayerStats should make sessionHistory part of the canonical stats shape'
);
assert.match(
  playerApiSource,
  /player\.stats\.sessionHistory\s*=\s*normalizeRecordMap\(player\.stats\.sessionHistory\)/,
  'player stats API should normalize existing migrated profiles through the shared record-map guard before duplicate checks'
);
assert.match(
  migrateModesSource,
  /player\.stats\.sessionHistory\s*=\s*normalizedSessionHistory/,
  'bulk mode migration should backfill malformed sessionHistory through the shared record-map guard'
);
assert.match(
  migrateSingleSource,
  /player\.stats\.sessionHistory\s*=\s*normalizedSessionHistory/,
  'single-player migration should backfill malformed sessionHistory through the shared record-map guard'
);

console.log('profile session idempotency checks passed');
