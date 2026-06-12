/**
 * Player Renderer - Player UI Rendering
 *
 * Two render modes for player presence:
 *   1. `.player-tile` — unassigned/setup zone. Shows emoji + editable name input.
 *      Used in #unassignedPlayers (player setup section).
 *   2. `.roster-row` — scoreboard team zones. Editorial display: avatar + display
 *      name + handle + role tag (POOL / DRAG… / 头游 #1 / etc). Read-only.
 *      Used in #team1Zone / #team2Zone. Matches demo-broadcast-v3 markup.
 *
 * Both modes are draggable (drag source for team reassignment).
 */

import { $, on } from '../core/utils.js';
import { getPlayers, getPlayersByTeam, normalizeTeamNumber, updatePlayer } from './playerManager.js';
import { getRanking } from '../ranking/rankingManager.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';
import { normalizePlayerCountMode } from '../core/playerCountMode.js';
import { resolveAvatarPhoto } from './photoRenderer.js';

export let draggedPlayer = null;

export function setDraggedPlayer(player) {
  draggedPlayer = player;
}

export function getDraggedPlayer() {
  return draggedPlayer;
}

const RANK_NAMES = {
  4: ['头游', '二游', '三游', '末游'],
  6: ['头游', '二游', '三游', '四游', '五游', '末游'],
  8: ['头游', '二游', '三游', '四游', '五游', '六游', '七游', '末游']
};

function avatarChar(player) {
  if (!player) return '?';
  if (player.emoji) return player.emoji;
  const name = (player.name || '').trim();
  if (!name) return '?';
  const digitMatch = name.match(/^玩家(\d+)$/);
  if (digitMatch) return digitMatch[1];
  return Array.from(name)[0];
}

// Unranked players carry NO tag (an empty tag collapses via CSS :empty) —
// the tag only appears once a rank is recorded: 「头游 #1」…「末游 #8」.
function rosterTagFor(player) {
  if (!player) return { text: '', modifier: '' };
  const ranking = getRanking();
  const modeEl = $('mode');
  const mode = normalizePlayerCountMode(modeEl ? modeEl.value : 8);
  if (!mode) return { text: '', modifier: '' };
  const names = RANK_NAMES[mode] || RANK_NAMES[8];

  for (let rank = 1; rank <= mode; rank++) {
    if (ranking[rank] === player.id) {
      const isLast = rank === mode;
      return {
        text: `${names[rank - 1]} #${rank}`,
        modifier: isLast ? 'roster-row__tag--last' : 'roster-row__tag--ranked'
      };
    }
  }
  return { text: '', modifier: '' };
}

function makeEmptyZoneLabel(text) {
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = text;
  return label;
}

/**
 * Build a `.roster-row` element for a team-scoreboard player.
 * Markup matches demo-broadcast-v3.html lines 457-471.
 */
export function createRosterRow(player) {
  const row = document.createElement('article');
  row.className = 'roster-row';
  row.draggable = true;
  row.dataset.playerId = player.id;
  row.dataset.attachTouchHandlers = 'true';
  row.dataset.playerData = JSON.stringify({ id: player.id });

  const avatar = document.createElement('div');
  avatar.className = `roster-row__avatar roster-row__avatar--${normalizeTeamNumber(player.team) === 1 ? 'blue' : 'red'}`;
  const avatarPhoto = resolveAvatarPhoto(player);
  if (avatarPhoto) {
    const img = document.createElement('img');
    img.src = avatarPhoto;
    img.alt = '';
    avatar.appendChild(img);
  } else {
    avatar.textContent = avatarChar(player);
  }

  const nameBlock = document.createElement('div');
  nameBlock.className = 'roster-row__name';

  const display = document.createElement('span');
  display.className = 'roster-row__display';
  display.textContent = player.name || '玩家';
  nameBlock.appendChild(display);

  const handle = document.createElement('span');
  handle.className = 'roster-row__handle';
  // Profile players show "@handle"; session players have no handle and the
  // avatar already shows the emoji, so leave this line empty rather than
  // duplicating the emoji.
  handle.textContent = player.handle ? `@${player.handle}` : '';
  nameBlock.appendChild(handle);

  const tagInfo = rosterTagFor(player);
  const tag = document.createElement('span');
  tag.className = `roster-row__tag ${tagInfo.modifier}`.trim();
  tag.textContent = tagInfo.text;

  row.appendChild(avatar);
  row.appendChild(nameBlock);
  row.appendChild(tag);

  if (player.handle) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'roster-row__remove';
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.title = '从本局移除';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      emit('player:removeRequested', { playerId: player.id });
    };
    row.appendChild(removeBtn);
  }

  row.ondragstart = (e) => {
    draggedPlayer = player;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  };

  row.ondragend = () => {
    row.classList.remove('dragging');
    draggedPlayer = null;
  };

  return row;
}

/**
 * Render all players in their respective zones.
 * Team zones get .roster-row markup; unassigned zone gets .player-tile.
 */
export function renderPlayers() {
  const unassignedEl = $('unassignedPlayers');
  const team1ZoneEl = $('team1Zone');
  const team2ZoneEl = $('team2Zone');

  if (!unassignedEl || !team1ZoneEl || !team2ZoneEl) {
    console.warn('Player zone elements not found');
    return;
  }

  unassignedEl.replaceChildren();
  team1ZoneEl.replaceChildren();
  team2ZoneEl.replaceChildren();

  const team1Players = getPlayersByTeam(1);
  const team2Players = getPlayersByTeam(2);

  if (team1Players.length === 0) {
    team1ZoneEl.appendChild(makeEmptyZoneLabel('拖拽玩家到这里分配队伍'));
  }
  if (team2Players.length === 0) {
    team2ZoneEl.appendChild(makeEmptyZoneLabel('拖拽玩家到这里分配队伍'));
  }

  const players = getPlayers();
  players.forEach(player => {
    const team = normalizeTeamNumber(player.team);
    if (team === 1) {
      team1ZoneEl.appendChild(createRosterRow(player));
    } else if (team === 2) {
      team2ZoneEl.appendChild(createRosterRow(player));
    } else {
      unassignedEl.appendChild(createPlayerTile(player));
    }
  });

  updateTeamLabels();
  emit('ui:playersRendered');
}

/**
 * Re-render only the team-zone rosters (cheap incremental update for ranking
 * changes — keeps the .roster-row__tag values fresh as ranks shift).
 */
export function renderTeamRosters() {
  const team1ZoneEl = $('team1Zone');
  const team2ZoneEl = $('team2Zone');
  if (!team1ZoneEl || !team2ZoneEl) return;

  const t1 = getPlayersByTeam(1);
  const t2 = getPlayersByTeam(2);

  team1ZoneEl.replaceChildren();
  team2ZoneEl.replaceChildren();

  if (t1.length === 0) {
    team1ZoneEl.appendChild(makeEmptyZoneLabel('拖拽玩家到这里分配队伍'));
  } else {
    t1.forEach(p => team1ZoneEl.appendChild(createRosterRow(p)));
  }

  if (t2.length === 0) {
    team2ZoneEl.appendChild(makeEmptyZoneLabel('拖拽玩家到这里分配队伍'));
  } else {
    t2.forEach(p => team2ZoneEl.appendChild(createRosterRow(p)));
  }
}

/**
 * Create player tile element (used in unassigned/setup zone only).
 * Editable name input, emoji, drag handlers. Profile players' names are locked.
 */
export function createPlayerTile(player, onDragStart, onDragEnd) {
  const tile = document.createElement('div');
  tile.className = 'player-tile';
  tile.draggable = true;
  tile.dataset.playerId = player.id;

  const emoji = document.createElement('span');
  emoji.className = 'emoji';
  emoji.textContent = player.emoji;

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = player.name;
  nameInput.onclick = (e) => e.stopPropagation();

  if (player.handle) {
    nameInput.disabled = true;
    nameInput.style.cursor = 'not-allowed';
    nameInput.title = `来自玩家资料 @${player.handle}`;
  }

  if (!player.handle) {
    let updateTimer = null;
    nameInput.oninput = function () {
      const newName = this.value;
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        updatePlayer(player.id, { name: newName });
        emit('ui:playerNameChanged', { playerId: player.id, name: newName });
      }, 300);
    };

    nameInput.onchange = function () {
      if (updateTimer) clearTimeout(updateTimer);
      updatePlayer(player.id, { name: this.value });
      emit('ui:playerNameChanged', { playerId: player.id, name: this.value });
    };
  }

  tile.appendChild(emoji);
  tile.appendChild(nameInput);

  if (player.handle) {
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'remove-player-btn';
    removeBtn.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #ef4444;
      color: white;
      border: 2px solid #1a1a1a;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    `;
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      emit('player:removeRequested', { playerId: player.id });
    };
    tile.style.position = 'relative';
    tile.appendChild(removeBtn);
  }

  tile.ondragstart = (e) => {
    draggedPlayer = player;
    tile.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(e, player);
  };

  tile.ondragend = () => {
    tile.classList.remove('dragging');
    draggedPlayer = null;
    if (onDragEnd) onDragEnd();
  };

  tile.dataset.attachTouchHandlers = 'true';
  tile.dataset.playerData = JSON.stringify({ id: player.id });

  return tile;
}

export function attachTouchHandlers(tile, player, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel = null) {
  const startHandler = (e) => {
    handleTouchStart(e, player);
  };

  tile.addEventListener('touchstart', startHandler, { passive: false });
  tile.addEventListener('touchmove', handleTouchMove, { passive: false });
  tile.addEventListener('touchend', handleTouchEnd, { passive: false });
  tile.addEventListener('touchcancel', handleTouchCancel || handleTouchEnd, { passive: false });
}

export function updateTeamLabels() {
  const team1Label = $('team1Label');
  const team2Label = $('team2Label');

  if (team1Label) {
    team1Label.textContent = config.getTeamName('t1');
    team1Label.style.color = config.getTeamColor('t1');
  }

  if (team2Label) {
    team2Label.textContent = config.getTeamName('t2');
    team2Label.style.color = config.getTeamColor('t2');
  }
}
