/**
 * Room UI Components
 * Handles room banners, viewer controls, and room-specific UI
 */

import { $, escapeHtml } from '../core/utils.js';
import { getRoomInfo } from './roomManager.js';
import {
  initializeViewerVotingSection,
  resetViewerVotingUnlockState,
  showEndGameVotingForViewers,
  showHostVoting,
  stopVotePolling,
  updateVoteLeaderboard
} from './votingManager.js';
import { checkGameEnded } from '../ranking/rankingRenderer.js';
import {
  lockTeamAssignmentPanel,
  showCompactTeamRoster,
  unlockTeamAssignmentPanel
} from '../ui/panelManager.js';
import state from '../core/state.js';
import config from '../core/config.js';

let voteLeaderboardInterval = null;
let roomBannerTimer = null;

function stopVoteLeaderboardPolling() {
  if (voteLeaderboardInterval) {
    clearInterval(voteLeaderboardInterval);
    voteLeaderboardInterval = null;
  }
}

function startVoteLeaderboardPolling() {
  stopVoteLeaderboardPolling();
  voteLeaderboardInterval = setInterval(() => {
    updateVoteLeaderboard();
  }, 3000); // Poll every 3s
}

function clearRoomBanner() {
  if (roomBannerTimer) {
    clearInterval(roomBannerTimer);
    roomBannerTimer = null;
  }

  ['hostBanner', 'viewerBanner'].forEach(id => {
    const existing = $(id);
    if (existing) existing.remove();
  });
}

function clearVotingUI() {
  resetViewerVotingUnlockState();

  const viewerVotingCard = $('viewerVotingCard');
  if (viewerVotingCard) {
    viewerVotingCard.remove();
  }

  const votingSection = $('votingSection');
  if (votingSection) {
    const winnerDisplay = votingSection.querySelector('.winner-display');
    if (winnerDisplay) {
      winnerDisplay.remove();
    }
    votingSection.style.display = 'none';
  }
}

function restoreViewerControls() {
  const buttons = [
    'generatePlayers', 'shuffleTeams', 'applyBulkNames', 'quickStart',
    'clearRanking', 'randomRanking', 'manualCalc',
    'apply', 'advance', 'undo', 'resetMatch',
    'save4', 'save6', 'save8', 'reset4', 'reset6', 'reset8'
  ];

  buttons.forEach(id => {
    const btn = $(id);
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = '';
      btn.title = '';
    }
  });

  const modeSelect = $('mode');
  if (modeSelect) {
    modeSelect.disabled = false;
    modeSelect.style.opacity = '';
  }

  ['must1', 'autoNext', 'autoApply', 'strictA'].forEach(id => {
    const checkbox = $(id);
    if (checkbox) {
      checkbox.disabled = false;
      checkbox.style.opacity = '';
    }
  });

  const bulkNames = $('bulkNames');
  if (bulkNames) {
    bulkNames.disabled = false;
    bulkNames.style.opacity = '';
  }

  document.querySelectorAll('.player-tile, .ranking-player-tile').forEach(tile => {
    tile.draggable = true;
    tile.style.cursor = '';
  });

  document.querySelectorAll('.team-drop-zone, .rank-slot, #playerPool').forEach(zone => {
    zone.style.pointerEvents = '';
    zone.style.opacity = '';
  });

  const viewerLocks = document.querySelectorAll('.viewer-lock');
  viewerLocks.forEach(lock => lock.remove());

  unlockTeamAssignmentPanel();
  if (state.getHistory().length > 0) {
    lockTeamAssignmentPanel();
  }
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getElapsedTime(createdAt) {
  const startedAt = createdAt ? new Date(createdAt).getTime() : Date.now();
  const safeStartedAt = Number.isFinite(startedAt) ? startedAt : Date.now();
  return formatDuration(Math.floor((Date.now() - safeStartedAt) / 1000));
}

function getEndedBannerTime(currentRoomInfo) {
  const gameEnded = checkGameEnded();
  if (!gameEnded) return null;

  const endedAt = currentRoomInfo.finishedAt
    ? new Date(currentRoomInfo.finishedAt).getTime()
    : Date.now();
  const safeEndedAt = Number.isFinite(endedAt) ? endedAt : Date.now();
  const startedAt = currentRoomInfo.createdAt
    ? new Date(currentRoomInfo.createdAt).getTime()
    : safeEndedAt;
  const safeStartedAt = Number.isFinite(startedAt) ? startedAt : safeEndedAt;

  return {
    timeStr: formatDuration(Math.floor((safeEndedAt - safeStartedAt) / 1000)),
    hasAuthoritativeFinishedAt: Boolean(currentRoomInfo.finishedAt)
  };
}

function shouldRunRoomBannerTimer(currentRoomInfo) {
  const endedBannerTime = getEndedBannerTime(currentRoomInfo);
  return !endedBannerTime?.hasAuthoritativeFinishedAt;
}

function getEndedBannerStatusText() {
  const gameStatus = state.getGameStatus();
  if (!gameStatus?.ended) return '游戏已结束';

  const winnerName = typeof gameStatus.winnerName === 'string' && gameStatus.winnerName.trim()
    ? gameStatus.winnerName.trim()
    : (gameStatus.winnerKey === 't1' || gameStatus.winnerKey === 't2'
      ? config.getTeamName(gameStatus.winnerKey)
      : '');

  return winnerName
    ? `${winnerName}通关`
    : '游戏已结束';
}

export function clearRoomUI() {
  stopVoteLeaderboardPolling();
  stopVotePolling();
  clearVotingUI();
  restoreViewerControls();
  clearRoomBanner();
}

/**
 * Show room-specific UI (banner, voting section)
 */
export function showRoomUI() {
  clearRoomUI();

  const roomInfo = getRoomInfo();

  if (roomInfo.isHost) {
    // Show host banner
    showHostBanner(roomInfo.roomCode, roomInfo.authToken);
    // Show host voting interface
    setTimeout(() => showHostVoting(), 1000);
    // Start polling vote leaderboard
    startVoteLeaderboardPolling();
  } else if (roomInfo.isViewer) {
    // Show viewer banner
    showViewerBanner(roomInfo.roomCode);
    // Disable all controls for viewers
    disableViewerControls();
    // Initialize locked voting section
    initializeViewerVotingSection();
    
    // Also poll vote leaderboard for viewers
    startVoteLeaderboardPolling();

    // Check if game already ended (manual check for instant unlock)
    if (checkGameEnded()) {
      showEndGameVotingForViewers();
    }
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
  clearRoomBanner();

  const banner = document.createElement('div');
  banner.id = 'hostBanner';
  banner.className = 'room-banner room-banner--host';
  // Inline styling kept minimal — actual look is in theme.css per-theme.

  const safeRoomCode = escapeHtml(roomCode);
  const viewerURL = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`;

  const updateBannerContent = () => {
    const currentRoomInfo = getRoomInfo();

    const endedBannerTime = getEndedBannerTime(currentRoomInfo);
    if (endedBannerTime) {
      const endedStatusText = escapeHtml(getEndedBannerStatusText());
      banner.innerHTML = `
        <strong>📺 房主模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${safeRoomCode}</strong>
        | ⏱️ <strong>${endedBannerTime.timeStr}</strong> ✅
        | <span style="font-size: 12px; opacity: 0.9;">${endedStatusText}</span>
      `;
      return endedBannerTime.hasAuthoritativeFinishedAt;
    }
    
    // Game still running - calculate from createdAt
    const timeStr = getElapsedTime(currentRoomInfo.createdAt);
    
    banner.innerHTML = `
      <strong>📺 房主模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${safeRoomCode}</strong>
      | ⏱️ <strong>${timeStr}</strong>
      | <span style="font-size: 12px; opacity: 0.9;">点击横幅复制观众链接</span>
    `;
    return false;
  };

  updateBannerContent();
  
  // Keep ticking until the game has ended and the server-owned finishedAt has synced back.
  if (shouldRunRoomBannerTimer(getRoomInfo())) {
    roomBannerTimer = setInterval(() => {
      const shouldStop = updateBannerContent();
      if (shouldStop) {
        console.log('⏱️ Timer stopped - finishedAt synced');
        clearInterval(roomBannerTimer);
        roomBannerTimer = null;
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
  clearRoomBanner();

  const banner = document.createElement('div');
  banner.id = 'viewerBanner';
  banner.className = 'room-banner room-banner--viewer';
  const safeRoomCode = escapeHtml(roomCode);

  const updateBannerContent = () => {
    const currentRoomInfo = getRoomInfo();

    const endedBannerTime = getEndedBannerTime(currentRoomInfo);
    if (endedBannerTime) {
      const endedStatusText = escapeHtml(getEndedBannerStatusText());
      banner.innerHTML = `
        <strong>👀 观看模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${safeRoomCode}</strong>
        | ⏱️ <strong>${endedBannerTime.timeStr}</strong> ✅
        | <span style="font-size: 12px; opacity: 0.9;">${endedStatusText}</span>
      `;
      return endedBannerTime.hasAuthoritativeFinishedAt;
    }
    
    // Game still running - calculate from createdAt
    const timeStr = getElapsedTime(currentRoomInfo.createdAt);
    
    banner.innerHTML = `
      <strong>👀 观看模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${safeRoomCode}</strong>
      | ⏱️ <strong>${timeStr}</strong>
      | <span style="font-size: 12px; opacity: 0.9;">实时观看房主比赛</span>
    `;
    return false;
  };

  updateBannerContent();
  
  // Keep ticking until the game has ended and the server-owned finishedAt has synced back.
  if (shouldRunRoomBannerTimer(getRoomInfo())) {
    roomBannerTimer = setInterval(() => {
      const shouldStop = updateBannerContent();
      if (shouldStop) {
        console.log('⏱️ Timer stopped - finishedAt synced');
        clearInterval(roomBannerTimer);
        roomBannerTimer = null;
      }
    }, 1000);
  }

  document.body.insertBefore(banner, document.body.firstChild);
}
