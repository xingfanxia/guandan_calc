import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(resolve(repoRoot, 'src/share/votingManager.js'), 'utf8');

assert.ok(source.includes('let hostVotePollingInterval'), 'voting manager should retain the host polling interval handle');
assert.ok(source.includes('export function stopVotePolling'), 'voting manager should expose a host polling stop function');
assert.ok(source.includes('stopVotePolling();'), 'startVotePolling should clear any existing interval before creating a new one');
assert.equal(source.includes('never stops the interval'), false, 'host vote polling should not document leaking behavior');

console.log('voting polling lifecycle checks passed');
