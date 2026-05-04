/**
 * Ticker Sync — wires the top broadcast ticker to live game state.
 *
 * 6 fields per docs/design/demos/demo-broadcast-v3.html lines 391-410:
 *   Room · Mode · Round · Level · Owner · Elapsed
 *
 * Plus a LIVE/SYNC indicator on the right that pulses while the local
 * session is active and shows "SYNC Ns" when in room mode (host or viewer).
 */

import { $ } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { on as onEvent } from '../core/events.js';

let elapsedTimer = null;

/** @param {string} n - player count ('4', '6', or '8') */
function modeLabel(n) {
  if (String(n) === '4') return '4人 · 2v2';
  if (String(n) === '6') return '6人 · 3v3';
  return '8人 · 4v4';
}

function pad2(n) {
  const x = Number(n);
  if (Number.isFinite(x)) return String(x).padStart(2, '0');
  return String(n);
}

function currentMode() {
  const el = $('mode');
  return el ? el.value : '8';
}

function formatElapsed(totalSeconds) {
  if (totalSeconds < 0 || !Number.isFinite(totalSeconds)) return '00:00';
  if (totalSeconds < 3600) {
    const mm = Math.floor(totalSeconds / 60);
    const ss = totalSeconds % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  return `${pad2(hh)}:${pad2(mm)}h`;
}

/**
 * Look up current room code from URL or state — avoids importing roomManager
 * (circular-import risk) by reading the canonical sources directly.
 */
function currentRoomCode() {
  // 1. URL hash takes precedence — viewer mode encodes room there
  const hash = (typeof window !== 'undefined' && window.location && window.location.hash) ? window.location.hash : '';
  const match = hash.match(/[?&#]room=([a-zA-Z0-9]{6})/);
  if (match) return match[1].toUpperCase();

  // 2. Fall back to state (host mode stores room locally)
  if (typeof state.getRoomCode === 'function') {
    const code = state.getRoomCode();
    if (code) return code;
  }
  return null;
}

/** Render all six ticker fields from current state. */
function render() {
  const roomEl    = $('tickerRoom');
  const modeEl    = $('tickerMode');
  const levelEl   = $('tickerLevel');
  const ownerEl   = $('tickerOwner');
  const roundEl   = $('tickerRound');
  const elapsedEl = $('tickerElapsed');
  const syncLabel = $('tickerSyncLabel');

  // Nothing to update if ticker is not on this page.
  if (!modeEl && !levelEl && !ownerEl && !roundEl) return;

  if (roomEl) {
    const code = currentRoomCode();
    roomEl.textContent = code || 'LOCAL';
    roomEl.style.fontFamily = 'var(--font-mono)';
  }

  if (modeEl) {
    modeEl.textContent = modeLabel(currentMode());
  }

  if (levelEl) {
    levelEl.textContent = state.getRoundLevel() || '2';
  }

  if (ownerEl) {
    const owner = state.getRoundOwner();
    if (!owner) {
      ownerEl.textContent = '—';
      ownerEl.removeAttribute('style');
    } else {
      const name  = config.getTeamName(owner);
      const color = config.getTeamColor(owner);
      ownerEl.textContent = `${name}的级`;
      ownerEl.style.color = color;
    }
  }

  if (roundEl) {
    const history = state.getHistory();
    const n = history.length + 1;
    roundEl.textContent = `第${n}局`;
  }

  if (elapsedEl) {
    const startTime = typeof state.getSessionStartTime === 'function' ? state.getSessionStartTime() : null;
    if (startTime) {
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      elapsedEl.textContent = formatElapsed(seconds);
    } else {
      elapsedEl.textContent = '00:00';
    }
  }

  if (syncLabel) {
    const code = currentRoomCode();
    syncLabel.textContent = code ? 'LIVE · SYNC 2s' : 'LIVE';
  }
}

/** Tick the elapsed counter every second without recomputing other fields. */
function tickElapsed() {
  const elapsedEl = $('tickerElapsed');
  if (!elapsedEl) return;
  const startTime = typeof state.getSessionStartTime === 'function' ? state.getSessionStartTime() : null;
  if (!startTime) {
    elapsedEl.textContent = '00:00';
    return;
  }
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  elapsedEl.textContent = formatElapsed(seconds);
}

export function initTickerSync() {
  render();

  // Tick elapsed counter every second
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = setInterval(tickElapsed, 1000);

  const watched = [
    'state:hydrated',
    'state:roundLevelChanged',
    'state:roundOwnerChanged',
    'state:historyAdded',
    'state:historyRolledBack',
    'state:historyCleared',
    'state:historySet',
    'state:gameReset',
    'state:allReset',
    'ui:modeChanged',
    'room:updated',
    'room:joined',
    'room:left',
    'config:teamChanged'
  ];
  watched.forEach(evt => onEvent(evt, render));
}
