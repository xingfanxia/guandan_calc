/**
 * Room UI Components
 * Handles room banners, viewer controls, and room-specific UI
 */

import { $ } from '../core/utils.js';
import { getRoomInfo } from './roomManager.js';
import { initializeViewerVotingSection, showEndGameVotingForViewers, showHostVoting, updateVoteLeaderboard } from './votingManager.js';
import state from '../core/state.js';
import { checkGameEnded } from '../ranking/rankingRenderer.js';
import { showCompactTeamRoster } from '../ui/panelManager.js';

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
    
    // Also poll vote leaderboard for viewers
    setInterval(() => {
      updateVoteLeaderboard();
    }, 3000); // Poll every 3s

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
  const playerSetupSection = $('playerSetupSection');

  if (playerSetupSection) {
    // Collapse and lock the player setup section
    const details = playerSetupSection.querySelector('details');
    if (details) {
      details.open = false; // Collapse
    }

    // Prevent opening
    const summary = playerSetupSection.querySelector('summary');
    if (summary) {
      summary.style.cursor = 'not-allowed';
      summary.onclick = (e) => {
        e.preventDefault();
        return false;
      };

      // Add lock icon to summary
      if (!summary.querySelector('.viewer-lock')) {
        const lockIcon = document.createElement('span');
        lockIcon.className = 'viewer-lock';
        lockIcon.textContent = ' 🔒';
        lockIcon.style.color = '#10b981';
        lockIcon.title = '观看模式：只读';
        summary.appendChild(lockIcon);
      }
    }

    // Show compact team roster
    showCompactTeamRoster();
  }

  // Disable all buttons except export
  const buttons = [
    'generatePlayers', 'shuffleTeams', 'applyBulkNames', 'quickStart',
    'clearRanking', 'randomRanking', 'manualCalc',
    'apply', 'advance', 'undo', 'resetMatch',
    'save4', 'save6', 'save8', 'reset4', 'reset6', 'reset8'
  ];

  buttons.forEach(id => {
    const btn = $(id);
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = '观看模式：只读，无法操作';
    }
  });

  // Disable mode selector and inputs
  const modeSelect = $('mode');
  if (modeSelect) {
    modeSelect.disabled = true;
    modeSelect.style.opacity = '0.5';
  }

  ['must1', 'autoNext', 'autoApply', 'strictA'].forEach(id => {
    const checkbox = $(id);
    if (checkbox) {
      checkbox.disabled = true;
      checkbox.style.opacity = '0.5';
    }
  });

  const bulkNames = $('bulkNames');
  if (bulkNames) {
    bulkNames.disabled = true;
    bulkNames.style.opacity = '0.5';
  }

  // Disable all drag and drop
  const playerTiles = document.querySelectorAll('.player-tile, .ranking-player-tile');
  playerTiles.forEach(tile => {
    tile.draggable = false;
    tile.style.cursor = 'default';
  });

  const dropZones = document.querySelectorAll('.team-drop-zone, .rank-slot, #playerPool');
  dropZones.forEach(zone => {
    zone.style.pointerEvents = 'none';
    zone.style.opacity = '0.7';
  });
}

/**
 * Show host banner with room code and copy functionality
 */
export function showHostBanner(roomCode, authToken) {
  const banner = document.createElement('div');
  banner.id = 'hostBanner';
  banner.className = 'room-banner room-banner--host';
  // Inline styling kept minimal — actual look is in theme.css per-theme.

  const viewerURL = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
  const roomInfo = getRoomInfo();

  const updateBannerContent = () => {
    // Check if game is finished (static time)
    if (roomInfo.finishedAt && roomInfo.createdAt) {
      const duration = Math.floor((new Date(roomInfo.finishedAt).getTime() - new Date(roomInfo.createdAt).getTime()) / 1000);
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      
      banner.innerHTML = `
        <strong>📺 房主模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${roomCode}</strong>
        | ⏱️ <strong>${timeStr}</strong> ✅
        | <span style="font-size: 12px; opacity: 0.9;">游戏已结束</span>
      `;
      return true; // Signal to stop interval
    }
    
    // Game still running - calculate from createdAt
    const sessionStart = roomInfo.createdAt ? new Date(roomInfo.createdAt).getTime() : Date.now();
    const duration = Math.floor((Date.now() - sessionStart) / 1000);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    banner.innerHTML = `
      <strong>📺 房主模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${roomCode}</strong>
      | ⏱️ <strong>${timeStr}</strong>
      | <span style="font-size: 12px; opacity: 0.9;">点击横幅复制观众链接</span>
    `;
    return false;
  };

  updateBannerContent();
  
  // Only run interval if game not finished
  if (!roomInfo.finishedAt) {
    const timerInterval = setInterval(() => {
      const gameEnded = checkGameEnded();
      const shouldStop = updateBannerContent();
      if (shouldStop) {
        console.log('⏱️ Timer stopped - game ended:', gameEnded);
        clearInterval(timerInterval);
      }
    }, 1000);
  }

  banner.onclick = async () => {
    try {
      await navigator.clipboard.writeText(viewerURL);
      const note = document.createElement('span');
      note.className = 'room-banner__copied';
      note.textContent = ' ✅ 已复制';
      banner.appendChild(note);
      setTimeout(() => {
        updateBannerContent();
      }, 2000);
    } catch (e) {
      alert(viewerURL);
    }
  };

  document.body.insertBefore(banner, document.body.firstChild);
}

/**
 * Show viewer banner with room code
 */
export function showViewerBanner(roomCode) {
  const banner = document.createElement('div');
  banner.id = 'viewerBanner';
  banner.className = 'room-banner room-banner--viewer';

  const roomInfo = getRoomInfo();

  const updateBannerContent = () => {
    // Check if game is finished (static time)
    if (roomInfo.finishedAt && roomInfo.createdAt) {
      const duration = Math.floor((new Date(roomInfo.finishedAt).getTime() - new Date(roomInfo.createdAt).getTime()) / 1000);
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      
      banner.innerHTML = `
        <strong>👀 观看模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${roomCode}</strong>
        | ⏱️ <strong>${timeStr}</strong> ✅
        | <span style="font-size: 12px; opacity: 0.9;">游戏已结束</span>
      `;
      return true; // Signal to stop interval
    }
    
    // Game still running - calculate from createdAt
    const sessionStart = roomInfo.createdAt ? new Date(roomInfo.createdAt).getTime() : Date.now();
    const duration = Math.floor((Date.now() - sessionStart) / 1000);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    banner.innerHTML = `
      <strong>👀 观看模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${roomCode}</strong>
      | ⏱️ <strong>${timeStr}</strong>
      | <span style="font-size: 12px; opacity: 0.9;">实时观看房主比赛</span>
    `;
    return false;
  };

  updateBannerContent();
  
  // Only run interval if game not finished
  if (!roomInfo.finishedAt) {
    const timerInterval = setInterval(() => {
      const gameEnded = checkGameEnded();
      const shouldStop = updateBannerContent();
      if (shouldStop) {
        console.log('⏱️ Timer stopped - game ended:', gameEnded);
        clearInterval(timerInterval);
      }
    }, 1000);
  }

  document.body.insertBefore(banner, document.body.firstChild);
}
