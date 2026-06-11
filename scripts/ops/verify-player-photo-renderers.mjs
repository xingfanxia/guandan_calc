import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAllowedAvatarPhoto,
  renderProfileAvatar
} from '../../src/player/photoRenderer.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playerRendererSource = readFileSync(resolve(repoRoot, 'src/player/playerRenderer.js'), 'utf8');
const honorsSource = readFileSync(resolve(repoRoot, 'src/stats/honors.js'), 'utf8');
const editModalSource = readFileSync(resolve(repoRoot, 'src/player/playerEditModal.js'), 'utf8');

assert.ok(
  playerRendererSource.includes('resolveAvatarPhoto(player)'),
  'team roster avatars should use the shared current-photo/legacy-photo resolver'
);

assert.ok(
  honorsSource.includes('resolveAvatarPhoto(p)'),
  'honor avatars should use the shared current-photo/legacy-photo resolver'
);

assert.equal(
  isAllowedAvatarPhoto('data:image/png;base64,ZmFrZQ=='),
  true,
  'avatar renderers should allow validated PNG data URLs'
);
assert.equal(
  isAllowedAvatarPhoto('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+'),
  false,
  'avatar renderers should reject SVG data URLs even when they came from legacy profile data'
);
assert.equal(
  renderProfileAvatar({
    name: 'Legacy Bad Photo',
    emoji: '<E>',
    photoBase64: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+'
  }).includes('<img'),
  false,
  'profile avatar HTML should fall back to escaped emoji for unsafe legacy photo data'
);
assert.ok(
  playerRendererSource.includes("import { resolveAvatarPhoto } from './photoRenderer.js';"),
  'team roster avatars should import the shared avatar resolver'
);
assert.ok(
  honorsSource.includes("import { resolveAvatarPhoto } from '../player/photoRenderer.js';"),
  'honor avatars should import the shared avatar resolver'
);
assert.ok(
  editModalSource.includes('const currentAvatarPhoto = resolveAvatarPhoto(player);'),
  'edit modal should resolve existing profile photos through the shared avatar whitelist'
);
assert.ok(
  editModalSource.includes('selectedPhotoBase64 = currentAvatarPhoto;'),
  'edit modal should not keep unsafe legacy photo data as the pending update payload'
);
assert.equal(
  editModalSource.includes('src="${escapeHtml(player.photoBase64)}"'),
  false,
  'edit modal should not interpolate raw profile photoBase64 into img.src'
);

console.log('player photo renderer checks passed');
