import assert from 'node:assert/strict';

const {
  addRoomIndexEntry,
  parseRoomIndex
} = await import('../../api/rooms/_index.js');

const existing = [
  { roomCode: 'OLD111', createdAt: '2026-06-10T10:00:00.000Z' }
];
const next = { roomCode: 'NEW222', createdAt: '2026-06-10T11:00:00.000Z' };

assert.deepEqual(parseRoomIndex(JSON.stringify(existing)), existing);
assert.deepEqual(parseRoomIndex(existing), existing);
assert.deepEqual(parseRoomIndex('not-json'), []);
assert.deepEqual(
  parseRoomIndex([
    { roomCode: 'old111', createdAt: '2026-06-10T10:00:00.000Z' },
    { roomCode: '../BAD', createdAt: '2026-06-10T10:00:00.000Z' },
    { roomCode: '__proto__', createdAt: '2026-06-10T10:00:00.000Z' },
    null,
    'ROOM12'
  ]),
  [{ roomCode: 'OLD111', createdAt: '2026-06-10T10:00:00.000Z' }],
  'room index parsing should normalize valid room codes and drop malformed entries'
);
assert.deepEqual(addRoomIndexEntry(JSON.stringify(existing), next), [next, ...existing]);
assert.deepEqual(addRoomIndexEntry([...existing], existing[0]), existing);

const many = Array.from({ length: 101 }, (_, index) => ({
  roomCode: `R${String(index).padStart(5, '0')}`,
  createdAt: '2026-06-10T10:00:00.000Z'
}));
assert.equal(addRoomIndexEntry(many, next).length, 100);

console.log('room index checks passed');
