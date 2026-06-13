/**
 * One-off cleanup: hard-delete `test_*` fixture players from Vercel KV.
 *
 * Mirrors api/players/delete.js exactly — removes both the `player:<handle>` record
 * and its `player_id:<id>` reverse-lookup key. Connects straight to KV (no admin
 * token needed; this runs with your KV credentials, not against the public API).
 *
 * Usage (from the repo root):
 *   1. Pull the KV credentials into your shell:
 *        vercel env pull .env.local          # then: set -a; . ./.env.local; set +a
 *      (or export KV_REST_API_URL + KV_REST_API_TOKEN manually from the Vercel
 *       Storage dashboard → your KV store → .env.local tab)
 *   2. Dry run (default — lists what WOULD be deleted, deletes nothing):
 *        node scripts/ops/delete-test-players.mjs
 *   3. Apply:
 *        node scripts/ops/delete-test-players.mjs --apply
 *
 * Idempotent and safe to re-run. Only touches handles starting with `test_`.
 */
import { kv } from '@vercel/kv';

const APPLY = process.argv.includes('--apply');
const TEST_PREFIX = 'test_';

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.error('✗ Missing KV credentials. Set KV_REST_API_URL + KV_REST_API_TOKEN');
  console.error('  (vercel env pull .env.local, then source it) and re-run.');
  process.exit(1);
}

function handleFromKey(key) {
  return typeof key === 'string' && key.startsWith('player:')
    ? key.slice('player:'.length)
    : null;
}

// KV may hand back the stored JSON as a string or an already-parsed object.
function parsePlayer(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}

const playerKeys = await kv.keys('player:*');
const testKeys = playerKeys.filter(k => {
  const h = handleFromKey(k);
  return h && h.toLowerCase().startsWith(TEST_PREFIX);
});

if (testKeys.length === 0) {
  console.log('No test_ players found in KV. Nothing to do.');
  process.exit(0);
}

console.log(`Found ${testKeys.length} test_ player(s):`);
let deleted = 0;
for (const key of testKeys) {
  const handle = handleFromKey(key);
  const player = parsePlayer(await kv.get(key));
  const id = player ? player.id : undefined;

  if (!APPLY) {
    console.log(`  • ${handle}${id ? ` (id ${id})` : ''}  [dry-run]`);
    continue;
  }

  await kv.del(key);
  if (id) await kv.del(`player_id:${id}`);
  deleted++;
  console.log(`  ✓ deleted ${handle}${id ? ` + player_id:${id}` : ''}`);
}

if (!APPLY) {
  console.log(`\nDry run only — nothing deleted. Re-run with --apply to delete these ${testKeys.length} player(s).`);
} else {
  console.log(`\nDeleted ${deleted} test_ player(s) from KV.`);
}
