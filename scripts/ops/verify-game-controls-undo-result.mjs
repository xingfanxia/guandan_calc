import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gameControlsSource = readFileSync(
  new URL('../../src/controllers/gameControls.js', import.meta.url),
  'utf8'
);

const advanceHandlerStart = gameControlsSource.indexOf("if (advanceBtn) {");
assert.notEqual(advanceHandlerStart, -1, 'advance button handler should exist');

const undoHandlerStart = gameControlsSource.indexOf("if (undoBtn) {");
assert.notEqual(undoHandlerStart, -1, 'undo button handler should exist');

const advanceHandlerSource = gameControlsSource.slice(advanceHandlerStart, undoHandlerStart);

assert.match(
  advanceHandlerSource,
  /const result = advanceToNextRound\(\);/,
  'advance handler should inspect advanceToNextRound() result instead of assuming advancement succeeded'
);
assert.match(
  advanceHandlerSource,
  /if \(result\.advanced\)/,
  'advance handler should only run success-side effects after a successful next-round advance'
);
assert.ok(
  advanceHandlerSource.indexOf('syncNow();') > advanceHandlerSource.indexOf('if (result.advanced)'),
  'advance handler should only sync the room after a successful next-round advance'
);

const resetHandlerStart = gameControlsSource.indexOf('// Reset button', undoHandlerStart);
assert.notEqual(resetHandlerStart, -1, 'reset handler should follow undo handler');

const undoHandlerSource = gameControlsSource.slice(undoHandlerStart, resetHandlerStart);

assert.match(
  undoHandlerSource,
  /const result = undoLast\(\);/,
  'undo handler should inspect undoLast() result instead of assuming rollback succeeded'
);
assert.match(
  undoHandlerSource,
  /if \(!result\.success && applyTip\)/,
  'undo handler should only handle failed rollback messages; successful rollback side effects are event-owned'
);
assert.equal(
  undoHandlerSource.includes('syncNow();'),
  false,
  'undo handler should not duplicate room sync after rollback'
);
assert.equal(
  undoHandlerSource.includes('renderHistory();'),
  false,
  'undo handler should not duplicate rollback rerendering'
);
assert.match(
  undoHandlerSource,
  /result\.message \|\| '撤销失败。'/,
  'undo handler should surface failed rollback messages when available'
);

console.log('game controls undo result checks passed');
