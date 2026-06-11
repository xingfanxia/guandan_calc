import assert from 'node:assert/strict';

const { saveRoomWithFavoriteTtl } = await import('../../api/rooms/_votes.js');
const { resetRoomVotingState, saveResetRoomVotingState } = await import('../../api/rooms/reset-vote/[code].js');

const calls = [];
const fakeKv = {
  async set(key, value) {
    calls.push({ method: 'set', key, value: JSON.parse(value) });
  },
  async setex(key, ttl, value) {
    calls.push({ method: 'setex', key, ttl, value: JSON.parse(value) });
  }
};

await saveRoomWithFavoriteTtl(fakeKv, 'ABC123', { roomCode: 'ABC123', isFavorite: true });
await saveRoomWithFavoriteTtl(fakeKv, 'DEF456', { roomCode: 'DEF456', isFavorite: false });
await saveRoomWithFavoriteTtl(fakeKv, 'KEY123', { roomCode: 'WRONG1', isFavorite: false });

assert.equal(calls[0].method, 'set');
assert.equal(calls[0].key, 'room:ABC123');
assert.equal(calls[0].value.isFavorite, true);

assert.equal(calls[1].method, 'setex');
assert.equal(calls[1].key, 'room:DEF456');
assert.equal(calls[1].ttl, 31536000);
assert.equal(calls[1].value.isFavorite, false);

assert.equal(calls[2].method, 'setex');
assert.equal(calls[2].key, 'room:KEY123');
assert.equal(
  calls[2].value.roomCode,
  'KEY123',
  'room storage writes should persist the storage-key roomCode instead of stale embedded roomCode values'
);

const roomWithVotes = {
  roomCode: 'FAV123',
  isFavorite: true,
  endGameVotes: {
    mvp: { 1: 2 },
    burden: { 2: 1 },
    fingerprints: ['fp-a', 'fp-b']
  },
  voting: {
    currentRound: {
      roundId: 'round-7',
      votes: { voter1: { mvp: 1, burden: 2 } },
      results: { mvp: { 1: 1 }, burden: { 2: 1 } }
    },
    history: []
  }
};

const resetResult = resetRoomVotingState(roomWithVotes, '2026-06-10T12:00:00.000Z');
assert.equal(resetResult.changed, true);
assert.deepEqual(roomWithVotes.endGameVotes, { mvp: {}, burden: {}, fingerprints: [] });
assert.equal(roomWithVotes.endGameVotesHistory.length, 1);
assert.deepEqual(roomWithVotes.endGameVotesHistory[0].mvp, { 1: 2 });
assert.deepEqual(roomWithVotes.endGameVotesHistory[0].burden, { 2: 1 });
assert.deepEqual(roomWithVotes.endGameVotesHistory[0].fingerprints, ['fp-a', 'fp-b']);
assert.equal(roomWithVotes.endGameVotesHistory[0].completedAt, '2026-06-10T12:00:00.000Z');
assert.equal(roomWithVotes.voting.history.length, 1);
assert.deepEqual(roomWithVotes.voting.currentRound, {
  roundId: null,
  votes: {},
  results: { mvp: {}, burden: {} }
});

await saveResetRoomVotingState(fakeKv, 'FAV123', roomWithVotes);
assert.equal(calls[3].method, 'set');
assert.equal(calls[3].key, 'room:FAV123');
assert.deepEqual(calls[3].value.endGameVotes, { mvp: {}, burden: {}, fingerprints: [] });

console.log('room vote persistence checks passed');
