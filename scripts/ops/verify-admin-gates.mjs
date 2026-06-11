const cases = [
  {
    name: 'delete player',
    modulePath: '../../api/players/delete.js',
    request: new Request('https://example.test/api/players/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'demo' })
    })
  },
  {
    name: 'reset stats',
    modulePath: '../../api/players/reset-stats.js',
    request: new Request('https://example.test/api/players/reset-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'demo' })
    })
  },
  {
    name: 'migrate modes',
    modulePath: '../../api/players/migrate-modes.js',
    request: new Request('https://example.test/api/players/migrate-modes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
  },
  {
    name: 'migrate single',
    modulePath: '../../api/players/migrate-single.js',
    request: new Request('https://example.test/api/players/migrate-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'demo' })
    })
  },
  {
    name: 'backfill duration',
    modulePath: '../../api/players/backfill-duration.js',
    request: new Request('https://example.test/api/players/backfill-duration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'demo' })
    })
  },
  {
    name: 'profile migrate query',
    modulePath: '../../api/players/[handle].js',
    request: new Request('https://example.test/api/players/demo?migrate=true', {
      method: 'GET'
    })
  }
];

let failures = 0;

for (const testCase of cases) {
  const { default: handler } = await import(testCase.modulePath);
  const response = await handler(testCase.request);
  if (response.status !== 403) {
    failures++;
    const text = await response.text();
    console.error(`FAIL ${testCase.name}: expected 403, got ${response.status}; body=${text}`);
  } else {
    console.log(`PASS ${testCase.name}`);
  }
}

if (failures > 0) {
  console.error(`${failures} admin gate checks failed`);
  process.exit(1);
}

console.log(`${cases.length} admin gate checks passed`);
