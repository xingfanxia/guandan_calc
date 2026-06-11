import assert from 'node:assert/strict';

const {
  addFavoriteIndexEntry,
  buildFavoriteIndexEntry,
  buildFavoriteRoomData,
  buildUnfavoriteRoomData,
  parseFavoriteIndex,
  removeFavoriteIndexEntry
} = await import('../../api/rooms/favorite/[code].js');

const existing = [
  { roomCode: 'OLD111', favoritedAt: '2026-06-10T10:00:00.000Z' }
];
const next = { roomCode: 'NEW222', favoritedAt: '2026-06-10T11:00:00.000Z' };

assert.deepEqual(parseFavoriteIndex(JSON.stringify(existing)), existing);
assert.deepEqual(
  parseFavoriteIndex([
    { roomCode: 'old111', favoritedAt: '2026-06-10T10:00:00.000Z' },
    { roomCode: '../BAD', favoritedAt: '2026-06-10T10:00:00.000Z' },
    null
  ]),
  [{ roomCode: 'OLD111', favoritedAt: '2026-06-10T10:00:00.000Z' }],
  'favorite index parsing should normalize valid room codes and drop malformed entries'
);
assert.deepEqual(addFavoriteIndexEntry(JSON.stringify(existing), next), [...existing, next]);
assert.deepEqual(addFavoriteIndexEntry([...existing], existing[0]), existing);
assert.deepEqual(
  addFavoriteIndexEntry([{ roomCode: '../BAD' }], { roomCode: 'new222', favoritedAt: next.favoritedAt }),
  [{ roomCode: 'NEW222', favoritedAt: next.favoritedAt }],
  'favorite index writes should not preserve malformed existing entries'
);

const routeScopedFavoriteEntry = buildFavoriteIndexEntry(
  { roomCode: 'WRONG1', favoritedAt: next.favoritedAt },
  next.favoritedAt,
  { roomCode: 'NEW222' }
);
assert.equal(
  routeScopedFavoriteEntry.roomCode,
  'NEW222',
  'favorite index entries should prefer the route/storage roomCode over stale embedded roomCode values'
);

assert.deepEqual(removeFavoriteIndexEntry(JSON.stringify([...existing, next]), 'OLD111'), [next]);
assert.deepEqual(removeFavoriteIndexEntry([...existing, next], 'NEW222'), existing);

const favoriteData = buildFavoriteRoomData(
  {
    roomCode: 'ROOM12',
    isFavorite: false,
    unfavoritedAt: '2026-06-10T11:30:00.000Z'
  },
  '2026-06-10T12:00:00.000Z'
);
assert.equal(favoriteData.isFavorite, true);
assert.equal(favoriteData.favoritedAt, '2026-06-10T12:00:00.000Z');
assert.equal(favoriteData.roomCode, 'ROOM12');
assert.equal(
  Object.hasOwn(favoriteData, 'unfavoritedAt'),
  false,
  'favoriting should remove stale unfavoritedAt metadata'
);

const routeScopedFavoriteData = buildFavoriteRoomData(
  { roomCode: 'WRONG1', isFavorite: false },
  '2026-06-10T12:00:00.000Z',
  { roomCode: 'ROOM12' }
);
assert.equal(
  routeScopedFavoriteData.roomCode,
  'ROOM12',
  'favoriting should persist the route/storage roomCode over stale embedded roomCode values'
);

const unfavoriteData = buildUnfavoriteRoomData(
  {
    roomCode: 'ROOM12',
    isFavorite: true,
    favoritedAt: '2026-06-10T12:00:00.000Z'
  },
  '2026-06-10T12:30:00.000Z'
);
assert.equal(unfavoriteData.isFavorite, false);
assert.equal(unfavoriteData.unfavoritedAt, '2026-06-10T12:30:00.000Z');
assert.equal(unfavoriteData.roomCode, 'ROOM12');
assert.equal(
  Object.hasOwn(unfavoriteData, 'favoritedAt'),
  false,
  'unfavoriting should remove stale favoritedAt metadata'
);

const routeScopedUnfavoriteData = buildUnfavoriteRoomData(
  { roomCode: 'WRONG1', isFavorite: true },
  '2026-06-10T12:30:00.000Z',
  { roomCode: 'ROOM12' }
);
assert.equal(
  routeScopedUnfavoriteData.roomCode,
  'ROOM12',
  'unfavoriting should persist the route/storage roomCode over stale embedded roomCode values'
);

console.log('room favorite index checks passed');
