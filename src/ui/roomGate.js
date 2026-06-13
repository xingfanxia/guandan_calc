/**
 * Room gate — the one-tap entry screen (2026-06-12).
 *
 * Per the product decision to make every NEW game a room (no local-only mode),
 * a fresh visit with no room and no game-in-progress shows a focused
 * "create a room to begin" gate instead of the local setup. One tap creates the
 * room and redirects into room/host mode, where the normal scoreboard + setup
 * live. This also fixes the profile-sync 403s: room games sync every
 * participant through the host token, whereas local games could only sync
 * profiles the device owned.
 *
 * Backward compatibility: a saved in-progress LOCAL game (history > 0) still
 * renders — we don't destroy existing data. The gate only replaces the blank
 * fresh-load state.
 *
 * Implementation: the gate is a direct child of `main.wrap`. When active we add
 * `wrap--gated` to the wrap, which (via src/style.css) shows the gate and hides
 * every sibling. The gate buttons delegate to the existing room-control buttons
 * (`#createRoom` / `#joinRoom` / `#browseRooms`) so all room wiring is reused.
 */

import { $, on } from '../core/utils.js';
import state from '../core/state.js';
import { on as onEvent } from '../core/events.js';

/**
 * @param {{ isRoomMode: boolean, isSharedMode: boolean }} ctx
 */
export function initRoomGate({ isRoomMode, isSharedMode } = {}) {
  const gate = $('roomGate');
  const wrap = document.querySelector('main.wrap');
  if (!gate || !wrap) return;

  // Gate buttons forward to the existing room-control buttons so there's a
  // single source of truth for the create/join/browse behavior.
  const delegate = (gateId, targetId) => {
    const btn = $(gateId);
    const target = $(targetId);
    if (btn && target) on(btn, 'click', () => target.click());
  };
  delegate('gateCreateRoom', 'createRoom');
  delegate('gateJoinRoom', 'joinRoom');
  delegate('gateBrowseRooms', 'browseRooms');

  function apply() {
    // The gate is only for the blank, not-in-a-room, fresh-load state. In a
    // room or shared snapshot, or with a game already in progress, show the app.
    const showGate = !isRoomMode && !isSharedMode && !state.isGameInProgress();
    wrap.classList.toggle('wrap--gated', showGate);
    // The status strip (ticker) sits outside main.wrap and would otherwise
    // show a meaningless "房间 LOCAL · 第1局" above the gate — hide it too.
    document.body.classList.toggle('app-gated', showGate);
  }

  apply();

  // Re-evaluate whenever game-in-progress could flip: a game starting hides the
  // gate, a full reset (from a legacy local game) brings it back. Mirrors the
  // watch list in setupVisibility.js so the two stay in sync.
  [
    'state:hydrated',
    'state:historyAdded',
    'state:historyRolledBack',
    'state:historyCleared',
    'state:historySet',
    'state:gameReset',
    'state:allReset',
    'ranking:positionSet',
    'ranking:positionCleared',
    'ranking:cleared',
    'ranking:randomized',
    'ranking:updated',
    'game:rollback',
    'game:reset'
  ].forEach(evt => onEvent(evt, apply));
}
