#!/usr/bin/env node
// One-off verification for ownership token helpers in api/players/_utils.js.
// Runs the helpers against the actual Web Crypto APIs Node 19+ exposes (same
// surface as Vercel Edge runtime), so we get high-confidence behavioral parity
// without spinning up KV / vercel dev.

import {
  generateOwnershipToken,
  hashToken,
  validateOwnershipToken,
  extractBearerToken,
  validateAdminToken,
  sanitizePlayer,
  constantTimeEqual
} from '../../api/players/_utils.js';

let pass = 0;
let fail = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    pass++;
    results.push(`✅ ${name}`);
  } else {
    fail++;
    results.push(`❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function run() {
  // 1. Token generation
  const token1 = generateOwnershipToken();
  const token2 = generateOwnershipToken();
  check('generateOwnershipToken: 64 hex chars', /^[0-9a-f]{64}$/.test(token1), `got "${token1}"`);
  check('generateOwnershipToken: distinct outputs (CSPRNG)', token1 !== token2);

  // 2. Hashing
  const hash1 = await hashToken(token1);
  const hash1Again = await hashToken(token1);
  const hash2 = await hashToken(token2);
  check('hashToken: 64 hex chars', /^[0-9a-f]{64}$/.test(hash1), `got "${hash1}"`);
  check('hashToken: deterministic', hash1 === hash1Again);
  check('hashToken: different inputs → different hashes', hash1 !== hash2);
  check('hashToken: hash differs from raw token', hash1 !== token1);

  // 3. Ownership validation
  check('validateOwnershipToken: correct token verifies', await validateOwnershipToken(token1, hash1));
  check('validateOwnershipToken: wrong token rejected', !(await validateOwnershipToken(token2, hash1)));
  check('validateOwnershipToken: empty token rejected', !(await validateOwnershipToken('', hash1)));
  check('validateOwnershipToken: null token rejected', !(await validateOwnershipToken(null, hash1)));
  check('validateOwnershipToken: undefined hash rejected', !(await validateOwnershipToken(token1, undefined)));
  check('validateOwnershipToken: wrong-length hash rejected', !(await validateOwnershipToken(token1, 'abc')));
  check('validateOwnershipToken: non-string token rejected', !(await validateOwnershipToken(123, hash1)));

  // 4. Bearer extraction
  const mockRequest = (headers) => ({
    headers: { get: (k) => headers[k.toLowerCase()] ?? null }
  });
  check('extractBearerToken: standard Bearer', extractBearerToken(mockRequest({ authorization: 'Bearer abc123' })) === 'abc123');
  check('extractBearerToken: case-insensitive scheme', extractBearerToken(mockRequest({ authorization: 'bearer xyz' })) === 'xyz');
  check('extractBearerToken: extra whitespace', extractBearerToken(mockRequest({ authorization: '  Bearer   abc  ' })) === 'abc');
  check('extractBearerToken: no header → null', extractBearerToken(mockRequest({})) === null);
  check('extractBearerToken: malformed header → null', extractBearerToken(mockRequest({ authorization: 'Basic xyz' })) === null);

  // 5. Admin token still works (sanity — should not be regressed)
  process.env.ADMIN_TOKEN = 'test-admin-secret';
  check('validateAdminToken: correct token verifies', validateAdminToken('test-admin-secret'));
  check('validateAdminToken: wrong token rejected', !validateAdminToken('wrong'));
  delete process.env.ADMIN_TOKEN;
  check('validateAdminToken: rejects when env unset', !validateAdminToken('anything'));

  // 6. sanitizePlayer — internal-only fields stripped from public response
  const fakePlayer = {
    handle: 'test',
    displayName: 'Test',
    ownershipTokenHash: 'a'.repeat(64),
    stats: { sessionsPlayed: 0 }
  };
  const sanitized = sanitizePlayer(fakePlayer);
  check('sanitizePlayer: removes ownershipTokenHash', sanitized.ownershipTokenHash === undefined);
  check('sanitizePlayer: preserves handle', sanitized.handle === 'test');
  check('sanitizePlayer: preserves displayName', sanitized.displayName === 'Test');
  check('sanitizePlayer: preserves stats', sanitized.stats.sessionsPlayed === 0);
  check('sanitizePlayer: returns null for null', sanitizePlayer(null) === null);
  check('sanitizePlayer: returns undefined for undefined', sanitizePlayer(undefined) === undefined);
  check('sanitizePlayer: original is not mutated', fakePlayer.ownershipTokenHash === 'a'.repeat(64));

  // 7. validateOwnershipToken: defense-in-depth length check (must reject non-64-char stored hashes)
  check('validateOwnershipToken: rejects 63-char stored hash (corrupted)', !(await validateOwnershipToken(token1, 'a'.repeat(63))));
  check('validateOwnershipToken: rejects 65-char stored hash (corrupted)', !(await validateOwnershipToken(token1, 'a'.repeat(65))));

  // 8. constantTimeEqual — used for room auth token compare on stats path
  check('constantTimeEqual: matching strings', constantTimeEqual('abc123', 'abc123'));
  check('constantTimeEqual: different strings same length', !constantTimeEqual('abc123', 'xyz999'));
  check('constantTimeEqual: different lengths short-circuit', !constantTimeEqual('abc', 'abcd'));
  check('constantTimeEqual: empty strings', constantTimeEqual('', ''));
  check('constantTimeEqual: non-string a rejected', !constantTimeEqual(null, 'abc'));
  check('constantTimeEqual: non-string b rejected', !constantTimeEqual('abc', undefined));
  check('constantTimeEqual: number vs string rejected', !constantTimeEqual(123, '123'));

  // Output
  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
