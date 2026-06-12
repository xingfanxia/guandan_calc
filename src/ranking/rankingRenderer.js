/**
 * Ranking Renderer - Ranking UI Display
 * Extracted from app.js lines 832-1116; rewritten 2026-05-03 to emit
 * Broadcast-theme markup (.slot / .pool-tile) per docs/design/demos/demo-broadcast-v3.html.
 *
 * MARKUP CONTRACT:
 *  - Each rank slot is `<article class="rank-slot slot ..." data-rank="N">`. The legacy
 *    `.rank-slot` class is preserved because touchHandler.js (line 160) and
 *    drag-drop CSS depend on it. The new `.slot` class drives the editorial styling.
 *  - Each pool tile is `<article class="ranking-player-tile pool-tile ..." draggable="true">`.
 *    Same dual-class strategy: legacy class preserved for gameControls.js touch
 *    attach (line 49); new `.pool-tile` class drives styling.
 *  - Filled slots are styled by mutating the slot element itself (no nested tile
 *    inside) — matches demo's `.slot--filled .slot--filled-red|blue` design.
 *  - All player-controlled text (names, handles) is set via `textContent` (DOM
 *    APIs only; no innerHTML) to prevent XSS from name fields.
 */

import { $, on } from '../core/utils.js';
import { getRanking, setRankPosition, clearRankPosition, hasRankingChanged } from './rankingManager.js';
import { getPlayers, getPlayerById, areAllPlayersAssigned, normalizeTeamNumber } from '../player/playerManager.js';
import { getDraggedPlayer, setDraggedPlayer } from '../player/playerRenderer.js';
import { handleRankDrop, handlePoolDrop } from '../player/dragDrop.js';
import { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } from '../player/touchHandler.js';
import config from '../core/config.js';
import state from '../core/state.js';
import { emit } from '../core/events.js';
import { isClearingANote } from '../game/gameStatus.js';
import { normalizePlayerCountMode } from '../core/playerCountMode.js';

// Chinese rank names by mode (4P, 6P, 8P)
const RANK_NAMES = {
  4: ['头游', '二游', '三游', '末游'],
  6: ['头游', '二游', '三游', '四游', '五游', '末游'],
  8: ['头游', '二游', '三游', '四游', '五游', '六游', '七游', '末游']
};

/**
 * Get Chinese rank name for a given position and mode
 * @param {number} rank - 1-based position
 * @param {number} mode - 4 / 6 / 8
 * @returns {string}
 */
function rankCn(rank, mode) {
  const names = RANK_NAMES[mode] || RANK_NAMES[8];
  return names[rank - 1] || `第${rank}名`;
}

function normalizeRankSlotDataset(value) {
  if (typeof value !== 'string' || !/^[1-8]$/.test(value.trim())) {
    return null;
  }
  return Number(value.trim());
}

/**
 * Pick the avatar character for a player.
 * Prefer the assigned emoji — profile players carry their chosen emoji,
 * default-generated players pick one at generation time. Falls back to a
 * name-derived character only when emoji is missing (paranoid case).
 * @param {Object} player
 * @returns {string}
 */
function avatarChar(player) {
  if (!player) return '?';
  if (player.emoji) return player.emoji;
  const name = (player.name || '').trim();
  if (!name) return '?';
  const digitMatch = name.match(/^玩家(\d+)$/);
  if (digitMatch) return digitMatch[1];
  return Array.from(name)[0];
}

/**
 * Pick handle to display ("@..." line). Profile players have one;
 * session players don't — emit an empty string so the slot collapses
 * instead of showing a meaningless "#N" id.
 * @param {Object} player
 * @returns {string}
 */
function handleText(player) {
  if (player?.handle) return `@${player.handle}`;
  return '';
}

/**
 * Get team color class suffix ('red' or 'blue') for a player.
 * t1 (蓝队 default) → blue; t2 (红队 default) → red.
 * @param {Object} player
 * @returns {string}
 */
function teamColorClass(player) {
  return normalizeTeamNumber(player?.team) === 1 ? 'blue' : 'red';
}

/**
 * Tiny DOM helper: create an element with a class and optional text content.
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Tap-to-rank (primary entry interaction, DESIGN.md §6): tapping a pool chip
 * places that player into the lowest-numbered empty slot; tapping a filled
 * slot clears that rank. Drag-drop remains as the secondary path — browsers
 * suppress click after a real HTML5 drag, and touchHandler.js only
 * preventDefaults once its 200ms long-press drag actually starts, so short
 * taps arrive here as plain clicks on both desktop and mobile.
 */
function placePlayerAtNextRank(player) {
  const area = $('rankingArea');
  if (!area || !player) return;

  const ranking = getRanking();
  const openRanks = Array.from(area.querySelectorAll('.rank-slot'))
    .map(slot => normalizeRankSlotDataset(slot.dataset.rank))
    .filter(rank => rank !== null && ranking[rank] == null)
    .sort((a, b) => a - b);

  if (openRanks.length === 0) return;

  setRankPosition(openRanks[0], player.id);
  emit('ranking:updated');
}

function unrankSlot(rank) {
  const ranking = getRanking();
  if (ranking[rank] == null) return;
  clearRankPosition(rank);
  emit('ranking:updated');
}

const rankingTouchBindings = new WeakMap();

function clearRankingTouchHandlers(node) {
  const cleanup = rankingTouchBindings.get(node);
  if (cleanup) {
    cleanup();
    rankingTouchBindings.delete(node);
  }
  delete node.dataset.touchHandlersAttached;
}

function bindRankingTouchHandlers(node, player) {
  clearRankingTouchHandlers(node);

  const startHandler = (e) => {
    handleTouchStart(e, player);
  };

  node.addEventListener('touchstart', startHandler, { passive: false });
  node.addEventListener('touchmove', handleTouchMove, { passive: false });
  node.addEventListener('touchend', handleTouchEnd, { passive: false });
  node.addEventListener('touchcancel', handleTouchCancel, { passive: false });
  node.dataset.touchHandlersAttached = 'true';

  rankingTouchBindings.set(node, () => {
    node.removeEventListener('touchstart', startHandler);
    node.removeEventListener('touchmove', handleTouchMove);
    node.removeEventListener('touchend', handleTouchEnd);
    node.removeEventListener('touchcancel', handleTouchCancel);
  });
}

function bindRankSlotDropHandlers(slot) {
  slot.ondragover = (e) => {
    e.preventDefault();
    slot.classList.add('drag-over');
  };

  slot.ondragleave = () => {
    slot.classList.remove('drag-over');
  };

  slot.ondrop = (e) => {
    e.preventDefault();
    slot.classList.remove('drag-over');

    const player = getDraggedPlayer();
    if (!player) return;

    const currentRanking = getRanking();
    const newRanking = handleRankDrop(slot, player, currentRanking);
    if (!hasRankingChanged(currentRanking, newRanking)) return;

    state.setCurrentRanking(newRanking);
    emit('ranking:updated');
  };
}

/**
 * Check if game has ended (a team achieved A级通关)
 * @returns {Object|null} Victory info or null
 */
export function checkGameEnded() {
  if (typeof state.getGameStatus === 'function') {
    const gameStatus = state.getGameStatus();
    if (gameStatus?.ended) {
      return {
        winner: gameStatus.winnerName || config.getTeamName(gameStatus.winnerKey),
        winKey: gameStatus.winnerKey
      };
    }
  }

  const history = state.getHistory();
  if (history.length === 0) return null;

  const latestGame = history[history.length - 1];
  if (latestGame.gameStatus?.ended) {
    return {
      winner: latestGame.gameStatus.winnerName || latestGame.win,
      winKey: latestGame.gameStatus.winnerKey || latestGame.winKey
    };
  }

  if (isClearingANote(latestGame.aNote)) {
    return {
      winner: latestGame.win,
      winKey: latestGame.winKey
    };
  }
  return null;
}

/**
 * Render ranking area with slots
 * @param {number|string} mode - Game mode (4, 6, or 8)
 */
export function renderRankingArea(mode) {
  const pool = $('playerPool');
  const area = $('rankingArea');

  if (!pool || !area) return;

  const num = normalizePlayerCountMode(mode);
  if (!num) {
    pool.replaceChildren(el('div', 'small muted', '模式无效，请重新选择游戏人数'));
    area.replaceChildren();
    return;
  }

  // Check if game has ended (A级通关)
  const victory = checkGameEnded();
  if (victory) {
    const winColor = victory.winKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');
    pool.replaceChildren();
    const wrap = el('div', '');
    wrap.style.textAlign = 'center';
    wrap.style.padding = '20px';

    const trophy = el('div', '', '🏆');
    trophy.style.fontSize = '48px';
    wrap.appendChild(trophy);

    const headline = el('div', '', `${victory.winner} A级通关！`);
    headline.style.fontSize = '24px';
    headline.style.color = winColor;
    headline.style.fontWeight = 'bold';
    headline.style.margin = '10px 0';
    wrap.appendChild(headline);

    wrap.appendChild(el('div', 'small muted', '比赛已结束，重置游戏可开始新一局'));
    pool.appendChild(wrap);
    area.replaceChildren();
    return;
  }

  if (getPlayers().length === 0) {
    pool.replaceChildren(el('div', 'small muted', '请先添加或生成玩家'));
    area.replaceChildren();
    return;
  }

  // Check if all players assigned to teams
  if (!areAllPlayersAssigned()) {
    pool.replaceChildren(el('div', 'small muted', '请先分配所有玩家到队伍'));
    area.replaceChildren();
    return;
  }

  // Render player pool
  renderPlayerPool();

  // Render ranking slots — pre-create empty slots, then fill them in renderRankingSlots
  area.replaceChildren();

  for (let rank = 1; rank <= num; rank++) {
    const slot = createRankSlot(rank, num);
    area.appendChild(slot);
  }

  // Render players in slots
  renderRankingSlots();
}

/**
 * Create ranking slot element (empty initial state).
 * The slot keeps `.rank-slot` for legacy JS hooks AND adds `.slot` for theme styling.
 * @param {number} rank - 1-based rank position
 * @param {number} mode - Player count (for Chinese rank label)
 * @returns {HTMLElement} Slot element
 */
function createRankSlot(rank, mode) {
  const slot = document.createElement('article');
  slot.className = 'rank-slot slot';
  slot.dataset.rank = rank;
  slot.dataset.rankMode = mode;

  // Initial: empty state markup populated by renderRankingSlots(),
  // which decides between .slot--empty / .slot--target / .slot--filled
  // based on current ranking.

  bindRankSlotDropHandlers(slot);

  return slot;
}

/**
 * Render player pool (unranked players)
 */
export function renderPlayerPool() {
  const pool = $('playerPool');
  if (!pool) return;

  pool.replaceChildren();

  // Setup drop handler for returning players
  pool.ondragover = (e) => {
    e.preventDefault();
    pool.classList.add('drag-over');
  };

  pool.ondragleave = () => {
    pool.classList.remove('drag-over');
  };

  pool.ondrop = (e) => {
    e.preventDefault();
    pool.classList.remove('drag-over');

    const player = getDraggedPlayer();
    if (player) {
      const currentRanking = getRanking();
      const newRanking = handlePoolDrop(player, currentRanking);
      if (!hasRankingChanged(currentRanking, newRanking)) return;

      state.setCurrentRanking(newRanking);

      // Trigger ranking update event to re-render
      emit('ranking:updated');
    }
  };

  // Add unranked players
  const ranking = getRanking();
  const players = getPlayers();
  const unrankedPlayers = players.filter(player => {
    return !Object.values(ranking).includes(player.id);
  });

  if (unrankedPlayers.length === 0) {
    pool.appendChild(el('div', 'small muted', '所有玩家已排名'));
    return;
  }

  unrankedPlayers.forEach(player => {
    const tile = createPoolTile(player);
    pool.appendChild(tile);
  });
}

/**
 * Render players in ranking slots — also paints empty/target states.
 * Target slot = lowest-numbered empty slot (where the next placement goes).
 */
export function renderRankingSlots() {
  const area = $('rankingArea');
  if (!area) return;

  const ranking = getRanking();
  const slots = area.querySelectorAll('.rank-slot');

  // Find lowest-numbered empty slot (the active drop target)
  let targetRank = null;
  slots.forEach(slot => {
    const r = normalizeRankSlotDataset(slot.dataset.rank);
    if (r === null) return;
    if (!ranking[r] && targetRank === null) {
      targetRank = r;
    }
  });

  slots.forEach(slot => {
    const rank = normalizeRankSlotDataset(slot.dataset.rank);
    if (rank === null) return;

    const mode = normalizePlayerCountMode(slot.dataset.rankMode) || 8;
    const playerId = ranking[rank];

    if (playerId) {
      const player = getPlayerById(playerId);
      if (player) {
        paintFilledSlot(slot, player, rank, mode);
        return;
      }
    }

    // No player → empty or target state
    if (rank === targetRank) {
      paintTargetSlot(slot, rank, mode);
    } else {
      paintEmptySlot(slot, rank, mode);
    }
  });
}

/**
 * Mutate slot to "filled" state — player content rendered directly inside slot.
 * No nested .ranking-player-tile child, matches demo design.
 *
 * IMPORTANT: filled slot is the draggable element (not a nested tile), because
 * the demo styles .slot--filled with the avatar/name/handle as direct children.
 * Drag handlers attach to the slot itself; data attributes preserved so
 * gameControls.js attachTouchHandlers loop can find these via .ranking-player-tile.
 *
 * @param {HTMLElement} slot - Slot article element
 * @param {Object} player - Player data
 * @param {number} rank - Rank number
 * @param {number} mode - Game mode (4/6/8)
 */
function paintFilledSlot(slot, player, rank, mode) {
  const team = teamColorClass(player); // 'red' or 'blue'

  // Reset class list to filled state — preserve .rank-slot + .slot legacy
  // Also keep .ranking-player-tile so gameControls.js attachTouchHandlers loop
  // and any other legacy `.ranking-player-tile` queries match this slot.
  slot.className = `rank-slot slot slot--filled slot--filled-${team} filled ranking-player-tile`;
  slot.draggable = true;
  slot.dataset.playerId = player.id;
  slot.dataset.playerData = JSON.stringify({ id: player.id });

  slot.replaceChildren(
    el('span', 'slot__index', `第${rank}名`),
    el('span', 'slot__rank-cn', rankCn(rank, mode)),
    el('div', 'slot__avatar', avatarChar(player)),
    el('span', 'slot__name', player.name || ''),
    el('span', 'slot__handle', handleText(player)),
    el('span', 'slot__check', '×')
  );
  slot.title = '点一下取消该名次';

  // Tap a filled slot to clear that rank (tap-to-rank primary interaction)
  slot.onclick = () => unrankSlot(rank);

  // Wire drag for the filled slot (slot itself is now draggable)
  attachSlotDragHandlers(slot, player);
}

/**
 * Mutate slot to "target" state (next-to-be-filled, glowing).
 */
function paintTargetSlot(slot, rank, mode) {
  clearRankingTouchHandlers(slot);
  slot.className = 'rank-slot slot slot--target';
  slot.draggable = false;
  slot.onclick = null;
  slot.title = '';
  delete slot.dataset.playerId;
  delete slot.dataset.playerData;
  bindRankSlotDropHandlers(slot);

  slot.replaceChildren(
    el('span', 'slot__index', `第${rank}名`),
    el('span', 'slot__rank-cn', rankCn(rank, mode)),
    el('span', 'slot__target-icon', '↓'),
    el('span', 'slot__target-label', '点玩家填入')
  );
}

/**
 * Mutate slot to "empty" state (placeholder).
 */
function paintEmptySlot(slot, rank, mode) {
  clearRankingTouchHandlers(slot);
  slot.className = 'rank-slot slot slot--empty';
  slot.draggable = false;
  slot.onclick = null;
  slot.title = '';
  delete slot.dataset.playerId;
  delete slot.dataset.playerData;
  bindRankSlotDropHandlers(slot);

  slot.replaceChildren(
    el('span', 'slot__index', `第${rank}名`),
    el('span', 'slot__rank-cn', rankCn(rank, mode)),
    el('div', 'slot__placeholder'),
    el('span', 'slot__placeholder-label', '待定')
  );
}

/**
 * Attach drag handlers to a filled slot so the player inside can be dragged out.
 * Mirrors the contract from createPoolTile (so the player can move slot↔slot or
 * slot→pool).
 *
 * @param {HTMLElement} slot
 * @param {Object} player
 */
function attachSlotDragHandlers(slot, player) {
  slot.ondragstart = (e) => {
    setDraggedPlayer(player);
    slot.classList.add('dragging', 'pool-tile--dragging');
    e.dataTransfer.effectAllowed = 'move';
    emit('drag:started', { player });
  };

  slot.ondragend = () => {
    slot.classList.remove('dragging', 'pool-tile--dragging');
    setDraggedPlayer(null);
    emit('drag:ended');
  };

  // Re-bind drop targets — after paintFilledSlot the slot is still a drop zone
  // for swapping players (drop another player onto a filled slot to swap).
  bindRankSlotDropHandlers(slot);

  // Touch events — keep existing pattern (inline attach for iOS Safari), but
  // replace stale closures when the same slot is repainted for another player.
  bindRankingTouchHandlers(slot, player);
}

/**
 * Create a pool tile element (.pool-tile) for an unranked player.
 * Keeps `.ranking-player-tile` as a secondary class so legacy JS query selectors
 * still find these in gameControls.js.
 *
 * @param {Object} player - Player data
 * @returns {HTMLElement} Pool tile article
 */
function createPoolTile(player) {
  const tile = document.createElement('article');
  const team = teamColorClass(player);
  tile.className = `ranking-player-tile pool-tile pool-tile--${team}`;
  tile.draggable = true;
  tile.dataset.playerId = player.id;
  tile.dataset.playerData = JSON.stringify({ id: player.id });

  const avatar = el('div', 'pool-tile__avatar', avatarChar(player));
  const body = el('div', 'pool-tile__body');
  const top = el('div', 'pool-tile__top');
  top.appendChild(el('span', 'pool-tile__dot'));
  top.appendChild(el('span', 'pool-tile__name', player.name || ''));
  body.appendChild(top);
  body.appendChild(el('span', 'pool-tile__handle', handleText(player)));

  tile.appendChild(avatar);
  tile.appendChild(body);

  // Tap to place into the next open rank (primary interaction)
  tile.onclick = () => placePlayerAtNextRank(player);
  tile.title = '点一下记入下一个名次';

  // Desktop drag events
  tile.ondragstart = (e) => {
    setDraggedPlayer(player);
    tile.classList.add('dragging', 'pool-tile--dragging');
    e.dataTransfer.effectAllowed = 'move';
    emit('drag:started', { player });
  };

  tile.ondragend = () => {
    tile.classList.remove('dragging', 'pool-tile--dragging');
    setDraggedPlayer(null);
    emit('drag:ended');
  };

  // Touch events (iOS Safari requires inline attach at create-time).
  bindRankingTouchHandlers(tile, player);

  return tile;
}

/**
 * Backward-compat export — main.js / older callers may import this.
 * Returns a pool-style tile.
 * @param {Object} player
 * @returns {HTMLElement}
 */
function createRankingPlayerTile(player) {
  return createPoolTile(player);
}

export { createPoolTile, createRankingPlayerTile };
