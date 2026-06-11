import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveVoteSessionKey,
  hasAlreadyVotedInSession,
  markVotedInSession
} from '../../src/share/voteSession.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

globalThis.window = {
  location: {
    origin: 'http://127.0.0.1:4173'
  }
};
globalThis.document = {
  getElementById() {
    return null;
  },
  addEventListener() {
    // no-op for module import checks
  }
};

const { resolveVotingWinner } = await import('../../src/share/votingManager.js');

class MemoryStorage {
  constructor(initial = {}) {
    this.values = { ...initial };
  }

  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.values, key)
      ? this.values[key]
      : null;
  }

  setItem(key, value) {
    this.values[key] = String(value);
  }
}

class ThrowingStorage {
  getItem() {
    throw new Error('storage unavailable');
  }

  setItem() {
    throw new Error('storage unavailable');
  }
}

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

const firstEpochKey = deriveVoteSessionKey({
  roomCode: 'ABC123',
  gameStatus: endedGame.gameStatus,
  history: [endedGame],
  endGameVotesHistory: []
});

const resetEpochKey = deriveVoteSessionKey({
  roomCode: 'ABC123',
  gameStatus: endedGame.gameStatus,
  history: [endedGame],
  endGameVotesHistory: [{ completedAt: '2026-06-10T20:16:00.000Z' }]
});

const legacyEndedGame = {
  ts: '2026-06-10 20:15:00',
  gameEndedAt: '2026-06-10T20:15:00.000Z',
  win: '蓝队',
  winKey: 't1',
  aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
};

const legacyEndedKey = deriveVoteSessionKey({
  roomCode: 'ABC123',
  gameStatus: {
    ended: false,
    winnerKey: null,
    winnerName: null,
    reason: null
  },
  history: [legacyEndedGame],
  endGameVotesHistory: []
});

assert.equal(
  legacyEndedKey,
  firstEpochKey,
  'vote session keys should use reconciled completed history when structured gameStatus is stale-open or absent'
);

assert.equal(
  deriveVoteSessionKey({
    roomCode: 'ABC123',
    history: [
      {
        win: '蓝队',
        winKey: 't1',
        aNote: '蓝队 在自己的A级胜方含末游，不通关，继续打到通关'
      }
    ],
    endGameVotesHistory: []
  }),
  null,
  'non-clearing A-level notes should not create a vote session key'
);

assert.notEqual(
  firstEpochKey,
  resetEpochKey,
  'host reset-vote should create a distinct local vote session key'
);

const storage = new MemoryStorage({
  gd_voted_rooms: JSON.stringify({ ABC123: true })
});

assert.equal(
  hasAlreadyVotedInSession(storage, firstEpochKey),
  false,
  'legacy room-level voted marker must not permanently block session-scoped votes'
);

markVotedInSession(storage, firstEpochKey);
assert.equal(
  hasAlreadyVotedInSession(storage, firstEpochKey),
  true,
  'marking a session should block only that exact voting window'
);
assert.equal(
  hasAlreadyVotedInSession(storage, resetEpochKey),
  false,
  'a reset voting window in the same room should allow the same device to vote again'
);

const blockedStorage = new ThrowingStorage();
assert.equal(
  hasAlreadyVotedInSession(blockedStorage, firstEpochKey),
  false,
  'storage read failures should not crash viewer vote checks'
);
assert.equal(
  markVotedInSession(blockedStorage, firstEpochKey),
  false,
  'storage write failures should not crash after a successful vote'
);

const secondGameKey = deriveVoteSessionKey({
  roomCode: 'ABC123',
  gameStatus: { ...endedGame.gameStatus, winnerKey: 't2', winnerName: '红队' },
  history: [
    { ...endedGame },
    {
      ...endedGame,
      ts: '2026-06-10 21:00:00',
      gameEndedAt: '2026-06-10T21:00:00.000Z',
      winKey: 't2',
      gameStatus: { ended: true, winnerKey: 't2', winnerName: '红队', reason: 'A_LEVEL_CLEARED' }
    }
  ],
  endGameVotesHistory: []
});

assert.notEqual(
  firstEpochKey,
  secondGameKey,
  'a later completed game in the same room should use a new vote session key'
);

assert.deepEqual(
  resolveVotingWinner(
    {
      ended: true,
      winnerKey: 't1',
      winnerName: '蓝队',
      reason: 'A_LEVEL_CLEARED'
    },
    [
      {
        ts: '2026-06-10 20:15:00',
        gameStatus: {
          ended: true,
          winnerKey: 't1',
          winnerName: '蓝队',
          reason: 'A_LEVEL_CLEARED'
        }
      }
    ]
  ),
  { winKey: 't1', winName: '蓝队' },
  'viewer voting winner should come from reconciled structured gameStatus even when latest history lacks winKey'
);

assert.equal(
  resolveVotingWinner(null, [
    {
      win: '蓝队',
      aNote: '蓝队 A级通关（胜方无末游，在自己的A级）'
    }
  ]),
  null,
  'viewer voting winner should not invent a winner for ambiguous legacy clear history'
);

const votingManagerSource = readFileSync(resolve(repoRoot, 'src/share/votingManager.js'), 'utf8');
const unlockStart = votingManagerSource.indexOf('export function unlockViewerVoting');
const unlockEnd = votingManagerSource.indexOf('/**\n * Show end-game voting UI for viewers', unlockStart);
const unlockSource = votingManagerSource.slice(unlockStart, unlockEnd);
const showVotingStart = votingManagerSource.indexOf('export function showEndGameVotingForViewers');
const showVotingEnd = votingManagerSource.indexOf("onEvent('game:victoryForVoting'", showVotingStart);
const showVotingSource = votingManagerSource.slice(showVotingStart, showVotingEnd);
assert.equal(
  votingManagerSource.includes('votedRooms[roomCode] === true'),
  false,
  'voting manager should not use permanent room-level voted markers'
);
assert.ok(
  unlockSource.indexOf("const votingCard = document.getElementById('viewerVotingCard');") <
    unlockSource.indexOf('votingUnlocked = true;'),
  'viewer voting should not mark itself unlocked before the voting card exists'
);
assert.ok(
  unlockSource.includes('resolveVotingWinner(state.getGameStatus(), history)'),
  'viewer voting card should render the winner section from reconciled gameStatus/history'
);
assert.ok(
  showVotingSource.includes('resolveVotingWinner(state.getGameStatus(), history)'),
  'viewer voting winner display should use reconciled gameStatus/history'
);
assert.ok(
  votingManagerSource.includes('normalizeTeamNumber'),
  'viewer voting should normalize player team values before selecting winning-team players'
);
assert.equal(
  /p\.team\s*===\s*winningTeamNum/.test(votingManagerSource),
  false,
  'viewer voting should not use strict numeric team comparisons on raw player.team'
);
assert.equal(
  votingManagerSource.includes('latestGame.winKey'),
  false,
  'viewer voting should not read raw latest history winKey when structured gameStatus may be authoritative'
);
assert.ok(
  votingManagerSource.includes("onEvent('room:dataLoaded'"),
  'viewer voting state should track room data updates so reset-vote can reopen the UI'
);
assert.ok(
  votingManagerSource.includes('volatileFingerprint'),
  'viewer fingerprint generation should keep an in-memory fallback when localStorage is unavailable'
);
assert.ok(
  votingManagerSource.includes('resetViewerVotingState'),
  'viewer voting UI should be able to relock when a host reset or rollback opens the game'
);
assert.ok(
  votingManagerSource.includes("votingCard.querySelector('#viewerVoteResultsContainer, .viewer-vote-results')") &&
    votingManagerSource.includes('if (!resultsDiv)') &&
    votingManagerSource.includes('viewer-vote-results'),
  'viewer vote results rendering should reuse a stable result container for idempotent refreshes'
);

const resetVoteSource = readFileSync(resolve(repoRoot, 'api/rooms/reset-vote/[code].js'), 'utf8');
assert.ok(
  resetVoteSource.includes('lastUpdated = completedAt'),
  'reset-vote should bump room.lastUpdated so viewers poll and receive the new vote epoch'
);

const voteSessionKeySource = readFileSync(resolve(repoRoot, 'shared/voteSessionKey.js'), 'utf8');
assert.ok(
  voteSessionKeySource.includes('resolveGameStatus') &&
    voteSessionKeySource.includes('getHistoryEntries'),
  'vote session keys should use the same completed-game reconciliation as room state'
);
assert.equal(
  voteSessionKeySource.includes('gameStatus?.ended || latestGame?.gameStatus?.ended'),
  false,
  'vote session keys should not use a narrower ended-state check than the rest of the app'
);

const roomManagerSource = readFileSync(resolve(repoRoot, 'src/share/roomManager.js'), 'utf8');
const joinRoomStart = roomManagerSource.indexOf('export async function joinRoom');
const joinRoomEnd = roomManagerSource.indexOf('/**\n * Load room data into local state', joinRoomStart);
const joinRoomSource = roomManagerSource.slice(joinRoomStart, joinRoomEnd);
assert.ok(
  joinRoomSource.indexOf('currentRoomCode = normalizedRoomCode') < joinRoomSource.indexOf('loadRoomData(roomData)'),
  'joinRoom should set room mode before loadRoomData so initial room events see viewer/host status'
);

const loadRoomStart = roomManagerSource.indexOf('function loadRoomData');
const loadRoomEnd = roomManagerSource.indexOf('/**\n * Sync current game state to room', loadRoomStart);
const loadRoomSource = roomManagerSource.slice(loadRoomStart, loadRoomEnd);
const victoryEventIndex = loadRoomSource.indexOf("emit('game:victoryForVoting'");
assert.ok(victoryEventIndex > 0, 'loadRoomData should emit the voting victory event for completed rooms');
[
  ['state.setPlayers', 'players'],
  ['state.setPlayerStats', 'player stats'],
  ['state.setCurrentRanking', 'current ranking'],
  ['roomFinishedAt =', 'room finished metadata'],
  ["emit('room:dataLoaded'", 'room data loaded event']
].forEach(([needle, label]) => {
  const index = loadRoomSource.indexOf(needle);
  assert.ok(index > 0, `loadRoomData should hydrate ${label}`);
  assert.ok(
    index < victoryEventIndex,
    `loadRoomData should hydrate ${label} before victory voting unlocks`
  );
});

console.log('voting session state checks passed');
