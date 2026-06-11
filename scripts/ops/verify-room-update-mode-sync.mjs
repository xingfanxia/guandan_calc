import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mainSource = readFileSync(resolve(repoRoot, 'src/main.js'), 'utf8');

const helperStart = mainSource.indexOf('function resolveAndSyncActiveMode()');
assert.notEqual(helperStart, -1, 'main should centralize loaded-player mode resolution');

const helperEnd = mainSource.indexOf('function renderInitialState()', helperStart);
assert.notEqual(helperEnd, -1, 'mode sync helper should live before renderInitialState');

const helperSource = mainSource.slice(helperStart, helperEnd);
assert.ok(
  helperSource.includes('resolveInitialPlayerCountMode(modeElement?.value, players)'),
  'mode sync helper should prefer a complete loaded room/share player snapshot over the current select value'
);
assert.ok(
  helperSource.includes('modeElement.value = modeValue'),
  'mode sync helper should update the mode select when loaded players determine the active mode'
);

const renderStart = mainSource.indexOf('function renderInitialState()');
const renderEnd = mainSource.indexOf('// Initialize when DOM is ready', renderStart);
assert.notEqual(renderStart, -1, 'main should define renderInitialState');
assert.notEqual(renderEnd, -1, 'renderInitialState block should be bounded by DOM init');

const renderSource = mainSource.slice(renderStart, renderEnd);
assert.ok(
  renderSource.includes('resolveAndSyncActiveMode()'),
  'initial render should use the shared loaded-player mode sync path'
);

const roomUpdatedStart = mainSource.indexOf("onEvent('room:updated'");
const roomUpdatedEnd = mainSource.indexOf("onEvent('room:created'", roomUpdatedStart);
assert.notEqual(roomUpdatedStart, -1, 'main should handle room:updated');
assert.notEqual(roomUpdatedEnd, -1, 'room:updated handler should be bounded by room:created');

const roomUpdatedSource = mainSource.slice(roomUpdatedStart, roomUpdatedEnd);
assert.ok(
  roomUpdatedSource.includes('resolveAndSyncActiveMode()'),
  'room updates should sync the active mode from loaded players before rendering ranking slots'
);
assert.equal(
  roomUpdatedSource.includes("const mode = $('mode').value"),
  false,
  'room updates should not reuse a stale mode select value after loading a changed room snapshot'
);
assert.ok(
  roomUpdatedSource.indexOf('resolveAndSyncActiveMode()') < roomUpdatedSource.indexOf('renderRankingArea(mode)'),
  'room updates should resolve mode before rendering ranking slots'
);

console.log('room update mode sync checks passed');
