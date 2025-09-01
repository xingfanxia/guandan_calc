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
   * Check URL for room parameter and reload room state
   */
  async checkURLForRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    const authToken = urlParams.get('auth');
    
    if (roomCode) {
      console.log('Detected room in URL, reloading room state:', roomCode);
      
      if (authToken) {
        return await this.joinRoomAsHost(roomCode, authToken);
      } else {
        return await this.joinRoom(roomCode);
      }
    }
    return false;
  }

  /**
   * Generate room code
   * @returns {string} Room code format: 6-digit alphanumeric (e.g., A1B2C3)
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate authentication token for host protection
   * @returns {string} Auth token (32 character random string)
   */
  generateAuthToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
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
   * @returns {Promise<Object|null>} Room info with code and auth token, or null if failed
   */
  async createRoom() {
    try {
      // Generate auth token for host protection
      const authToken = this.generateAuthToken();
      const gameData = {
        ...this.createGameData(),
        hostAuthToken: authToken // Store auth token with room data
      };
      
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
        this.hostAuthToken = authToken;
        this.isHost = true;
        this.isViewer = false;
        this.startAutoSync();
        return { roomCode: result.roomCode, authToken: authToken };
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
   * Join room as host (re-entering own room with auth token)
   * @param {string} roomCode - Room code to join as host
   * @param {string} authToken - Authentication token
   * @returns {Promise<boolean>} Success status
   */
  async joinRoomAsHost(roomCode, authToken) {
    try {
      const response = await fetch(`/api/rooms/${roomCode}`);
      const result = await response.json();
      
      if (result.success) {
        // Validate auth token
        if (result.data.hostAuthToken !== authToken) {
          alert('无效的房主认证token，只能以观看者身份进入');
          // Fallback to viewer mode
          return this.joinRoom(roomCode);
        }
        
        // Valid host - load room data
        this.loadRoomData(result.data);
        this.currentRoomCode = roomCode;
        this.hostAuthToken = authToken;
        this.isHost = true;
        this.isViewer = false;
        this.isFavorite = result.data.isFavorite || false;
        this.startAutoSync();
        this.applyHostMode();
        this.updateFavoriteButton(); // Show favorite button
        return true;
      } else {
        alert('房间不存在或已过期：' + roomCode);
        return false;
      }
    } catch (error) {
      console.error('Failed to join room as host:', error);
      alert('重新进入房间失败：' + error.message);
      return false;
    }
  }

  /**
   * Join an existing room as viewer
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
        this.isFavorite = result.data.isFavorite || false;
        this.startPolling();
        this.applyViewerMode();
        this.updateFavoriteButton(); // Show favorite button for viewers too
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
   * Update room with current game data (includes auth token)
   * @returns {Promise<boolean>} Success status
   */
  async updateRoom() {
    if (!this.currentRoomCode || !this.isHost || !this.hostAuthToken) {
      return false;
    }

    try {
      const gameData = {
        ...this.createGameData(),
        hostAuthToken: this.hostAuthToken // Include auth token in updates
      };
      
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
   * Apply host mode UI (full control with room indicator)
   */
  applyHostMode() {
    // Add host banner
    this.addHostBanner();
    
    // Update title to show host status
    const title = document.querySelector('h1');
    if (title) {
      title.innerHTML = `闹麻家族掼蛋计分器 <span class="badge" style="background:#3b82f6;">房主模式 - ${this.currentRoomCode}</span> <span class="badge">开闹</span>`;
    }
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
      title.innerHTML = `闹麻家族掼蛋计分器 <span class="badge" style="background:#22c55e;">观看模式 - ${this.currentRoomCode}</span> <span class="badge">开闹</span>`;
    }
  }

  /**
   * Add host mode banner (clickable to copy viewer link)
   */
  addHostBanner() {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(45deg, #3b82f6, #1e40af);
      color: white;
      text-align: center;
      padding: 8px;
      font-weight: bold;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: background 0.2s ease;
    `;
    banner.innerHTML = `🎮 房主模式 - 房间 ${this.currentRoomCode} | 自动同步中... | 永久房间 | 点击复制观众链接`;
    
    // Add click handler to copy viewer link
    banner.onclick = async () => {
      const viewerURL = `${window.location.origin}${window.location.pathname}?room=${this.currentRoomCode}`;
      
      try {
        await navigator.clipboard.writeText(viewerURL);
        
        // Show success feedback
        const originalText = banner.innerHTML;
        banner.innerHTML = `✅ 观众链接已复制 - 房间 ${this.currentRoomCode} | 朋友可直接访问观看`;
        banner.style.background = 'linear-gradient(45deg, #22c55e, #16a34a)';
        
        setTimeout(() => {
          banner.innerHTML = originalText;
          banner.style.background = 'linear-gradient(45deg, #3b82f6, #1e40af)';
        }, 3000);
      } catch (error) {
        // Fallback for browsers without clipboard API
        alert(`观众链接：\n${viewerURL}\n\n请手动复制分享给朋友`);
      }
    };
    
    // Add hover effect
    banner.onmouseover = () => {
      banner.style.background = 'linear-gradient(45deg, #2563eb, #1d4ed8)';
    };
    
    banner.onmouseout = () => {
      banner.style.background = 'linear-gradient(45deg, #3b82f6, #1e40af)';
    };
    
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Adjust page content
    const wrap = document.querySelector('.wrap');
    if (wrap) {
      wrap.style.marginTop = '48px';
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
   * Toggle room favorite status
   * @returns {Promise<boolean>} Success status
   */
  async toggleFavorite() {
    if (!this.currentRoomCode) return false;

    try {
      const method = this.isFavorite ? 'DELETE' : 'POST';
      const response = await fetch(`/api/rooms/favorite/${this.currentRoomCode}`, {
        method: method
      });

      const result = await response.json();
      
      if (result.success) {
        this.isFavorite = !this.isFavorite;
        this.updateFavoriteButton();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      return false;
    }
  }

  /**
   * Update favorite button appearance
   */
  updateFavoriteButton() {
    const btn = document.getElementById('favoriteRoom');
    if (btn && this.currentRoomCode) {
      btn.style.display = 'inline-block';
      if (this.isFavorite) {
        btn.innerHTML = '⭐ 已收藏';
        btn.style.background = '#22c55e';
      } else {
        btn.innerHTML = '⭐ 收藏房间';
        btn.style.background = '#f59e0b';
      }
    }
  }

  /**
   * Show browse rooms modal
   */
  async showBrowseRoomsModal() {
    try {
      const response = await fetch('/api/rooms/list');
      const result = await response.json();
      
      if (!result.success) {
        alert('加载房间列表失败');
        return;
      }

      this.createBrowseModal(result.favorites);
    } catch (error) {
      console.error('Failed to load room list:', error);
      alert('加载房间列表失败：' + error.message);
    }
  }

  /**
   * Create browse rooms modal
   * @param {Array} favorites - List of favorite rooms
   */
  createBrowseModal(favorites) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: #1a1b1c; border-radius: 16px; padding: 32px; 
      max-width: 800px; width: 90%; max-height: 80%; overflow-y: auto;
      text-align: center; border: 2px solid #8b5cf6;
    `;
    
    let roomsHTML = `
      <h2 style="color: #fff; margin: 0 0 20px 0;">📋 精选房间回顾</h2>
      <p style="color: #999; margin-bottom: 20px;">浏览收藏的经典比赛</p>
    `;
    
    if (favorites.length === 0) {
      roomsHTML += '<p style="color: #888;">暂无收藏房间</p>';
    } else {
      roomsHTML += '<div style="text-align: left;">';
      favorites.forEach(room => {
        const date = new Date(room.createdAt).toLocaleDateString('zh-CN');
        roomsHTML += `
          <div style="background: #2a2b2c; border-radius: 8px; padding: 16px; margin-bottom: 12px; cursor: pointer;"
               onclick="window.location.href='?room=${room.roomCode}'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="color: #fff; font-weight: bold;">房间 ${room.roomCode}</div>
                <div style="color: #999; font-size: 14px;">${room.teamNames.t1} vs ${room.teamNames.t2}</div>
                <div style="color: #666; font-size: 12px;">${date} | ${room.gameCount}局比赛</div>
              </div>
              <div style="color: #f59e0b; font-size: 20px;">⭐</div>
            </div>
          </div>
        `;
      });
      roomsHTML += '</div>';
    }
    
    roomsHTML += `
      <div style="margin-top: 20px;">
        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                style="padding: 12px 24px; background: #666; color: white; border: none; 
                       border-radius: 8px; cursor: pointer;">关闭</button>
      </div>
    `;
    
    content.innerHTML = roomsHTML;
    modal.appendChild(content);
    document.body.appendChild(modal);
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
      lastUpdate: this.lastUpdate,
      isFavorite: this.isFavorite
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