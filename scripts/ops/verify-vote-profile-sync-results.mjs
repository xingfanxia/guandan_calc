import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = {
  location: {
    origin: 'http://localhost'
  }
};

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

const {
  buildPlayerVoteTotals,
  syncVotingToProfiles,
  summarizeVoteProfileUpdateResults
} = await import('../../src/share/votingSync.js');
const { getPlayerProfileHandle } = await import('../../src/api/playerApi.js');

assert.deepEqual(
  summarizeVoteProfileUpdateResults([]),
  {
    success: true,
    totalPlayersSynced: 0,
    failedPlayers: 0
  },
  'no eligible profile players should remain a harmless no-op'
);

assert.deepEqual(
  summarizeVoteProfileUpdateResults([{ success: true }, { success: true }]),
  {
    success: true,
    totalPlayersSynced: 2,
    failedPlayers: 0
  },
  'all successful profile writes should return success'
);

assert.deepEqual(
  summarizeVoteProfileUpdateResults([{ success: false }, { success: false }]),
  {
    success: false,
    reason: 'profile_update_failed',
    totalPlayersSynced: 0,
    failedPlayers: 2
  },
  'all failed profile writes should not be reported as a successful sync'
);

assert.deepEqual(
  summarizeVoteProfileUpdateResults([{ success: true }, { success: false }]),
  {
    success: false,
    reason: 'partial_profile_update_failed',
    totalPlayersSynced: 1,
    failedPlayers: 1
  },
  'partial profile write failures should be visible to the caller'
);

assert.deepEqual(
  buildPlayerVoteTotals({
    success: true,
    votes: {
      mvp: {
        1: '2',
        2: '<img src=x onerror=alert(1)>',
        3: -1,
        bad: 1
      },
      burden: {
        1: '1',
        4: 1.5,
        5: null
      }
    }
  }),
  {
    1: { mvp: 2, burden: 1 }
  },
  'profile voting sync should only use sanitized positive integer vote counts'
);

assert.equal(
  getPlayerProfileHandle({ profileHandle: 'Legacy_Alice' }),
  'legacy_alice',
  'client profile sync should accept legacy profileHandle players loaded from older room snapshots'
);
assert.equal(
  getPlayerProfileHandle({ handle: 'Modern_Bob', profileHandle: 'legacy_bob' }),
  'modern_bob',
  'client profile sync should prefer modern handle over legacy profileHandle'
);
assert.equal(
  getPlayerProfileHandle({ handle: 'session', profileHandle: 'Legacy_Alice' }),
  'legacy_alice',
  'client profile sync should fall back to legacy profileHandle when modern handle is a placeholder'
);
assert.equal(
  getPlayerProfileHandle({ handle: '__proto__', profileHandle: 'Legacy_Alice' }),
  'legacy_alice',
  'client profile sync should fall back to legacy profileHandle when modern handle is unsafe'
);
assert.equal(
  getPlayerProfileHandle({ profileHandle: 'session' }),
  null,
  'client profile sync should skip session-only placeholders'
);
assert.equal(
  getPlayerProfileHandle({ profileHandle: '__proto__' }),
  null,
  'client profile sync should skip unsafe reserved profile handles'
);

const playerApiSource = await import('node:fs').then(fs =>
  fs.readFileSync(new URL('../../src/api/playerApi.js', import.meta.url), 'utf8')
);
const votingSyncSource = await import('node:fs').then(fs =>
  fs.readFileSync(new URL('../../src/share/votingSync.js', import.meta.url), 'utf8')
);
assert.match(
  playerApiSource,
  /const playerHandle = getPlayerProfileHandle\(player\)/,
  'full-session profile sync should resolve handles through the shared client helper'
);
assert.match(
  playerApiSource,
  /map\(getPlayerProfileHandle\)\.filter\(Boolean\)/,
  'full-session teammate/opponent sync should include legacy profileHandle relations'
);
assert.match(
  votingSyncSource,
  /const playerHandle = getPlayerProfileHandle\(player\)/,
  'vote-only profile sync should include legacy profileHandle players'
);
assert.match(
  votingSyncSource,
  /export async function syncVotingToProfiles\(\{[\s\S]*roomInfo[\s\S]*players/,
  'vote profile sync should accept captured room/player snapshots for delayed final-win sync'
);
assert.match(
  votingSyncSource,
  /export function scheduleAutoVotingSync\(\{[\s\S]*roomInfo[\s\S]*players/,
  'scheduled vote sync should capture the completed room and player list instead of reading live state later'
);
assert.match(
  votingSyncSource,
  /syncVotingToProfiles\(\{\s*roomInfo: capturedRoomInfo,\s*players: capturedPlayers\s*\}\)/,
  'scheduled vote sync timeout should use the captured room/player snapshots'
);

const finalWinSource = readFileSync(new URL('../../src/controllers/finalWinSideEffects.js', import.meta.url), 'utf8');
assert.match(
  finalWinSource,
  /scheduleAutoVotingSync\(\{\s*roomInfo: capturedRoomInfo,\s*players: capturedPlayers\s*\}\)/,
  'final-win side effects should pass captured room/player snapshots into scheduled vote sync'
);

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const consoleErrors = [];
try {
  console.error = (...args) => {
    consoleErrors.push(args);
  };
  globalThis.fetch = async () => new Response('<html><body>edge cache error</body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });

  assert.deepEqual(
    await syncVotingToProfiles({
      roomInfo: { roomCode: 'ABC123', authToken: 'host-token' },
      players: [{ id: 1, team: 1, handle: 'alice' }]
    }),
    { success: false, reason: 'no_votes' },
    'vote profile sync should treat non-JSON vote API success responses as no vote data'
  );
  assert.equal(
    consoleErrors.length,
    0,
    'non-JSON vote API success responses should not surface as sync errors'
  );
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
}

console.log('vote profile sync result checks passed');
