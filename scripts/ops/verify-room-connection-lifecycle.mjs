import assert from 'node:assert/strict';

const storage = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  }
};

globalThis.window = {
  location: {
    origin: 'http://localhost',
    pathname: '/index.html',
    search: ''
  }
};

globalThis.alert = message => {
  throw new Error(`Unexpected alert: ${message}`);
};

let nextIntervalId = 1;
const activeIntervals = new Map();
const clearedIntervals = [];

globalThis.setInterval = (callback, delay) => {
  const id = nextIntervalId++;
  activeIntervals.set(id, { callback, delay });
  return id;
};

globalThis.clearInterval = id => {
  clearedIntervals.push(id);
  activeIntervals.delete(id);
};

const baseRoom = {
  createdAt: '2026-06-10T10:00:00.000Z',
  lastUpdated: '2026-06-10T10:01:00.000Z',
  settings: {
    t1: { name: '蓝队', color: '#3b82f6' },
    t2: { name: '红队', color: '#ef4444' }
  },
  state: {
    teams: {
      t1: { lvl: '2', aFail: 0 },
      t2: { lvl: '2', aFail: 0 }
    },
    gameStatus: {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    },
    history: []
  },
  players: []
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

globalThis.fetch = async (url, options = {}) => {
  const method = options.method || 'GET';
  const authHeader = options.headers?.Authorization || options.headers?.authorization || null;

  if (url === '/api/rooms/HOST12' && method === 'GET') {
    return jsonResponse({
      success: true,
      hostVerified: authHeader === 'Bearer host-token',
      data: {
        ...baseRoom,
        roomCode: 'HOST12'
      }
    });
  }

  if (url === '/api/rooms/HOST34' && method === 'GET') {
    return jsonResponse({
      success: true,
      hostVerified: authHeader === 'Bearer host-token-2',
      data: {
        ...baseRoom,
        roomCode: 'HOST34'
      }
    });
  }

  if (url === '/api/rooms/VIEW12' && method === 'GET') {
    return jsonResponse({
      success: true,
      data: {
        ...baseRoom,
        roomCode: 'VIEW12'
      }
    });
  }

  throw new Error(`Unexpected fetch: ${method} ${url}`);
};

const { getRoomInfo, joinRoom, leaveRoom } = await import('../../src/share/roomManager.js');

const hostJoin = await joinRoom('HOST12', 'host-token');
assert.equal(hostJoin, true, 'host room should join successfully');
assert.equal(getRoomInfo().isHost, true);
assert.equal(activeIntervals.size, 1, 'host join should start one sync interval');
const hostSyncIntervalId = [...activeIntervals.keys()][0];

const viewerJoin = await joinRoom('VIEW12');
assert.equal(viewerJoin, true, 'viewer room should join successfully');
assert.equal(getRoomInfo().isViewer, true);
assert.equal(
  activeIntervals.size,
  1,
  'switching host to viewer should clear the old host sync interval'
);
assert.ok(
  clearedIntervals.includes(hostSyncIntervalId),
  'host sync interval should be cleared during host-to-viewer switch'
);
const viewerPollIntervalId = [...activeIntervals.keys()][0];

const secondHostJoin = await joinRoom('HOST34', 'host-token-2');
assert.equal(secondHostJoin, true, 'second host room should join successfully');
assert.equal(getRoomInfo().isHost, true);
assert.equal(
  activeIntervals.size,
  1,
  'switching viewer to host should clear the old viewer poll interval'
);
assert.ok(
  clearedIntervals.includes(viewerPollIntervalId),
  'viewer poll interval should be cleared during viewer-to-host switch'
);

leaveRoom();
assert.equal(activeIntervals.size, 0, 'leaving should clear the active room interval');

console.log('room connection lifecycle checks passed');
