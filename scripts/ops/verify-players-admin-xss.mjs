import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../players.html', import.meta.url), 'utf8');

assert.doesNotMatch(
  html,
  /onclick="[^"]*\$\{player\.handle\}[^"]*"/,
  'players.html must not interpolate raw player.handle into inline onclick handlers'
);

assert.match(
  html,
  /data-profile-handle="\$\{escapeHtml\(player\.handle\)\}"/,
  'player card navigation should use escaped data-profile-handle'
);

assert.match(
  html,
  /data-player-handle="\$\{escapeHtml\(player\.handle\)\}"/,
  'admin buttons should use escaped data-player-handle'
);

assert.match(
  html,
  /playersListElement\.addEventListener\('click'/,
  'players list should use delegated click handling'
);

assert.doesNotMatch(
  html,
  /\$\{playerStats\.[^}]*\|\|[^}]*\}/,
  'players list stat badges should not interpolate raw stats directly into innerHTML'
);

assert.match(
  html,
  /formatInteger\(playerStats\.sessionsPlayed \|\| playerStats\.gamesPlayed/,
  'players list integer stats should route through numeric formatters'
);

assert.match(
  html,
  /formatPercent\(playerStats\.sessionWinRate \|\| playerStats\.winRate\)/,
  'players list win rate should route through numeric formatters'
);

assert.match(
  html,
  /formatFixed\(playerStats\.avgRankingPerSession \|\| playerStats\.avgRanking\)/,
  'players list average ranking should route through numeric formatters'
);

console.log('players admin XSS checks passed');
