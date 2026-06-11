import assert from 'node:assert/strict';

const previousAdminToken = process.env.ADMIN_TOKEN;
process.env.ADMIN_TOKEN = 'secret';

const cases = [
  {
    name: 'delete player invalid handle',
    modulePath: '../../api/players/delete.js',
    url: 'https://example.test/api/players/delete'
  },
  {
    name: 'reset stats invalid handle',
    modulePath: '../../api/players/reset-stats.js',
    url: 'https://example.test/api/players/reset-stats'
  },
  {
    name: 'migrate single invalid handle',
    modulePath: '../../api/players/migrate-single.js',
    url: 'https://example.test/api/players/migrate-single'
  },
  {
    name: 'backfill duration invalid handle',
    modulePath: '../../api/players/backfill-duration.js',
    url: 'https://example.test/api/players/backfill-duration'
  }
];

try {
  for (const testCase of cases) {
    const { default: handler } = await import(testCase.modulePath);
    const response = await handler(new Request(testCase.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: '__proto__', adminToken: 'secret' })
    }));

    assert.equal(response.status, 400, `${testCase.name} should reject before KV access`);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
    const body = await response.json();
    assert.match(body.error, /Invalid handle/i);
  }
} finally {
  if (previousAdminToken === undefined) {
    delete process.env.ADMIN_TOKEN;
  } else {
    process.env.ADMIN_TOKEN = previousAdminToken;
  }
}

console.log('admin handle validation checks passed');
