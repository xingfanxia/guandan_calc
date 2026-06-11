import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const votingSource = readFileSync(resolve(repoRoot, 'src/share/votingManager.js'), 'utf8');
const roomUiSource = readFileSync(resolve(repoRoot, 'src/share/roomUI.js'), 'utf8');

const unlockStart = votingSource.indexOf('export function unlockViewerVoting()');
const unlockEnd = votingSource.indexOf('export function showEndGameVotingForViewers()', unlockStart);
assert.notEqual(unlockStart, -1, 'voting manager should export unlockViewerVoting');
assert.notEqual(unlockEnd, -1, 'unlockViewerVoting should be bounded by showEndGameVotingForViewers');

const unlockSource = votingSource.slice(unlockStart, unlockEnd);
assert.ok(
  unlockSource.includes('initializeViewerVotingSection();'),
  'unlockViewerVoting should create the viewer voting card when an early victory event arrives before room UI setup'
);
assert.ok(
  /let\s+votingCard\s*=\s*document\.getElementById\('viewerVotingCard'\)/.test(unlockSource),
  'unlockViewerVoting should re-read the voting card after creating it'
);
assert.ok(
  votingSource.includes('export function resetViewerVotingUnlockState()') &&
    votingSource.includes('votingUnlocked = false;'),
  'voting manager should expose a focused reset for the unlocked flag when room UI removes the voting card'
);
assert.ok(
  votingSource.includes("'state:gameReset'") &&
    votingSource.includes("'state:allReset'") &&
    votingSource.includes('onEvent(eventName, resetVotingSessionState)'),
  'voting manager should reset voting session state for direct state reset events, not only game:reset'
);

const clearVotingStart = roomUiSource.indexOf('function clearVotingUI()');
const clearRoomBannerStart = roomUiSource.indexOf('function formatDuration', clearVotingStart);
assert.notEqual(clearVotingStart, -1, 'room UI should define clearVotingUI');
assert.notEqual(clearRoomBannerStart, -1, 'clearVotingUI should be bounded by following helpers');

const clearVotingSource = roomUiSource.slice(clearVotingStart, clearRoomBannerStart);
assert.ok(
  clearVotingSource.includes('resetViewerVotingUnlockState();'),
  'clearing voting UI should also reset the in-memory unlocked flag'
);

const showRoomStart = roomUiSource.indexOf('export function showRoomUI()');
const disableStart = roomUiSource.indexOf('export function disableViewerControls()', showRoomStart);
assert.notEqual(showRoomStart, -1, 'room UI should export showRoomUI');
assert.notEqual(disableStart, -1, 'showRoomUI should be bounded by disableViewerControls');

const showRoomSource = roomUiSource.slice(showRoomStart, disableStart);
assert.equal(
  /setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*checkGameEnded\(\)/.test(showRoomSource),
  false,
  'viewer room UI should not rely on a fixed delay to unlock an already-completed room'
);
assert.ok(
  showRoomSource.includes('if (checkGameEnded())') &&
    showRoomSource.includes('showEndGameVotingForViewers();'),
  'viewer room UI should synchronously unlock voting when the loaded room is already completed'
);

console.log('viewer voting unlock flow checks passed');
