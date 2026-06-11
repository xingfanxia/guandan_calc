import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePlayerData } from '../../api/players/_utils.js';
import { isAllowedAvatarPhotoFile } from '../../src/player/photoRenderer.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const createModalSource = readFileSync(resolve(repoRoot, 'src/player/playerCreateModal.js'), 'utf8');
const editModalSource = readFileSync(resolve(repoRoot, 'src/player/playerEditModal.js'), 'utf8');

function playerPayload(photoBase64) {
  return {
    handle: 'photo_user',
    displayName: 'Photo User',
    emoji: 'P',
    playStyle: 'steady',
    tagline: 'photo test',
    ...(photoBase64 !== undefined ? { photoBase64 } : {})
  };
}

[
  'data:image/jpeg;base64,ZmFrZQ==',
  'data:image/png;base64,ZmFrZQ==',
  'data:image/webp;base64,ZmFrZQ=='
].forEach(photoBase64 => {
  assert.equal(
    validatePlayerData(playerPayload(photoBase64)).valid,
    true,
    `${photoBase64.split(';')[0]} should be accepted`
  );
});

[
  'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+',
  'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
  'data:image/png;utf8,<svg/onload=alert(1)>',
  'data:text/html;base64,PGltZyBzcmM9eCBvbmVycm9yPWFsZXJ0KDEpPg==',
  'data:image/png;base64,not valid base64!'
].forEach(photoBase64 => {
  const result = validatePlayerData(playerPayload(photoBase64));
  assert.equal(result.valid, false, `${photoBase64.split(',')[0]} should be rejected`);
  assert.match(result.error, /JPEG, PNG, or WebP/, 'photo rejection should explain allowed image types');
});

[
  { type: 'image/jpeg', ok: true },
  { type: 'image/png', ok: true },
  { type: 'image/webp', ok: true },
  { type: 'image/svg+xml', ok: false },
  { type: 'image/gif', ok: false },
  { type: 'text/html', ok: false },
  { type: '', ok: false }
].forEach(({ type, ok }) => {
  assert.equal(
    isAllowedAvatarPhotoFile({ type }),
    ok,
    `${type || 'empty type'} should ${ok ? 'pass' : 'fail'} frontend profile photo MIME validation`
  );
});

assert.ok(
  createModalSource.includes('isAllowedAvatarPhotoFile(file)'),
  'create modal should use the shared frontend avatar photo file whitelist before FileReader'
);
assert.ok(
  editModalSource.includes('isAllowedAvatarPhotoFile(file)'),
  'edit modal should use the shared frontend avatar photo file whitelist before FileReader'
);
assert.equal(
  createModalSource.includes("file.type.startsWith('image/')"),
  false,
  'create modal should not accept every image/* MIME type'
);
assert.equal(
  editModalSource.includes("file.type.startsWith('image/')"),
  false,
  'edit modal should not accept every image/* MIME type'
);

[
  [{ displayName: 42 }, /displayName/i],
  [{ displayName: '   ' }, /displayName/i],
  [{ emoji: { bad: true } }, /emoji/i],
  [{ emoji: '' }, /emoji/i],
  [{ playStyle: 123 }, /playStyle/i],
  [{ playStyle: '' }, /playStyle/i],
  [{ tagline: 42 }, /tagline/i],
  [{ tagline: '   ' }, /tagline/i]
].forEach(([overrides, errorPattern]) => {
  const result = validatePlayerData({
    ...playerPayload(),
    ...overrides
  });
  assert.equal(result.valid, false, `${Object.keys(overrides)[0]} should reject invalid profile identity fields`);
  assert.match(result.error, errorPattern);
});

console.log('player photo input validation checks passed');
