import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const { resolveInitialPlayerCountMode } = await import('../../src/core/playerCountMode.js');

const fourPlayers = [
  { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }
];
const sixPlayers = [
  { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }
];

assert.equal(
  resolveInitialPlayerCountMode('8', fourPlayers),
  4,
  'initial render should prefer a valid loaded 4-player snapshot over the default 8-player select value'
);
assert.equal(
  resolveInitialPlayerCountMode('8', sixPlayers),
  6,
  'initial render should prefer a valid loaded 6-player snapshot over the default 8-player select value'
);
assert.equal(
  resolveInitialPlayerCountMode('4', []),
  4,
  'empty setup should continue to use the selected mode'
);
assert.equal(
  resolveInitialPlayerCountMode('bad-mode', []),
  8,
  'empty setup with malformed mode should fall back to 8 players'
);
assert.equal(
  resolveInitialPlayerCountMode('6', [{ id: 1 }, { id: 2 }, { id: 3 }]),
  6,
  'partial local player selection should not be treated as a complete mode snapshot'
);

const mainSource = readFileSync(resolve(repoRoot, 'src/main.js'), 'utf8');
const helperStart = mainSource.indexOf('function resolveAndSyncActiveMode()');
const helperEnd = mainSource.indexOf('function renderInitialState()', helperStart);
assert.notEqual(helperStart, -1, 'main should centralize active mode resolution');
assert.notEqual(helperEnd, -1, 'active mode helper should live before renderInitialState');

const helperSource = mainSource.slice(helperStart, helperEnd);
assert.ok(
  helperSource.includes('resolveInitialPlayerCountMode(modeElement?.value, players)'),
  'active mode helper should derive mode from loaded players before falling back to the select value'
);
assert.ok(
  helperSource.includes('modeElement.value = modeValue'),
  'active mode helper should sync the mode select to the loaded room/share player count'
);

const renderStart = mainSource.indexOf('function renderInitialState()');
assert.notEqual(renderStart, -1, 'main should define renderInitialState');
const renderSource = mainSource.slice(renderStart);

assert.ok(
  renderSource.includes('resolveAndSyncActiveMode()'),
  'renderInitialState should use the shared active mode sync path'
);
assert.equal(
  renderSource.includes('resolvePlayerCountMode(modeValue, getPlayers().length)'),
  false,
  'renderInitialState should not let a valid default select value override loaded room/share players'
);

console.log('initial player count mode checks passed');
