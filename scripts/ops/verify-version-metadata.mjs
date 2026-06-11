import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { APP_VERSION, APP_VERSION_LABEL, ROOM_SCHEMA_VERSION } = await import('../../shared/version.js');

const readJson = path => JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));
const readText = path => readFileSync(resolve(repoRoot, path), 'utf8');

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

assert.equal(pkg.version, APP_VERSION, 'package.json version should match app version');
assert.equal(lock.version, APP_VERSION, 'package-lock root version should match app version');
assert.equal(lock.packages[''].version, APP_VERSION, 'package-lock package version should match app version');

for (const relativePath of [
  'api/rooms/create.js',
  'api/rooms/[code].js',
  'docs/architecture/TECHNICAL_ARCHITECTURE.md'
]) {
  const source = readText(relativePath);
  assert.equal(source.includes('v9.0'), false, `${relativePath} must not contain stale v9.0 schema labels`);
}

for (const relativePath of ['api/rooms/create.js', 'api/rooms/[code].js']) {
  assert.ok(
    readText(relativePath).includes('ROOM_SCHEMA_VERSION'),
    `${relativePath} should use the shared room schema version`
  );
}

assert.equal(ROOM_SCHEMA_VERSION, APP_VERSION_LABEL);
assert.ok(readText('README.md').includes(APP_VERSION_LABEL), 'README should expose the current app version label');

console.log('version metadata checks passed');
