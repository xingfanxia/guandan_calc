/**
 * Panel Manager
 * Handles collapsible panels and UI state management
 */

import { $ } from '../core/utils.js';
import { getPlayers } from '../player/playerManager.js';
import config from '../core/config.js';

/**
 * Lock and collapse team assignment panel after game starts
 */
export function lockTeamAssignmentPanel() {
  const playerSetupSection = $('playerSetupSection');
  if (!playerSetupSection) return;

  // Collapse the panel
  playerSetupSection.style.maxHeight = '60px';
  playerSetupSection.style.overflow = 'hidden';
  playerSetupSection.style.transition = 'max-height 0.3s ease';

  // Add expand button
  const expandBtn = document.createElement('button');
  expandBtn.id = 'expandPlayerSetup';
  expandBtn.textContent = '▼ 展开玩家设置';
  expandBtn.style.cssText = 'margin-top: 8px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;';

  expandBtn.onclick = () => {
    if (playerSetupSection.style.maxHeight === '60px') {
      playerSetupSection.style.maxHeight = '2000px';
      expandBtn.textContent = '▲ 收起玩家设置';
    } else {
      playerSetupSection.style.maxHeight = '60px';
      expandBtn.textContent = '▼ 展开玩家设置';
    }
  };

  playerSetupSection.appendChild(expandBtn);
}

/**
 * Unlock team assignment panel (allow editing again)
 */
export function unlockTeamAssignmentPanel() {
  const playerSetupSection = $('playerSetupSection');
  if (!playerSetupSection) return;

  // Remove expand button
  const expandBtn = $('expandPlayerSetup');
  if (expandBtn) {
    expandBtn.remove();
  }

  // Restore full height
  playerSetupSection.style.maxHeight = 'none';
  playerSetupSection.style.overflow = 'visible';
}

/**
 * Show compact team roster (player count summary)
 */
export function showCompactTeamRoster() {
  const players = getPlayers();
  const t1Players = players.filter(p => p.team === 't1');
  const t2Players = players.filter(p => p.team === 't2');

  const existing = $('compactRoster');
  if (existing) {
    existing.remove();
  }

  const rankingArea = $('rankingArea');
  if (!rankingArea) return;

  const compactDiv = document.createElement('div');
  compactDiv.id = 'compactRoster';
  compactDiv.style.cssText = 'background: #1a1a1a; padding: 12px; margin-bottom: 16px; border-radius: 8px; display: flex; justify-content: space-around; border: 1px solid #333;';

  const t1Color = config.getTeamColor('t1');
  const t2Color = config.getTeamColor('t2');
  const t1Name = config.getTeamName('t1');
  const t2Name = config.getTeamName('t2');

  compactDiv.innerHTML = `
    <div style="text-align: center;">
      <div style="color: ${t1Color}; font-weight: bold; margin-bottom: 4px;">${t1Name}</div>
      <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
        ${t1Players.map(p => `<span style="background: ${t1Color}22; border: 1px solid ${t1Color}; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${p.emoji} ${p.name}</span>`).join('')}
      </div>
    </div>
    <div style="text-align: center;">
      <div style="color: ${t2Color}; font-weight: bold; margin-bottom: 4px;">${t2Name}</div>
      <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
        ${t2Players.map(p => `<span style="background: ${t2Color}22; border: 1px solid ${t2Color}; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${p.emoji} ${p.name}</span>`).join('')}
      </div>
    </div>
  `;

  rankingArea.insertBefore(compactDiv, rankingArea.firstChild);
}
