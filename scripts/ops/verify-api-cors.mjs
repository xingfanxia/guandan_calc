const cases = [
  {
    name: 'create room',
    modulePath: '../../api/rooms/create.js',
    url: 'https://example.test/api/rooms/create',
    methods: 'POST, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'room detail',
    modulePath: '../../api/rooms/[code].js',
    url: 'https://example.test/api/rooms/ABC123',
    methods: 'GET, PUT, OPTIONS',
    headers: 'Content-Type, Authorization'
  },
  {
    name: 'list rooms',
    modulePath: '../../api/rooms/list.js',
    url: 'https://example.test/api/rooms/list',
    methods: 'GET, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'favorite room',
    modulePath: '../../api/rooms/favorite/[code].js',
    url: 'https://example.test/api/rooms/favorite/ABC123',
    methods: 'POST, DELETE, OPTIONS',
    headers: 'Content-Type, Authorization'
  },
  {
    name: 'reset vote',
    modulePath: '../../api/rooms/reset-vote/[code].js',
    url: 'https://example.test/api/rooms/reset-vote/ABC123',
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization'
  },
  {
    name: 'room vote',
    modulePath: '../../api/rooms/vote/[code].js',
    url: 'https://example.test/api/rooms/vote/ABC123',
    methods: 'GET, POST, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'create player',
    modulePath: '../../api/players/create.js',
    url: 'https://example.test/api/players/create',
    methods: 'POST, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'list players',
    modulePath: '../../api/players/list.js',
    url: 'https://example.test/api/players/list',
    methods: 'GET, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'touch player',
    modulePath: '../../api/players/touch.js',
    url: 'https://example.test/api/players/touch',
    methods: 'POST, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'player detail',
    modulePath: '../../api/players/[handle].js',
    url: 'https://example.test/api/players/demo',
    methods: 'GET, PUT, OPTIONS',
    headers: 'Content-Type, Authorization'
  },
  {
    name: 'delete player',
    modulePath: '../../api/players/delete.js',
    url: 'https://example.test/api/players/delete',
    methods: 'POST, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'reset stats',
    modulePath: '../../api/players/reset-stats.js',
    url: 'https://example.test/api/players/reset-stats',
    methods: 'POST, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'migrate modes',
    modulePath: '../../api/players/migrate-modes.js',
    url: 'https://example.test/api/players/migrate-modes',
    methods: 'POST, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'migrate single',
    modulePath: '../../api/players/migrate-single.js',
    url: 'https://example.test/api/players/migrate-single',
    methods: 'POST, OPTIONS',
    headers: 'Content-Type'
  },
  {
    name: 'backfill duration',
    modulePath: '../../api/players/backfill-duration.js',
    url: 'https://example.test/api/players/backfill-duration',
    methods: 'POST, OPTIONS',
    headers: 'Content-Type'
  }
];

let failures = 0;

for (const testCase of cases) {
  const { default: handler } = await import(testCase.modulePath);
  const response = await handler(new Request(testCase.url, { method: 'OPTIONS' }));
  const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
  const allowMethods = response.headers.get('Access-Control-Allow-Methods');
  const allowHeaders = response.headers.get('Access-Control-Allow-Headers');

  const passed = response.status === 204 &&
    allowOrigin === '*' &&
    allowMethods === testCase.methods &&
    allowHeaders === testCase.headers;

  if (!passed) {
    failures++;
    console.error(
      `FAIL ${testCase.name}: status=${response.status}, ` +
      `origin=${allowOrigin}, methods=${allowMethods}, headers=${allowHeaders}`
    );
  } else {
    console.log(`PASS ${testCase.name}`);
  }
}

if (failures > 0) {
  console.error(`${failures} CORS preflight checks failed`);
  process.exit(1);
}

console.log(`${cases.length} CORS preflight checks passed`);
