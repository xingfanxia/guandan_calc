import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const exportFiles = [
  'src/export/exportHandlers.js',
  'src/export/exportMobile.js'
];

for (const relativePath of exportFiles) {
  const source = readFileSync(resolve(repoRoot, relativePath), 'utf8');
  assert.equal(
    /v9(?:\.0)?/.test(source),
    false,
    `${relativePath} must not use stale v9 export labels or filenames`
  );
}

console.log('export version label checks passed');
