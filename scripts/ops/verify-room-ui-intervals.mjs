import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const roomUiSource = readFileSync(resolve(repoRoot, 'src/share/roomUI.js'), 'utf8');
const roomControlsSource = readFileSync(resolve(repoRoot, 'src/controllers/roomControls.js'), 'utf8');

assert.ok(roomUiSource.includes('let voteLeaderboardInterval'), 'room UI should keep one vote leaderboard interval handle');
assert.ok(roomUiSource.includes('let roomBannerTimer'), 'room UI should keep one room banner timer handle');
assert.ok(roomUiSource.includes('function startVoteLeaderboardPolling'), 'room UI should centralize vote polling startup');
assert.ok(roomUiSource.includes('export function clearRoomUI'), 'room UI should expose cleanup for leave/remount');
assert.ok(roomUiSource.includes('function clearVotingUI'), 'room UI should centralize voting UI cleanup');
assert.ok(roomUiSource.includes("const viewerVotingCard = $('viewerVotingCard');"), 'room cleanup should remove the viewer voting card');
assert.ok(roomUiSource.includes('viewerVotingCard.remove();'), 'room cleanup should not leave stale viewer voting UI after leave');
assert.ok(roomUiSource.includes('function restoreViewerControls'), 'room UI should restore controls disabled for viewer mode');
assert.ok(
  roomUiSource.indexOf('restoreViewerControls();') < roomUiSource.indexOf('clearRoomBanner();'),
  'clearRoomUI should restore local controls before finishing cleanup'
);
assert.ok(roomUiSource.includes('const currentRoomInfo = getRoomInfo();'), 'banner content should read fresh room info on every tick');
assert.ok(
  roomUiSource.includes('function getEndedBannerTime'),
  'room banners should centralize end-state time calculation'
);
assert.ok(
  roomUiSource.includes('const gameEnded = checkGameEnded();'),
  'room banners should use local gameStatus/history to show ended state before finishedAt sync catches up'
);
assert.equal(
  roomUiSource.includes('if (!currentRoomInfo.finishedAt && !gameEnded) return null;'),
  false,
  'room banners should not treat finishedAt alone as proof that the game ended'
);
assert.ok(
  roomUiSource.includes('if (!gameEnded) return null;'),
  'room banners should render ended state only when the resolved local game status/history has ended'
);
assert.ok(
  roomUiSource.includes('return endedBannerTime.hasAuthoritativeFinishedAt;'),
  'room banners should keep polling until authoritative finishedAt arrives, even if local gameStatus already ended'
);
assert.ok(
  roomUiSource.includes('shouldRunRoomBannerTimer'),
  'room banner timer startup should be based on resolved ended status, not raw finishedAt alone'
);
assert.ok(
  roomUiSource.includes('state.getGameStatus()'),
  'room banners should read the resolved gameStatus so host/viewer banners show the synced pass-through winner'
);
assert.ok(
  roomUiSource.includes('通关'),
  'room ended banners should show which team passed A-level instead of only saying the game ended'
);
assert.ok(
  roomUiSource.includes('escapeHtml(roomCode)'),
  'room banners should escape roomCode before interpolating into innerHTML'
);
assert.ok(
  roomUiSource.includes('encodeURIComponent(roomCode)'),
  'room banner copy URL should URL-encode roomCode'
);
assert.ok(roomControlsSource.includes('clearRoomUI()'), 'leaving a room should clear room UI intervals and banners');
assert.ok(
  roomControlsSource.includes('encodeURIComponent(roomInfo.roomCode)'),
  'room controls should encode roomCode when building API paths'
);
assert.ok(
  roomControlsSource.includes('new URLSearchParams'),
  'room controls should build room redirect query strings with URLSearchParams'
);

console.log('room UI interval checks passed');
