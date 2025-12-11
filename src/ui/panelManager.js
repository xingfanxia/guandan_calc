/**
 * Panel Manager
 * Handles collapsible panels and UI state management
 */

import { $ } from '../core/utils.js';
import { getPlayers, getPlayersByTeam } from '../player/playerManager.js';
import config from '../core/config.js';

/**
 * Lock and collapse team assignment panel after game starts
 */
export function lockTeamAssignmentPanel() {
  const playerSetupSection = $('playerSetupSection');
  if (!playerSetupSection) return;

  // First show the compact roster
  showCompactTeamRoster();

  // Collapse the details element
  const details = playerSetupSection.querySelector('details');
  if (details) {
    details.open = false;
  }

  // Prevent opening the details
  const summary = playerSetupSection.querySelector('summary');
  if (summary) {
    summary.style.cursor = 'not-allowed';
    summary.onclick = (e) => {
      e.preventDefault();
      return false;
    };

    // Add lock icon
    if (!summary.querySelector('.lock-indicator')) {
      const lockIcon = document.createElement('span');
      lockIcon.className = 'lock-indicator';
      lockIcon.textContent = ' 🔒';
      lockIcon.style.color = '#f59e0b';
      lockIcon.title = '游戏进行中，玩家设置已锁定';
      summary.appendChild(lockIcon);
    }
  }
}

/**
 * Unlock team assignment panel (allow editing again)
 */
export function unlockTeamAssignmentPanel() {
  const playerSetupSection = $('playerSetupSection');
  if (!playerSetupSection) return;

  // Remove lock icon
  const lockIcon = playerSetupSection.querySelector('.lock-indicator');
  if (lockIcon) {
    lockIcon.remove();
  }

  // Re-enable summary click
  const summary = playerSetupSection.querySelector('summary');
  if (summary) {
    summary.style.cursor = 'pointer';
    summary.onclick = null;
  }

  // Remove compact roster
  const compactRoster = playerSetupSection.querySelector('.compact-team-roster');
  if (compactRoster) {
    compactRoster.remove();
  }

  // Expand details
  const details = playerSetupSection.querySelector('details');
  if (details) {
    details.open = true;
  }
}

/**
 * Show compact team roster (player count summary)
 */
export function showCompactTeamRoster() {
  const playerSetupSection = $('playerSetupSection');
  if (!playerSetupSection) return;

  const players = getPlayers();
  const t1Players = players.filter(p => p.team === 't1');
  const t2Players = players.filter(p => p.team === 't2');

  // Remove existing roster if present
  const existing = playerSetupSection.querySelector('.compact-team-roster');
  if (existing) {
    existing.remove();
  }

  const compactDiv = document.createElement('div');
  compactDiv.className = 'compact-team-roster';
  compactDiv.style.cssText = 'padding: 12px; margin-top: 8px; background: #1a1b1c; border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;';

  const t1Color = config.getTeamColor('t1');
  const t2Color = config.getTeamColor('t2');
  const t1Name = config.getTeamName('t1');
  const t2Name = config.getTeamName('t2');

  // Team 1 roster
  const team1Div = document.createElement('div');
  team1Div.innerHTML = `
    <div style="color: ${t1Color}; font-weight: bold; margin-bottom: 6px;">${t1Name}</div>
    ${t1Players.map(p => `<div style="display: flex; align-items: center; gap: 6px; padding: 4px 0;">
      <span style="font-size: 16px;">${p.emoji}</span>
      <span>${p.name}</span>
    </div>`).join('')}
  `;

  // Team 2 roster
  const team2Div = document.createElement('div');
  team2Div.innerHTML = `
    <div style="color: ${t2Color}; font-weight: bold; margin-bottom: 6px;">${t2Name}</div>
    ${t2Players.map(p => `<div style="display: flex; align-items: center; gap: 6px; padding: 4px 0;">
      <span style="font-size: 16px;">${p.emoji}</span>
      <span>${p.name}</span>
    </div>`).join('')}
  `;

  compactDiv.appendChild(team1Div);
  compactDiv.appendChild(team2Div);

  // Insert after the details element (not inside it)
  const details = playerSetupSection.querySelector('details');
  if (details && details.nextSibling) {
    playerSetupSection.insertBefore(compactDiv, details.nextSibling);
  } else {
    playerSetupSection.appendChild(compactDiv);
  }
}
