import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = path => readFileSync(resolve(repoRoot, path), 'utf8');

const historySource = readSource('src/game/history.js');
const mainSource = readSource('src/main.js');
const gameControlsSource = readSource('src/controllers/gameControls.js');

assert.ok(
  historySource.includes('btn.onclick = () => rollbackTo(index);'),
  'history row rollback buttons should use the shared rollback state transaction'
);
assert.ok(
  historySource.includes("emit('game:rollback', { index, entry });"),
  'successful rollbackTo() should emit one rollback success event for UI and room side effects'
);

const rollbackHandlerStart = mainSource.indexOf("onEvent('game:rollback'");
const roomEventsStart = mainSource.indexOf('// Room events', rollbackHandlerStart);
assert.notEqual(rollbackHandlerStart, -1, 'main should listen for rollback success events');
assert.notEqual(roomEventsStart, -1, 'room event section should follow rollback event handling');
const rollbackHandlerSource = mainSource.slice(rollbackHandlerStart, roomEventsStart);

assert.ok(
  rollbackHandlerSource.includes('renderHistory();') &&
    rollbackHandlerSource.includes('renderTeams();') &&
    rollbackHandlerSource.includes('renderStatistics();'),
  'rollback success event should refresh the score, history, and statistics views'
);
assert.ok(
  rollbackHandlerSource.includes('syncNow();'),
  'rollback success event should sync the room so history-row rollback updates viewers immediately'
);

const undoHandlerStart = gameControlsSource.indexOf("if (undoBtn) {");
const resetHandlerStart = gameControlsSource.indexOf('// Reset button', undoHandlerStart);
assert.notEqual(undoHandlerStart, -1, 'undo button handler should exist');
assert.notEqual(resetHandlerStart, -1, 'reset handler should follow undo handler');
const undoHandlerSource = gameControlsSource.slice(undoHandlerStart, resetHandlerStart);

assert.match(
  undoHandlerSource,
  /const result = undoLast\(\);/,
  'undo handler should still inspect undoLast() result for failed rollback messages'
);
assert.equal(
  undoHandlerSource.includes('syncNow();'),
  false,
  'undo handler should not duplicate rollback room sync; the rollback success event owns it'
);
assert.equal(
  undoHandlerSource.includes('renderHistory();'),
  false,
  'undo handler should not duplicate rollback rerendering; the rollback success event owns it'
);

console.log('rollback workflow sync checks passed');
