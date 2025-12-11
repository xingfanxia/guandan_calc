/**
 * Panel Manager
 * Handles collapsible panels and UI state management
 */

import { $ } from '../core/utils.js';
import { getPlayers, getPlayersByTeam } from '../player/playerManager.js';
import config from '../core/config.js';
import state from '../core/state.js';

/**
 * Lock and collapse team assignment panel after game starts
 */
export function lockTeamAssignmentPanel() {
  const playerSetupSection = $('playerSetupSection');
  const history = state.getHistory();

  // Only lock if there's history (game has started)
  if (history.length > 0 && playerSetupSection) {
    const details = playerSetupSection.querySelector('details');
    if (details) {
      details.open = false; // Collapse
    }

    // Disable team assignment buttons
    const generateBtn = $('generatePlayers');
    const shuffleBtn = $('shuffleTeams');
    const applyBulkBtn = $('applyBulkNames');
    const quickStartBtn = $('quickStart');
    const bulkNamesInput = $('bulkNames');
    // Note: clearRanking and randomRanking should NOT be disabled during gameplay

    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.style.opacity = '0.5';
      generateBtn.title = '游戏进行中，无法修改玩家';
    }
    if (shuffleBtn) {
      shuffleBtn.disabled = true;
      shuffleBtn.style.opacity = '0.5';
      shuffleBtn.title = '游戏进行中，无法重新分配队伍';
    }
    if (applyBulkBtn) {
      applyBulkBtn.disabled = true;
      applyBulkBtn.style.opacity = '0.5';
    }
    if (quickStartBtn) {
      quickStartBtn.disabled = true;
      quickStartBtn.style.opacity = '0.5';
    }
    if (bulkNamesInput) {
      bulkNamesInput.disabled = true;
      bulkNamesInput.style.opacity = '0.5';
    }

    // Disable mode selector
    const modeSelect = $('mode');
    if (modeSelect) {
      modeSelect.disabled = true;
      modeSelect.style.opacity = '0.5';
      modeSelect.title = '游戏进行中，无法更改人数';
    }

    // Disable drag and drop for team assignment
    const unassignedZone = $('unassignedPlayers');
    const team1Zone = $('team1Zone');
    const team2Zone = $('team2Zone');

    [unassignedZone, team1Zone, team2Zone].forEach(zone => {
      if (zone) {
        zone.style.pointerEvents = 'none';
        zone.style.opacity = '0.6';
        zone.classList.add('locked');
      }
    });

    // Disable player tile dragging for team assignment
    const playerTiles = playerSetupSection.querySelectorAll('.player-tile');
    playerTiles.forEach(tile => {
      tile.draggable = false;
      tile.style.cursor = 'not-allowed';
      tile.style.opacity = '0.8';
    });

    // Add lock indicator
    const summary = playerSetupSection.querySelector('summary');
    if (summary) {
      // Prevent opening when locked
      summary.style.cursor = 'not-allowed';

      if (!summary.querySelector('.lock-indicator')) {
        const lockIcon = document.createElement('span');
        lockIcon.className = 'lock-indicator';
        lockIcon.textContent = ' 🔒';
        lockIcon.style.color = '#f59e0b';
        lockIcon.title = '游戏进行中，玩家设置已锁定。重置游戏可解锁。';
        summary.appendChild(lockIcon);
      }

      // Prevent details toggle
      summary.onclick = (e) => {
        if (history.length > 0) {
          e.preventDefault();
          return false;
        }
      };
    }

    // Add compact team roster display
    showCompactTeamRoster();
  }
}

/**
 * Unlock team assignment panel (allow editing again)
 */
export function unlockTeamAssignmentPanel() {
  const playerSetupSection = $('playerSetupSection');
  if (!playerSetupSection) return;

  const details = playerSetupSection.querySelector('details');
  if (details) {
    details.open = true; // Expand
  }

  // Re-enable buttons
  const generateBtn = $('generatePlayers');
  const shuffleBtn = $('shuffleTeams');
  const applyBulkBtn = $('applyBulkNames');
  const quickStartBtn = $('quickStart');
  const bulkNamesInput = $('bulkNames');
  // Note: clearRanking and randomRanking were never disabled

  if (generateBtn) {
    generateBtn.disabled = false;
    generateBtn.style.opacity = '1';
    generateBtn.title = '';
  }
  if (shuffleBtn) {
    shuffleBtn.disabled = false;
    shuffleBtn.style.opacity = '1';
    shuffleBtn.title = '';
  }
  if (applyBulkBtn) {
    applyBulkBtn.disabled = false;
    applyBulkBtn.style.opacity = '1';
  }
  if (quickStartBtn) {
    quickStartBtn.disabled = false;
    quickStartBtn.style.opacity = '1';
  }
  if (bulkNamesInput) {
    bulkNamesInput.disabled = false;
    bulkNamesInput.style.opacity = '1';
  }

  // Re-enable mode selector
  const modeSelect = $('mode');
  if (modeSelect) {
    modeSelect.disabled = false;
    modeSelect.style.opacity = '1';
    modeSelect.title = '';
  }

  // Re-enable drag and drop zones
  const unassignedZone = $('unassignedPlayers');
  const team1Zone = $('team1Zone');
  const team2Zone = $('team2Zone');

  [unassignedZone, team1Zone, team2Zone].forEach(zone => {
    if (zone) {
      zone.style.pointerEvents = '';
      zone.style.opacity = '';
      zone.classList.remove('locked');
    }
  });

  // Re-enable player tile dragging
  const playerTiles = playerSetupSection.querySelectorAll('.player-tile');
  playerTiles.forEach(tile => {
    tile.draggable = true;
    tile.style.cursor = '';
    tile.style.opacity = '';
  });

  // Remove lock indicator and restore summary click
  const summary = playerSetupSection.querySelector('summary');
  if (summary) {
    summary.style.cursor = 'pointer';
    summary.onclick = null; // Remove click blocker

    const lockIndicator = summary.querySelector('.lock-indicator');
    if (lockIndicator) {
      lockIndicator.remove();
    }
  }

  // Remove compact roster
  const compactRoster = playerSetupSection.querySelector('.compact-team-roster');
  if (compactRoster) {
    compactRoster.remove();
  }
}

/**
 * Show compact team roster (player count summary)
 */
export function showCompactTeamRoster() {
  const playerSetupSection = $('playerSetupSection');
  if (!playerSetupSection) return;

  // Remove existing roster if present
  const existingRoster = playerSetupSection.querySelector('.compact-team-roster');
  if (existingRoster) existingRoster.remove();

  // Create compact roster
  const roster = document.createElement('div');
  roster.className = 'compact-team-roster';
  roster.style.cssText = `
    padding: 12px;
    margin-top: 8px;
    background: #1a1b1c;
    border-radius: 8px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    font-size: 13px;
  `;

  const team1Players = getPlayersByTeam(1);
  const team2Players = getPlayersByTeam(2);

  const t1Color = config.getTeamColor('t1');
  const t2Color = config.getTeamColor('t2');
  const t1Name = config.getTeamName('t1');
  const t2Name = config.getTeamName('t2');

  // Team 1 roster
  const team1Div = document.createElement('div');
  team1Div.innerHTML = `
    <div style="color: ${t1Color}; font-weight: bold; margin-bottom: 6px;">${t1Name}</div>
    ${team1Players.map(p => `<div style="display: flex; align-items: center; gap: 6px; padding: 4px 0;">
      <span style="font-size: 16px;">${p.emoji}</span>
      <span>${p.name}</span>
    </div>`).join('')}
  `;

  // Team 2 roster
  const team2Div = document.createElement('div');
  team2Div.innerHTML = `
    <div style="color: ${t2Color}; font-weight: bold; margin-bottom: 6px;">${t2Name}</div>
    ${team2Players.map(p => `<div style="display: flex; align-items: center; gap: 6px; padding: 4px 0;">
      <span style="font-size: 16px;">${p.emoji}</span>
      <span>${p.name}</span>
    </div>`).join('')}
  `;

  roster.appendChild(team1Div);
  roster.appendChild(team2Div);

  // Insert after the entire details element (not inside it)
  const details = playerSetupSection.querySelector('details');
  if (details && details.nextSibling) {
    playerSetupSection.insertBefore(roster, details.nextSibling);
  } else {
    playerSetupSection.appendChild(roster);
  }
}
