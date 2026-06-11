import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readText = path => readFileSync(resolve(repoRoot, path), 'utf8');

const htmlPaths = ['index.html', 'players.html', 'rooms.html', 'player-profile.html'];
const staleVisibleBroadcastCopy = [
  'BROADCAST · v10',
  'BROADCAST EDITORIAL · v10',
  'GD LIVE BROADCAST',
  'GAME NIGHT BROADCAST',
  '<span class="ticker__item-label">BROADCAST</span>',
];

for (const htmlPath of htmlPaths) {
  const source = readText(htmlPath);
  assert.match(
    source,
    /<html[^>]+data-theme="linear"/,
    `${htmlPath} should use the console theme for first-paint fallback`
  );
  assert.equal(
    source.includes('with `data-theme="broadcast"`'),
    false,
    `${htmlPath} should not document broadcast as the static fallback`
  );
  assert.equal(
    source.includes('CONSOLE · v10'),
    true,
    `${htmlPath} should show console branding in the top navigation`
  );
  assert.equal(
    source.includes('GD&nbsp;LIVE · CONSOLE · v10'),
    true,
    `${htmlPath} should show console branding in the footer`
  );

  for (const staleCopy of staleVisibleBroadcastCopy) {
    assert.equal(
      source.includes(staleCopy),
      false,
      `${htmlPath} should not show stale broadcast copy when console is the default theme`
    );
  }
}

const mainSource = readText('src/main.js');
assert.ok(
  mainSource.includes("resolveBootTheme('linear')"),
  'main.js should boot to the console theme when there is no saved preference'
);

const linearThemeSource = readText('src/themes/linear/index.js');
assert.match(
  linearThemeSource,
  /displayName = '控制台/,
  'linear theme should be the console theme'
);

const themeManagerSource = readText('src/themes/_shared/themeManager.js');
assert.match(
  themeManagerSource,
  /resolveBootTheme\(defaultName = 'linear'\)/,
  'themeManager should use the console theme as its standalone default'
);

console.log('default theme checks passed');
