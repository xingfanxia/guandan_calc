import assert from 'node:assert/strict';

globalThis.window = {
  location: {
    origin: 'http://localhost'
  }
};

const { getFavoriteButtonViewModel } = await import('../../src/controllers/roomControls.js');

assert.deepEqual(
  getFavoriteButtonViewModel({ roomCode: 'ABC123', isHost: true, isViewer: false, isFavorite: false }),
  { visible: true, text: '⭐ 收藏房间', title: '收藏房间并永久保存' }
);

assert.deepEqual(
  getFavoriteButtonViewModel({ roomCode: 'ABC123', isHost: true, isViewer: false, isFavorite: true }),
  { visible: true, text: '★ 取消收藏', title: '取消收藏，房间恢复一年有效期' }
);

assert.equal(
  getFavoriteButtonViewModel({ roomCode: 'ABC123', isHost: false, isViewer: true, isFavorite: false }).visible,
  false
);

assert.equal(
  getFavoriteButtonViewModel({ roomCode: null, isHost: false, isViewer: false, isFavorite: false }).visible,
  false
);

console.log('room favorite UI checks passed');
