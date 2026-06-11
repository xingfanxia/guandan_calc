import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const sources = {
  roomControls: readFileSync(resolve(repoRoot, 'src/controllers/roomControls.js'), 'utf8'),
  votingManager: readFileSync(resolve(repoRoot, 'src/share/votingManager.js'), 'utf8'),
  votingSync: readFileSync(resolve(repoRoot, 'src/share/votingSync.js'), 'utf8'),
  exportMobile: readFileSync(resolve(repoRoot, 'src/export/exportMobile.js'), 'utf8'),
  shareManager: readFileSync(resolve(repoRoot, 'src/share/shareManager.js'), 'utf8')
};

[
  ['roomControls', '`/api/rooms/favorite/${roomInfo.roomCode}`'],
  ['votingManager', '`/api/rooms/vote/${roomInfo.roomCode}`'],
  ['votingManager', '`/api/rooms/vote/${roomInfo.roomCode}?game=${gameNumber}`'],
  ['votingManager', '`/api/rooms/reset-vote/${roomInfo.roomCode}`'],
  ['votingSync', '`/api/rooms/vote/${roomInfo.roomCode}`'],
  ['votingSync', '`/api/rooms/vote/${syncRoomInfo.roomCode}`'],
  ['exportMobile', '`/api/rooms/vote/${roomInfo.roomCode}`']
].forEach(([sourceName, rawTemplate]) => {
  assert.equal(
    sources[sourceName].includes(rawTemplate),
    false,
    `${sourceName} should not interpolate raw roomInfo.roomCode into room API paths`
  );
});

[
  ['roomControls', '`/api/rooms/favorite/${encodeURIComponent(roomInfo.roomCode)}`'],
  ['votingManager', '`/api/rooms/vote/${encodeURIComponent(roomInfo.roomCode)}`'],
  ['votingManager', '`/api/rooms/vote/${encodeURIComponent(roomInfo.roomCode)}?game=${gameNumber}`'],
  ['votingManager', '`/api/rooms/reset-vote/${encodeURIComponent(roomInfo.roomCode)}`'],
  ['votingSync', '`/api/rooms/vote/${encodeURIComponent(syncRoomInfo.roomCode)}`'],
  ['exportMobile', '`/api/rooms/vote/${encodeURIComponent(roomInfo.roomCode)}`']
].forEach(([sourceName, encodedTemplate]) => {
  assert.ok(
    sources[sourceName].includes(encodedTemplate),
    `${sourceName} should URL-encode roomInfo.roomCode before room API fetches`
  );
});

assert.equal(
  sources.shareManager.includes('${shareURL}</textarea>'),
  false,
  'share modal should not interpolate generated URLs into innerHTML textareas'
);
assert.ok(
  sources.shareManager.includes('.value = shareURL'),
  'share modal should assign generated URLs through textarea.value'
);

console.log('room API URL safety checks passed');
