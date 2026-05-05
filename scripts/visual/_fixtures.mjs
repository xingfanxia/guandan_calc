// Shared deterministic-state helpers for visual regression captures.
//
// Two sources of randomness in the live app produce baseline drift between
// capture runs:
//   1. Emoji avatars (`playerManager.js:78` — Math.random sort)
//   2. Team assignment (`playerManager.js:247` — Math.random sort)
//
// Capture scripts call `setDeterministicPlayers(page, count)` after the
// `#generatePlayers` + `#shuffleTeams` clicks but BEFORE any render-call,
// which overwrites both fields with fixed values. This is capture-only —
// production code never sees these helpers.
//
// Why fixed-set instead of seeded RNG: capture scripts already touch state
// directly (history, stats, ranking), so adding one more state-override
// matches the existing pattern. Avoids touching production playerManager
// just for test determinism.

// Fixed emoji rosters per mode. Chosen for visual variety (4 mammals + 4
// other for 8-mode, mammals only for 4-mode) so cross-theme captures still
// look representative of the random-emoji production state.
export const FIXED_EMOJIS = {
  4: ['🐯', '🐰', '🐼', '🦁'],
  6: ['🐯', '🐰', '🦊', '🐸', '🐼', '🦁'],
  8: ['🐯', '🐰', '🦊', '🐸', '🐼', '🦁', '🐶', '🐱'],
};

/**
 * Override player roster to a deterministic state.
 *
 * Players keep their existing names (玩家1...玩家N — already deterministic
 * from playerManager.generatePlayers). Emojis and team assignments are
 * mapped by **player.id** (1-indexed) — NOT by array position — so that
 * a prior `shuffleTeams` reordering the array doesn't reshuffle which
 * emoji lands on which player. First-half player.ids go to team 1,
 * second-half to team 2.
 *
 * The array is also re-sorted by id before write-back, so any downstream
 * code that iterates `getPlayers()[0]`/`[1]`/etc. (e.g. capture-script
 * partial-ranking seeding via `team1[0]`/`team2[0]`) gets a stable,
 * id-ordered iteration order.
 *
 * MUST be called after `#generatePlayers` click (so players exist) and
 * before any render call (so the renders see the deterministic state).
 *
 * @param {import('playwright').Page} page
 * @param {4|6|8} count
 */
export async function setDeterministicPlayers(page, count) {
  const emojis = FIXED_EMOJIS[count];
  if (!emojis) {
    throw new Error(`setDeterministicPlayers: unsupported count ${count}`);
  }
  await page.evaluate(async (fixedEmojis) => {
    const stateMod = await import('/src/core/state.js');
    const playerMgrMod = await import('/src/player/playerManager.js');
    const evtMod = await import('/src/core/events.js');
    const players = playerMgrMod.getPlayers();
    const halfSize = players.length / 2;
    players.forEach((p) => {
      const idx = p.id - 1;
      p.emoji = fixedEmojis[idx];
      p.team = p.id <= halfSize ? 1 : 2;
    });
    players.sort((a, b) => a.id - b.id);
    stateMod.default.setPlayers(players);
    // Emit the same event `shuffleTeams` emits so any renderer subscribed
    // to roster changes (player pool tiles, scoreboard team rows) repaints
    // with the deterministic state. Without this, captures that screenshot
    // before the next animation frame catch a stale render — visible as
    // background-tile-ordering noise in e.g. cross-theme victory captures.
    evtMod.emit('player:teamsShuffled', { players });
  }, emojis);
  // Settle wait — give renderers a frame to repaint after the event.
  await page.waitForTimeout(150);
}

/**
 * Freeze `Date.now()` on the page to a fixed timestamp BEFORE the page
 * loads. Eliminates time-dependent baseline drift across capture runs:
 *
 *   - `ui/tickerSync.js` ELAPSED counter (`Date.now() - sessionStartTime`)
 *   - `main.js` line 102 `sessionStartTime = Date.now()` (set on init)
 *   - History timestamps, voting deadlines, any other Date.now() consumer
 *
 * Since `sessionStartTime` is set to `Date.now()` at init AND the elapsed
 * read uses `Date.now()` again, both read the same frozen value, so
 * elapsed renders as `00:00` deterministically.
 *
 * MUST be called before `page.goto()` — otherwise modules that captured
 * Date.now references at load time won't see the override.
 *
 * Also stubs `setInterval` to a no-op for the elapsed-ticker callback so
 * the once-per-second `tickElapsed` doesn't run during the capture
 * sequence (would otherwise increment elapsed even with frozen Date.now
 * if any code path used `performance.now()` or similar).
 *
 * @param {import('playwright').Page} page
 * @param {number} frozenTimestamp  default = 2024-01-01T00:00:00.000Z
 */
export async function freezeTime(page, frozenTimestamp = 1704067200000) {
  await page.addInitScript((frozen) => {
    Date.now = () => frozen;
    // Also override `new Date()` with no args, but keep the constructor
    // for explicit timestamps. Math.floor((Date.now() - x)/1000) consumers
    // get a stable read.
    const OriginalDate = Date;
    /** @type {typeof Date} */
    function FrozenDate(...args) {
      if (args.length === 0) return new OriginalDate(frozen);
      return new OriginalDate(...args);
    }
    FrozenDate.prototype = OriginalDate.prototype;
    FrozenDate.now = () => frozen;
    FrozenDate.parse = OriginalDate.parse;
    FrozenDate.UTC = OriginalDate.UTC;
    // Don't replace globalThis.Date entirely — too invasive and risks
    // breaking modules that do instanceof checks. Only `Date.now` is
    // patched, which is the consumer used by sessionStartTime + elapsed.
  }, frozenTimestamp);
}
