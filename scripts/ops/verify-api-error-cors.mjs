import assert from 'node:assert/strict';

const cases = [
  {
    name: 'create player method error',
    modulePath: '../../api/players/create.js',
    expectedStatus: 405,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/create', { method: 'GET' })
  },
  {
    name: 'create player validation error',
    modulePath: '../../api/players/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
  },
  {
    name: 'create player malformed JSON',
    modulePath: '../../api/players/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"handle":'
    })
  },
  {
    name: 'create player null JSON',
    modulePath: '../../api/players/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  },
  {
    name: 'touch player method error',
    modulePath: '../../api/players/touch.js',
    expectedStatus: 405,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/touch', { method: 'GET' })
  },
  {
    name: 'touch player validation error',
    modulePath: '../../api/players/touch.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
  },
  {
    name: 'touch player invalid handle',
    modulePath: '../../api/players/touch.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: '__proto__' })
    })
  },
  {
    name: 'touch player malformed JSON',
    modulePath: '../../api/players/touch.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"handle":'
    })
  },
  {
    name: 'touch player null JSON',
    modulePath: '../../api/players/touch.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  },
  {
    name: 'delete player auth error',
    modulePath: '../../api/players/delete.js',
    expectedStatus: 403,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'demo' })
    })
  },
  {
    name: 'delete player malformed JSON',
    modulePath: '../../api/players/delete.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"handle":'
    })
  },
  {
    name: 'delete player null JSON',
    modulePath: '../../api/players/delete.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  },
  {
    name: 'reset stats auth error',
    modulePath: '../../api/players/reset-stats.js',
    expectedStatus: 403,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/reset-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'demo' })
    })
  },
  {
    name: 'reset stats malformed JSON',
    modulePath: '../../api/players/reset-stats.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/reset-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"handle":'
    })
  },
  {
    name: 'reset stats null JSON',
    modulePath: '../../api/players/reset-stats.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/reset-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  },
  {
    name: 'player detail method error',
    modulePath: '../../api/players/[handle].js',
    expectedStatus: 405,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/players/demo', { method: 'POST' })
  },
  {
    name: 'player detail invalid handle',
    modulePath: '../../api/players/[handle].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/players/bad!', { method: 'GET' })
  },
  {
    name: 'player detail public migrate error',
    modulePath: '../../api/players/[handle].js',
    expectedStatus: 403,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/players/demo?migrate=true', { method: 'GET' })
  },
  {
    name: 'player detail malformed JSON',
    modulePath: '../../api/players/[handle].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/players/demo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"mode":'
    })
  },
  {
    name: 'player detail null JSON',
    modulePath: '../../api/players/[handle].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/players/demo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  },
  {
    name: 'migrate modes auth error',
    modulePath: '../../api/players/migrate-modes.js',
    expectedStatus: 403,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/migrate-modes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
  },
  {
    name: 'migrate modes malformed JSON',
    modulePath: '../../api/players/migrate-modes.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/migrate-modes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"adminToken":'
    })
  },
  {
    name: 'migrate modes null JSON',
    modulePath: '../../api/players/migrate-modes.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/migrate-modes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  },
  {
    name: 'migrate single auth error',
    modulePath: '../../api/players/migrate-single.js',
    expectedStatus: 403,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/migrate-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'demo' })
    })
  },
  {
    name: 'migrate single malformed JSON',
    modulePath: '../../api/players/migrate-single.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/migrate-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"handle":'
    })
  },
  {
    name: 'migrate single null JSON',
    modulePath: '../../api/players/migrate-single.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/migrate-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  },
  {
    name: 'backfill duration auth error',
    modulePath: '../../api/players/backfill-duration.js',
    expectedStatus: 403,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/backfill-duration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'demo' })
    })
  },
  {
    name: 'backfill duration malformed JSON',
    modulePath: '../../api/players/backfill-duration.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/backfill-duration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"handle":'
    })
  },
  {
    name: 'backfill duration null JSON',
    modulePath: '../../api/players/backfill-duration.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/players/backfill-duration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  },
  {
    name: 'create room method error',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 405,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', { method: 'GET' })
  },
  {
    name: 'create room validation error',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
  },
  {
    name: 'create room malformed JSON',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"settings":'
    })
  },
  {
    name: 'create room null JSON',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  },
  {
    name: 'create room malformed snapshot',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {},
        state: {},
        players: [null]
      })
    })
  },
  {
    name: 'create room oversized player snapshot',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {},
        state: {},
        players: Array.from({ length: 9 }, (_, index) => ({
          id: index + 1,
          name: `P${index + 1}`,
          team: (index % 2) + 1
        }))
      })
    })
  },
  {
    name: 'create room ended snapshot without winner',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {},
        state: {
          history: [],
          gameStatus: {
            ended: true,
            winnerKey: null,
            winnerName: null,
            reason: 'A_LEVEL_CLEARED'
          }
        },
        players: []
      })
    })
  },
  {
    name: 'create room malformed rule settings',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          c4: { '1,2': { bad: true }, '1,3': 2, '1,4': 1 },
          t1: { name: '蓝队', color: '#3b82f6' },
          t2: { name: '红队', color: '#ef4444' }
        },
        state: {},
        players: []
      })
    })
  },
  {
    name: 'create room malformed team color',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          t1: { name: '蓝队', color: 'red" onmouseover="alert(1)' },
          t2: { name: '红队', color: '#ef4444' }
        },
        state: {},
        players: []
      })
    })
  },
  {
    name: 'create room malformed player photo',
    modulePath: '../../api/rooms/create.js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {},
        state: {},
        players: [
          {
            id: 1,
            name: 'Photo',
            team: 1,
            photoBase64: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+'
          }
        ]
      })
    })
  },
  {
    name: 'room detail invalid code',
    modulePath: '../../api/rooms/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/BAD!', { method: 'GET' })
  },
  {
    name: 'room detail method error',
    modulePath: '../../api/rooms/[code].js',
    expectedStatus: 405,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/ABC123', { method: 'POST' })
  },
  {
    name: 'room update malformed snapshot',
    modulePath: '../../api/rooms/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer host-token'
      },
      body: JSON.stringify({
        settings: {},
        state: {},
        players: [null]
      })
    })
  },
  {
    name: 'room update oversized player snapshot',
    modulePath: '../../api/rooms/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer host-token'
      },
      body: JSON.stringify({
        settings: {},
        state: {},
        players: Array.from({ length: 9 }, (_, index) => ({
          id: index + 1,
          name: `P${index + 1}`,
          team: (index % 2) + 1
        }))
      })
    })
  },
  {
    name: 'room update malformed rule settings',
    modulePath: '../../api/rooms/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer host-token'
      },
      body: JSON.stringify({
        settings: {
          p6: { 1: 5, 2: { bad: true }, 3: 3, 4: 3, 5: 1, 6: 0 },
          t1: { name: '蓝队', color: '#3b82f6' },
          t2: { name: '红队', color: '#ef4444' }
        },
        state: {},
        players: []
      })
    })
  },
  {
    name: 'room update malformed team color',
    modulePath: '../../api/rooms/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer host-token'
      },
      body: JSON.stringify({
        settings: {
          t1: { name: '蓝队', color: '#3b82f6' },
          t2: { name: '红队', color: 'url(javascript:alert(1))' }
        },
        state: {},
        players: []
      })
    })
  },
  {
    name: 'room update malformed JSON',
    modulePath: '../../api/rooms/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer host-token'
      },
      body: '{"settings":'
    })
  },
  {
    name: 'room update null JSON',
    modulePath: '../../api/rooms/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer host-token'
      },
      body: 'null'
    })
  },
  {
    name: 'room update ended snapshot without winner',
    modulePath: '../../api/rooms/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, PUT, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer host-token'
      },
      body: JSON.stringify({
        settings: {},
        state: {
          history: [],
          gameStatus: {
            ended: true,
            winnerKey: null,
            winnerName: null,
            reason: 'A_LEVEL_CLEARED'
          }
        },
        players: []
      })
    })
  },
  {
    name: 'list rooms method error',
    modulePath: '../../api/rooms/list.js',
    expectedStatus: 405,
    expectedMethods: 'GET, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/list', { method: 'POST' })
  },
  {
    name: 'list rooms invalid limit',
    modulePath: '../../api/rooms/list.js',
    expectedStatus: 400,
    expectedMethods: 'GET, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/list?limit=20abc', { method: 'GET' })
  },
  {
    name: 'list rooms invalid page',
    modulePath: '../../api/rooms/list.js',
    expectedStatus: 400,
    expectedMethods: 'GET, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/list?page=2abc', { method: 'GET' })
  },
  {
    name: 'favorite room invalid code',
    modulePath: '../../api/rooms/favorite/[code].js',
    expectedStatus: 400,
    expectedMethods: 'POST, DELETE, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/favorite/BAD!', { method: 'POST' })
  },
  {
    name: 'reset vote invalid code',
    modulePath: '../../api/rooms/reset-vote/[code].js',
    expectedStatus: 400,
    expectedMethods: 'POST, OPTIONS',
    expectedHeaders: 'Content-Type, Authorization',
    request: () => new Request('https://example.test/api/rooms/reset-vote/BAD!', { method: 'POST' })
  },
  {
    name: 'room vote invalid code',
    modulePath: '../../api/rooms/vote/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/vote/BAD!', { method: 'POST' })
  },
  {
    name: 'room vote same person',
    modulePath: '../../api/rooms/vote/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/vote/ABC123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mvpPlayerId: 1, burdenPlayerId: 1 })
    })
  },
  {
    name: 'room vote malformed JSON',
    modulePath: '../../api/rooms/vote/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/vote/ABC123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"mvpPlayerId":'
    })
  },
  {
    name: 'room vote null JSON',
    modulePath: '../../api/rooms/vote/[code].js',
    expectedStatus: 400,
    expectedMethods: 'GET, POST, OPTIONS',
    request: () => new Request('https://example.test/api/rooms/vote/ABC123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    })
  }
];

let failures = 0;

for (const testCase of cases) {
  const { default: handler } = await import(testCase.modulePath);
  const response = await handler(testCase.request());
  const body = await response.text();
  const expectedHeaders = testCase.expectedHeaders || 'Content-Type';

  try {
    assert.equal(response.status, testCase.expectedStatus);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), testCase.expectedMethods);
    assert.equal(response.headers.get('Access-Control-Allow-Headers'), expectedHeaders);
    assert.match(response.headers.get('Content-Type') || '', /application\/json/);
    assert.doesNotThrow(() => JSON.parse(body));
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${testCase.name}: ${error.message}; status=${response.status}; body=${body}`);
  }
}

if (failures > 0) {
  console.error(`${failures} API error CORS checks failed`);
  process.exit(1);
}

console.log(`${cases.length} API error CORS checks passed`);
