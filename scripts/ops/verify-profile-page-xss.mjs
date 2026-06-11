import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../player-profile.html', import.meta.url), 'utf8');

assert.doesNotMatch(
  html,
  /class="rels-row"[^>]*onclick=/,
  'relationship rows must not use inline onclick handlers'
);

assert.doesNotMatch(
  html,
  /class="recent-game-row"[^>]*onclick=/,
  'recent game rows must not use inline onclick handlers'
);

assert.match(
  html,
  /data-profile-handle="\$\{escapeHtml\(handle\)\}"/,
  'relationship rows should use escaped data-profile-handle'
);

assert.match(
  html,
  /data-room-code="\$\{escapeHtml\(game\.roomCode \|\| ''\)\}"/,
  'recent game rows should use escaped data-room-code'
);

assert.match(
  html,
  /平均\$\{escapeHtml\(game\.ranking\)\}名/,
  'recent game rows should escape API-controlled ranking values'
);

assert.match(
  html,
  /\$\{escapeHtml\(game\.rounds\)\}轮/,
  'recent game rows should escape API-controlled round counts'
);

assert.doesNotMatch(
  html,
  /\$\{player\.stats\.[^}]*\|\|[^}]*\}/,
  'profile stat tiles should not interpolate raw stats directly into innerHTML'
);

assert.match(
  html,
  /formatInteger\(player\.stats\.sessionsPlayed \|\| player\.stats\.gamesPlayed/,
  'profile stat tiles should route integer stats through numeric formatters'
);

assert.match(
  html,
  /profileContent\.addEventListener\('click'/,
  'profile content should use delegated click handling'
);

console.log('profile page XSS checks passed');
