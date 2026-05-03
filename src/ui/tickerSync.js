/**
 * Ticker Sync — wires the top broadcast ticker to live game state.
 * Populates #tickerMode, #tickerLevel, #tickerOwner, #tickerRound
 * and keeps them up to date as state changes.
 */

import { $ } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { on as onEvent } from '../core/events.js';

/** @param {string} n - player count ('4', '6', or '8') */
function modeLabel(n) {
  if (String(n) === '4') return '4人 · 2v2';
  if (String(n) === '6') return '6人 · 3v3';
  return '8人 · 4v4';
}

/**
 * Read the current game mode from the <select id="mode"> element.
 * Falls back to '8' when the DOM element is absent (viewer pages, etc.).
 */
function currentMode() {
  const el = $('mode');
  return el ? el.value : '8';
}

/** Render all four ticker fields from current state. */
function render() {
  const modeEl    = $('tickerMode');
  const levelEl   = $('tickerLevel');
  const ownerEl   = $('tickerOwner');
  const roundEl   = $('tickerRound');

  // Nothing to update if ticker is not on this page.
  if (!modeEl && !levelEl && !ownerEl && !roundEl) return;

  // --- Mode ---
  if (modeEl) {
    modeEl.textContent = modeLabel(currentMode());
  }

  // --- Level ---
  if (levelEl) {
    levelEl.textContent = state.getRoundLevel() || '2';
  }

  // --- Owner ---
  if (ownerEl) {
    const owner = state.getRoundOwner(); // 't1' | 't2' | null
    if (!owner) {
      ownerEl.textContent = '—';
      ownerEl.removeAttribute('style');
    } else {
      const name  = config.getTeamName(owner);
      const color = config.getTeamColor(owner);
      ownerEl.textContent = name;
      ownerEl.style.color = color;
    }
  }

  // --- Round count (history length + 1 for the current/upcoming round) ---
  if (roundEl) {
    const history = state.getHistory();
    const n = history.length + 1;
    roundEl.textContent = `本局 ${n}`;
  }
}

/**
 * Bootstrap the ticker module.
 * Call once from main.js after state is hydrated.
 */
export function initTickerSync() {
  // Initial render
  render();

  // Re-render on every event that can change any of the four fields.
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
    'config:teamChanged',
  ];
  watched.forEach(evt => onEvent(evt, render));
}
