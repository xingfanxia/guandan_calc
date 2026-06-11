import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPlayerByVoteId, normalizeVoteApiResults } from '../../src/share/voteResults.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

globalThis.window = {
  location: {
    search: '',
    origin: 'http://localhost'
  }
};
const localStorageValues = new Map();
globalThis.localStorage = {
  getItem(key) {
    return localStorageValues.get(key) || null;
  },
  setItem(key, value) {
    localStorageValues.set(key, String(value));
  },
  removeItem(key) {
    localStorageValues.delete(key);
  }
};
globalThis.document = {
  getElementById() {
    return {
      style: {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      appendChild() {},
      insertBefore() {},
      innerHTML: ''
    };
  },
  createElement() {
    return {
      style: {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      appendChild() {},
      insertBefore() {},
      innerHTML: '',
      id: '',
      className: ''
    };
  },
  querySelector() {
    return null;
  },
  addEventListener() {},
  removeEventListener() {}
};

assert.deepEqual(
  normalizeVoteApiResults({
    success: true,
    votes: {
      mvp: { 1: 3 },
      burden: { 2: 1 },
      fingerprints: ['fp-1']
    }
  }),
  {
    mvp: { votes: { 1: 3 } },
    burden: { votes: { 2: 1 } },
    fingerprints: ['fp-1']
  },
  'host voting UI should normalize the current /api/rooms/vote response shape'
);

assert.deepEqual(
  normalizeVoteApiResults({
    success: true,
    votes: {
      mvp: {
        1: '2',
        '1e2': 5,
        '01': 4,
        2: '<img src=x onerror=alert(1)>',
        3: 0,
        4: -1,
        5: 1.5,
        bad: 1
      },
      burden: {
        2: '3',
        6: null
      },
      fingerprints: ['fp-1', '', 42, 'fp-2']
    }
  }),
  {
    mvp: { votes: { 1: 2 } },
    burden: { votes: { 2: 3 } },
    fingerprints: ['fp-1', 'fp-2']
  },
  'normalization should sanitize vote maps before innerHTML-based result renderers consume counts'
);

assert.deepEqual(
  normalizeVoteApiResults({
    mvp: { votes: { 3: 2 } },
    burden: { votes: { 4: 2 } },
    fingerprints: ['legacy-fp']
  }),
  {
    mvp: { votes: { 3: 2 } },
    burden: { votes: { 4: 2 } },
    fingerprints: ['legacy-fp']
  },
  'normalization should remain compatible with the legacy nested UI shape'
);

assert.deepEqual(
  normalizeVoteApiResults(null),
  {
    mvp: { votes: {} },
    burden: { votes: {} },
    fingerprints: []
  },
  'missing vote payloads should normalize to empty vote maps'
);

const votePlayers = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
];
assert.equal(findPlayerByVoteId(votePlayers, '1'), votePlayers[0]);
assert.equal(findPlayerByVoteId(votePlayers, 2), votePlayers[1]);
assert.equal(
  findPlayerByVoteId(votePlayers, '1abc'),
  null,
  'vote player lookup should not partially parse malformed player IDs'
);
assert.equal(
  findPlayerByVoteId(votePlayers, '1.5'),
  null,
  'vote player lookup should reject non-integer player IDs'
);
assert.equal(
  findPlayerByVoteId([{ id: 100 }], '1e2'),
  null,
  'vote player lookup should reject exponent-form player IDs'
);
assert.equal(
  findPlayerByVoteId(votePlayers, '01'),
  null,
  'vote player lookup should reject leading-zero player IDs'
);

const votingManagerSource = readFileSync(resolve(repoRoot, 'src/share/votingManager.js'), 'utf8');
const exportMobileSource = readFileSync(resolve(repoRoot, 'src/export/exportMobile.js'), 'utf8');
const votingSyncSource = readFileSync(resolve(repoRoot, 'src/share/votingSync.js'), 'utf8');
const submitVoteStart = votingManagerSource.indexOf('export async function submitEndGameVotes');
const submitVoteEnd = votingManagerSource.indexOf('/**\n * Get end-game voting results', submitVoteStart);
const submitVoteSource = votingManagerSource.slice(submitVoteStart, submitVoteEnd);
assert.ok(
  votingManagerSource.includes('normalizeVoteApiResults'),
  'getEndGameVotingResults should adapt API results before showHostVoting consumes them'
);
assert.equal(
  votingManagerSource.includes('return results;'),
  false,
  'getEndGameVotingResults should not return the raw API payload to host voting UI'
);
assert.equal(
  votingManagerSource.includes('data.votes.mvp'),
  false,
  'viewer vote result consumers should not bypass normalizeVoteApiResults for MVP votes'
);
assert.equal(
  votingManagerSource.includes('data.votes.burden'),
  false,
  'viewer vote result consumers should not bypass normalizeVoteApiResults for burden votes'
);
assert.ok(
  exportMobileSource.includes('normalizeVoteApiResults'),
  'mobile PNG export should reuse shared vote API result normalization'
);
assert.ok(
  exportMobileSource.includes('readOptionalJsonResponse'),
  'mobile PNG export should tolerate non-JSON vote API responses through the shared response reader'
);
assert.equal(
  exportMobileSource.includes('await response.json()'),
  false,
  'mobile PNG export should not parse optional vote API data with raw response.json()'
);
assert.equal(
  exportMobileSource.includes('voteData.votes.mvp'),
  false,
  'mobile PNG export should not bypass normalizeVoteApiResults for MVP votes'
);
assert.equal(
  exportMobileSource.includes('voteData.votes.burden'),
  false,
  'mobile PNG export should not bypass normalizeVoteApiResults for burden votes'
);
assert.equal(
  votingManagerSource.includes('parseInt(id)') ||
    votingManagerSource.includes('parseInt(playerId)') ||
    votingManagerSource.includes('parseInt(btn.dataset.playerId)'),
  false,
  'voting UI should use shared vote player ID lookup instead of partial parseInt matching'
);
assert.equal(
  votingSyncSource.includes('parseInt(playerId)') ||
    votingSyncSource.includes('parseInt(topMVP[0])') ||
    votingSyncSource.includes('parseInt(topBurden[0])'),
  false,
  'vote profile sync should use shared vote player ID lookup instead of partial parseInt matching'
);
assert.equal(
  exportMobileSource.includes('parseInt(id)'),
  false,
  'mobile vote export should use shared vote player ID lookup instead of partial parseInt matching'
);
assert.ok(
  submitVoteSource.includes('const normalizedMvpPlayerId = normalizeVotePlayerId(mvpPlayerId);'),
  'viewer vote submission should normalize the MVP player ID before comparing or sending it'
);
assert.ok(
  submitVoteSource.includes('const normalizedBurdenPlayerId = normalizeVotePlayerId(burdenPlayerId);'),
  'viewer vote submission should normalize the burden player ID before comparing or sending it'
);
assert.ok(
  submitVoteSource.includes('normalizedMvpPlayerId === normalizedBurdenPlayerId'),
  'viewer vote submission should compare normalized player IDs for same-person validation'
);
assert.ok(
  submitVoteSource.includes('mvpPlayerId: normalizedMvpPlayerId') &&
    submitVoteSource.includes('burdenPlayerId: normalizedBurdenPlayerId'),
  'viewer vote submission should send normalized player IDs to the vote API'
);

const { joinRoom, leaveRoom } = await import('../../src/share/roomManager.js');
const { submitEndGameVotes } = await import('../../src/share/votingManager.js');
const originalFetch = globalThis.fetch;
let voteSubmissionRequested = false;
try {
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes('/api/rooms/vote/')) {
      voteSubmissionRequested = true;
      return new Response('<html><body>edge error</body></html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (requestUrl.includes('/api/rooms/ABC123')) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          roomCode: 'ABC123',
          settings: {},
          state: {
            teams: {
              t1: { lvl: '2', aFail: 0 },
              t2: { lvl: '2', aFail: 0 }
            },
            roundLevel: '2',
            roundOwner: null,
            nextRoundBase: null,
            gameStatus: {
              ended: false,
              winnerKey: null,
              winnerName: null,
              reason: null
            },
            history: []
          },
          players: [
            { id: 1, name: 'Alice', emoji: 'A', team: 1 },
            { id: 2, name: 'Bob', emoji: 'B', team: 2 }
          ],
          playerStats: {},
          currentRanking: {},
          lastUpdated: '2026-01-01T00:00:00.000Z'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    throw new Error(`Unexpected fetch: ${requestUrl}`);
  };

  assert.equal(await joinRoom('ABC123'), true);
  assert.equal(
    (await submitEndGameVotes(1, 2)).error,
    'server_error',
    'non-JSON vote submission failures should be classified as server errors, not network errors'
  );
  assert.equal(voteSubmissionRequested, true);
} finally {
  leaveRoom();
  globalThis.fetch = originalFetch;
}

console.log('voting results contract checks passed');
