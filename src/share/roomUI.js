/**
 * Room UI Components
 * Handles room banners, viewer controls, and room-specific UI
 */

import { $ } from '../core/utils.js';
import { getRoomInfo } from './roomManager.js';
import { initializeViewerVotingSection, showEndGameVotingForViewers, showHostVoting, updateVoteLeaderboard } from './votingManager.js';
import state from '../core/state.js';

/**
 * Show room-specific UI (banner, voting section)
 */
export function showRoomUI() {
  const roomInfo = getRoomInfo();

  if (roomInfo.isHost) {
    // Show host banner
    showHostBanner(roomInfo.roomCode, roomInfo.authToken);
    // Show host voting interface
    setTimeout(() => showHostVoting(), 1000);
    // Start polling vote leaderboard
    setInterval(() => {
      updateVoteLeaderboard();
    }, 3000); // Poll every 3s
  } else if (roomInfo.isViewer) {
    // Show viewer banner
    showViewerBanner(roomInfo.roomCode);
    // Disable all controls for viewers
    disableViewerControls();
    // Initialize locked voting section
    initializeViewerVotingSection();

    // Check if game already ended (manual check for instant unlock)
    setTimeout(() => {
      const history = state.getHistory();
      if (history.length > 0) {
        const latestGame = history[history.length - 1];
        if (latestGame.aNote && latestGame.aNote.includes('通关')) {
          showEndGameVotingForViewers();
        }
      }
    }, 500);
  }
}

/**
 * Disable all controls for viewers (read-only mode)
 */
export function disableViewerControls() {
  const { showCompactTeamRoster } = require('../ui/panelManager.js');
  
  // Disable all buttons and inputs
  const allButtons = document.querySelectorAll('button:not(#leaveRoom):not(.vote-btn)');
  const allInputs = document.querySelectorAll('input, select');
  const allLabels = document.querySelectorAll('label');

  allButtons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.3';
    btn.style.cursor = 'not-allowed';
  });

  allInputs.forEach(input => {
    input.disabled = true;
    input.style.opacity = '0.5';
    input.style.cursor = 'not-allowed';
  });

  allLabels.forEach(label => {
    label.style.opacity = '0.5';
  });

  // Disable drag & drop
  const draggables = document.querySelectorAll('[draggable="true"]');
  draggables.forEach(el => {
    el.draggable = false;
    el.style.cursor = 'not-allowed';
  });

  // Hide player setup section for viewers
  const playerSetup = $('playerSetupSection');
  if (playerSetup) {
    playerSetup.style.display = 'none';
  }

  // Hide settings for viewers
  const settingsSection = $('settingsSection');
  if (settingsSection) {
    settingsSection.style.display = 'none';
  }

  // Show compact team roster for viewers
  showCompactTeamRoster();

  // Show viewer tip
  const rankingArea = $('rankingArea');
  if (rankingArea) {
    const tip = document.createElement('div');
    tip.className = 'viewer-tip';
    tip.style.cssText = 'background: #2a1a2a; border: 1px solid #a855f7; padding: 12px; margin-bottom: 16px; border-radius: 8px; text-align: center; color: #a855f7;';
    tip.innerHTML = '👁️ <strong>观看模式</strong> - 只能查看，无法操作。等待房主更新...';
    rankingArea.insertBefore(tip, rankingArea.firstChild);
  }
}

/**
 * Show host banner with room code and copy functionality
 */
export function showHostBanner(roomCode, authToken) {
  const existing = document.querySelector('.room-banner');
  if (existing) return; // Already shown

  const banner = document.createElement('div');
  banner.className = 'room-banner host-banner';
  banner.style.cssText = `
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    padding: 16px 24px;
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    margin: 0;
    position: sticky;
    top: 0;
    z-index: 1000;
    cursor: pointer;
  `;

  const shareURL = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  const updateBanner = () => {
    const duration = state.getSessionDuration();
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    banner.innerHTML = `
      📺 <span style="font-size: 24px; letter-spacing: 3px; margin: 0 12px;">${roomCode}</span>
      | ⏱️ <strong>${timeStr}</strong>
      <span style="font-size: 14px; opacity: 0.9; margin-left: 12px;">点击复制观众链接</span>
    `;
  };

  updateBanner();
  
  // Update timer every second
  const timerInterval = setInterval(() => {
    const { checkGameEnded } = require('../ranking/rankingRenderer.js');
    if (checkGameEnded()) {
      clearInterval(timerInterval);
      updateBanner();
      banner.innerHTML += ' ✅ <span style="font-size: 14px;">游戏已结束</span>';
    } else {
      updateBanner();
    }
  }, 1000);

  banner.onclick = () => {
    navigator.clipboard.writeText(shareURL).then(() => {
      const originalHTML = banner.innerHTML;
      banner.innerHTML = '✅ 已复制观众链接！分享给朋友观看比赛';
      banner.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
      setTimeout(() => {
        banner.innerHTML = originalHTML;
        banner.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
      }, 2000);
    }).catch(err => {
      alert('复制失败，请手动复制链接:\n' + shareURL);
    });
  };

  document.body.insertBefore(banner, document.body.firstChild);
}

/**
 * Show viewer banner with room code
 */
export function showViewerBanner(roomCode) {
  const existing = document.querySelector('.room-banner');
  if (existing) return; // Already shown

  const banner = document.createElement('div');
  banner.className = 'room-banner viewer-banner';
  banner.style.cssText = `
    background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
    color: white;
    padding: 16px 24px;
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
    margin: 0;
    position: sticky;
    top: 0;
    z-index: 1000;
  `;

  const updateBanner = () => {
    const duration = state.getSessionDuration();
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    banner.innerHTML = `
      👁️ 观看模式 - 房间代码: <span style="font-size: 22px; letter-spacing: 2px; margin: 0 8px;">${roomCode}</span>
      | ⏱️ <strong>${timeStr}</strong>
    `;
  };

  updateBanner();
  
  // Update timer every second
  const timerInterval = setInterval(() => {
    const { checkGameEnded } = require('../ranking/rankingRenderer.js');
    if (checkGameEnded()) {
      clearInterval(timerInterval);
      updateBanner();
      banner.innerHTML += ' ✅ <span style="font-size: 14px;">游戏已结束</span>';
    } else {
      updateBanner();
    }
  }, 1000);

  document.body.insertBefore(banner, document.body.firstChild);
}
