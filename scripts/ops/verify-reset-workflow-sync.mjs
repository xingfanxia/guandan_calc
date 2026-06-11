import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = path => readFileSync(resolve(repoRoot, path), 'utf8');

const mainSource = readSource('src/main.js');
const gameControlsSource = readSource('src/controllers/gameControls.js');
const indexSource = readSource('index.html');

assert.ok(
  indexSource.includes('onclick="resetAll()"'),
  'victory modal should keep a single global reset entry for inline HTML handlers'
);

assert.match(
  gameControlsSource,
  /export function resetMatchAndSync\(renderInitialState\)/,
  'gameControls should expose one shared reset workflow for UI reset entry points'
);

const helperStart = gameControlsSource.indexOf('export function resetMatchAndSync(renderInitialState)');
const setupStart = gameControlsSource.indexOf('export function setupGameControls', helperStart);
assert.notEqual(helperStart, -1, 'shared reset workflow should exist');
assert.notEqual(setupStart, -1, 'setupGameControls should follow the shared reset workflow');
const helperSource = gameControlsSource.slice(helperStart, setupStart);

assert.match(
  helperSource,
  /const result = resetAll\(true\);/,
  'shared reset workflow should perform the preserve-players full match reset'
);
assert.ok(
  helperSource.indexOf('renderInitialState();') > helperSource.indexOf('if (result.success)'),
  'shared reset workflow should rerender the initial state after a successful reset'
);
assert.ok(
  helperSource.indexOf('closeVictoryModal();') > helperSource.indexOf('renderInitialState();'),
  'shared reset workflow should close the victory modal after rerendering'
);
assert.ok(
  helperSource.indexOf('syncNow();') > helperSource.indexOf('closeVictoryModal();'),
  'shared reset workflow should sync the room immediately after reset'
);

const resetHandlerStart = gameControlsSource.indexOf('// Reset button');
const manualCalcStart = gameControlsSource.indexOf('// Manual calc button', resetHandlerStart);
assert.notEqual(resetHandlerStart, -1, 'reset button handler should exist');
assert.notEqual(manualCalcStart, -1, 'manual calc handler should follow reset button handler');
const resetHandlerSource = gameControlsSource.slice(resetHandlerStart, manualCalcStart);

assert.ok(
  resetHandlerSource.includes('resetMatchAndSync(renderInitialState)'),
  'reset button should use the shared reset workflow'
);
assert.equal(
  resetHandlerSource.includes('resetAll(true)'),
  false,
  'reset button should not duplicate raw resetAll logic'
);

const globalResetStart = mainSource.indexOf('window.resetAll =');
const debugInterfaceStart = mainSource.indexOf('// Debug interface', globalResetStart);
assert.notEqual(globalResetStart, -1, 'main should expose the global resetAll handler for the victory modal');
assert.notEqual(debugInterfaceStart, -1, 'debug interface should follow global reset handler');
const globalResetSource = mainSource.slice(globalResetStart, debugInterfaceStart);

assert.ok(
  globalResetSource.includes('resetMatchAndSync(renderInitialState)'),
  'victory modal global reset should use the shared reset workflow'
);
assert.equal(
  globalResetSource.includes('resetAll(true)'),
  false,
  'victory modal global reset should not duplicate raw resetAll logic without room sync'
);

console.log('reset workflow sync checks passed');
