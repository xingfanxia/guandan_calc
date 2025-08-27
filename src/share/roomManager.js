// Real-time room management with Vercel KV
// UTF-8 encoding for Chinese characters

import { now } from '../utils/dom.js';

class RoomManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.currentRoomCode = null;
    this.isHost = false;
    this.isViewer = false;
    this.pollInterval = null;
    this.lastUpdate = null;
    
    // Check for room code in URL
    this.checkURLForRoom();
  }

  /**
   * Check URL for room parameter
   */
  checkURLForRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    
    if (roomCode) {
      this.joinRoom(roomCode);
    }
  }

  /**
   * Generate room code
   * @returns {string} Room code format: ROOM-XXXX
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'ROOM-';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create game data for sharing
   * @returns {Object} Game data object
   */
  createGameData() {
    return {
      settings: {
        t1: this.gameState.settings.t1,
        t2: this.gameState.settings.t2,
        strictA: this.gameState.settings.strictA,
        must1: this.gameState.settings.must1,
        autoNext: this.gameState.settings.autoNext,
        autoApply: this.gameState.settings.autoApply
      },
      state: {
        t1: this.gameState.state.t1,
        t2: this.gameState.state.t2,
        roundLevel: this.gameState.state.roundLevel,
        nextRoundBase: this.gameState.state.nextRoundBase,
        roundOwner: this.gameState.state.roundOwner,
        hist: this.gameState.state.hist
      },
      players: this.gameState.players.map(player => ({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        team: player.team
      })),
      playerStats: this.gameState.playerStats,
      currentRanking: this.gameState.currentRanking,
      timestamp: now()
    };
  }

  /**
   * Create a new room
   * @returns {Promise<string|null>} Room code or null if failed
   */
  async createRoom() {
    try {
      const gameData = this.createGameData();
      
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameData)
      });

      const result = await response.json();
      
      if (result.success) {
        this.currentRoomCode = result.roomCode;
        this.isHost = true;
        this.isViewer = false;
        this.startAutoSync();
        return result.roomCode;
      } else {
        console.error('Failed to create room:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      return null;
    }
  }

  /**
   * Join an existing room
   * @param {string} roomCode - Room code to join
   * @returns {Promise<boolean>} Success status
   */
  async joinRoom(roomCode) {
    try {
      const response = await fetch(`/api/rooms/${roomCode}`);
      const result = await response.json();
      
      if (result.success) {
        // Load room data
        this.loadRoomData(result.data);
        this.currentRoomCode = roomCode;
        this.isHost = false;
        this.isViewer = true;
        this.startPolling();
        this.applyViewerMode();
        return true;
      } else {
        alert('房间不存在或已过期：' + roomCode);
        return false;
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      alert('加入房间失败：' + error.message);
      return false;
    }
  }

  /**
   * Load room data into game state
   * @param {Object} roomData - Room data from server
   */
  loadRoomData(roomData) {
    // Update game state with room data
    Object.assign(this.gameState.settings, roomData.settings);
    Object.assign(this.gameState.state, roomData.state);
    this.gameState.players = roomData.players || [];
    this.gameState.playerStats = roomData.playerStats || {};
    this.gameState.currentRanking = roomData.currentRanking || {};
    
    this.lastUpdate = roomData.lastUpdated;
  }

  /**
   * Update room with current game data
   * @returns {Promise<boolean>} Success status
   */
  async updateRoom() {
    if (!this.currentRoomCode || !this.isHost) {
      return false;
    }

    try {
      const gameData = this.createGameData();
      
      const response = await fetch(`/api/rooms/${this.currentRoomCode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameData)
      });

      const result = await response.json();
      
      if (result.success) {
        this.lastUpdate = result.lastUpdated;
        return true;
      } else {
        console.error('Failed to update room:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Failed to update room:', error);
      return false;
    }
  }

  /**
   * Start auto-sync for hosts (save on every change)
   */
  startAutoSync() {
    if (!this.isHost) return;
    
    // Auto-save every 10 seconds or on significant changes
    this.syncInterval = setInterval(() => {
      this.updateRoom();
    }, 10000);
    
    console.log('Auto-sync started for room:', this.currentRoomCode);
  }

  /**
   * Start polling for viewers (check for updates)
   */
  startPolling() {
    if (!this.isViewer || !this.currentRoomCode) return;
    
    this.pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/rooms/${this.currentRoomCode}`);
        const result = await response.json();
        
        if (result.success && result.data.lastUpdated !== this.lastUpdate) {
          console.log('Room data updated, refreshing...');
          this.loadRoomData(result.data);
          this.refreshUI();
          this.showUpdateNotification();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
    
    console.log('Polling started for room:', this.currentRoomCode);
  }

  /**
   * Apply viewer mode UI (read-only)
   */
  applyViewerMode() {
    // Add viewer banner
    this.addViewerBanner();
    
    // Disable interactive controls
    this.disableControls();
    
    // Update title
    const title = document.querySelector('h1');
    if (title) {
      title.innerHTML = `掼蛋计分器 <span class="badge" style="background:#22c55e;">观看模式 - ${this.currentRoomCode}</span> <span class="badge">开闹</span>`;
    }
  }

  /**
   * Add viewer mode banner
   */
  addViewerBanner() {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(45deg, #22c55e, #16a34a);
      color: white;
      text-align: center;
      padding: 8px;
      font-weight: bold;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    banner.innerHTML = `📺 观看模式 - 房间 ${this.currentRoomCode} | 实时同步中...`;
    
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Adjust page content
    const wrap = document.querySelector('.wrap');
    if (wrap) {
      wrap.style.marginTop = '48px';
    }
  }

  /**
   * Disable controls for viewers
   */
  disableControls() {
    // Hide sections that viewers don't need
    const sectionsToHide = [
      'rankingSection',      // Hide entire ranking section for viewers
      'roomControls',        // Hide room creation controls
      'customRulesSection',  // Hide custom rules configuration
      'resultsSection',      // Hide results section (waiting for ranking)
      'playerSetupSection'   // Hide player setup section (already configured)
    ];
    
    sectionsToHide.forEach(id => {
      const section = document.getElementById(id);
      if (section) {
        section.style.display = 'none';
      }
    });
    
    // Disable remaining interactive buttons
    const buttonsToDisable = [
      'generatePlayers', 'shuffleTeams', 'applyBulkNames', 'quickStart',
      'clearRanking', 'randomRanking', 'manualCalc', 'apply', 'advance',
      'undo', 'resetMatch', 'save4', 'save6', 'save8', 'createRoom'
    ];
    
    buttonsToDisable.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      }
    });
    
    // Disable inputs
    const inputsToDisable = document.querySelectorAll('input, select');
    inputsToDisable.forEach(input => {
      input.disabled = true;
      input.style.opacity = '0.5';
    });
    
    // Disable drag and drop
    const tiles = document.querySelectorAll('.player-tile, .ranking-player-tile');
    tiles.forEach(tile => {
      tile.draggable = false;
      tile.style.cursor = 'default';
    });
  }

  /**
   * Refresh UI with updated data
   */
  refreshUI() {
    // Trigger re-render of all components
    if (window.guandanApp) {
      window.guandanApp.playerSystem.renderPlayers();
      window.guandanApp.playerSystem.renderRankingArea();
      window.guandanApp.uiRenderer.renderTeams();
      window.guandanApp.statsManager.renderStatistics();
      window.guandanApp.statsManager.renderHistory();
    }
  }

  /**
   * Show update notification
   */
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: #22c55e;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1001;
      font-weight: bold;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = '🔄 数据已更新';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * Stop all polling and sync
   */
  cleanup() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get current room status
   * @returns {Object} Room status info
   */
  getRoomStatus() {
    return {
      roomCode: this.currentRoomCode,
      isHost: this.isHost,
      isViewer: this.isViewer,
      lastUpdate: this.lastUpdate
    };
  }

  /**
   * Manual sync trigger for hosts
   * @returns {Promise<boolean>} Success status
   */
  async syncNow() {
    if (!this.isHost) return false;
    
    const success = await this.updateRoom();
    if (success) {
      this.showSyncSuccess();
    }
    return success;
  }

  /**
   * Show sync success feedback
   */
  showSyncSuccess() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: #3b82f6;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1001;
      font-weight: bold;
    `;
    notification.textContent = '✓ 已同步至房间';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 2000);
  }
}

export default RoomManager;