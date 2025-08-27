// Share and read-only view functionality
// UTF-8 encoding for Chinese characters

import { now } from '../utils/dom.js';

class ShareManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.isReadOnlyMode = false;
  }

  /**
   * Create shareable data structure
   * @returns {Object} Shareable game data
   */
  createShareData() {
    const shareData = {
      // Game settings and state
      settings: {
        t1: this.gameState.settings.t1,
        t2: this.gameState.settings.t2,
        strictA: this.gameState.settings.strictA
      },
      state: {
        t1: this.gameState.state.t1,
        t2: this.gameState.state.t2,
        roundLevel: this.gameState.state.roundLevel,
        hist: this.gameState.state.hist
      },
      // Player data
      players: this.gameState.players.map(player => ({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        team: player.team
      })),
      // Statistics
      playerStats: this.gameState.playerStats,
      // Metadata
      timestamp: now(),
      version: 'v9.0'
    };
    
    return shareData;
  }

  /**
   * Generate shareable URL
   * @returns {string} Shareable URL
   */
  generateShareURL() {
    try {
      const shareData = this.createShareData();
      const jsonString = JSON.stringify(shareData);
      
      // Compress using Base64 encoding
      const encoded = btoa(encodeURIComponent(jsonString));
      
      // Create URL with view parameter
      const baseURL = window.location.origin + window.location.pathname;
      const shareURL = `${baseURL}?view=${encoded}`;
      
      return shareURL;
    } catch (error) {
      console.error('Failed to generate share URL:', error);
      return null;
    }
  }

  /**
   * Parse shared data from URL
   * @returns {Object|null} Parsed share data or null if invalid
   */
  parseSharedData() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view');
      
      if (!viewParam) {
        return null;
      }
      
      // Decode from Base64
      const jsonString = decodeURIComponent(atob(viewParam));
      const shareData = JSON.parse(jsonString);
      
      // Validate data structure
      if (!shareData.settings || !shareData.state || !shareData.players) {
        throw new Error('Invalid share data structure');
      }
      
      return shareData;
    } catch (error) {
      console.error('Failed to parse shared data:', error);
      return null;
    }
  }

  /**
   * Load shared data into read-only mode
   * @param {Object} shareData - Shared game data
   */
  loadSharedData(shareData) {
    try {
      // Load shared data into game state (read-only)
      this.gameState.settings.t1 = shareData.settings.t1;
      this.gameState.settings.t2 = shareData.settings.t2;
      this.gameState.settings.strictA = shareData.settings.strictA;
      
      this.gameState.state.t1 = shareData.state.t1;
      this.gameState.state.t2 = shareData.state.t2;
      this.gameState.state.roundLevel = shareData.state.roundLevel;
      this.gameState.state.hist = shareData.state.hist || [];
      
      this.gameState.players = shareData.players || [];
      this.gameState.playerStats = shareData.playerStats || {};
      
      // Mark as read-only mode
      this.isReadOnlyMode = true;
      
      return true;
    } catch (error) {
      console.error('Failed to load shared data:', error);
      return false;
    }
  }

  /**
   * Check if currently in read-only mode
   * @returns {boolean} Read-only status
   */
  isReadOnly() {
    return this.isReadOnlyMode;
  }

  /**
   * Apply read-only UI modifications
   */
  applyReadOnlyMode() {
    if (!this.isReadOnlyMode) return;
    
    // Add read-only banner
    this.addReadOnlyBanner();
    
    // Disable all interactive controls
    this.disableInteractiveControls();
    
    // Update title to indicate read-only mode
    const title = document.querySelector('h1');
    if (title) {
      title.innerHTML = title.innerHTML.replace('v9.0', 'v9.0 <span class="badge" style="background:#f59e0b;">只读模式</span>');
    }
  }

  /**
   * Add read-only banner to page
   */
  addReadOnlyBanner() {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(45deg, #f59e0b, #d97706);
      color: white;
      text-align: center;
      padding: 8px;
      font-weight: bold;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    banner.innerHTML = '📊 只读模式 - 查看他人分享的比赛数据';
    
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Adjust page content to account for banner
    const wrap = document.querySelector('.wrap');
    if (wrap) {
      wrap.style.marginTop = '48px';
    }
  }

  /**
   * Disable interactive controls in read-only mode
   */
  disableInteractiveControls() {
    // Hide sections that don't make sense for viewers
    const sectionsToHide = [
      'rankingSection',      // Hide ranking section completely
      'roomControls',        // Hide room creation controls
      'customRulesSection',  // Hide custom rules configuration
      'resultsSection'       // Hide results section (waiting for ranking)
    ];
    
    sectionsToHide.forEach(id => {
      const section = document.getElementById(id);
      if (section) {
        section.style.display = 'none';
      }
    });
    
    // Disable buttons that modify game state
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
    
    // Disable form inputs
    const inputsToDisable = [
      'mode', 'must1', 'autoNext', 'autoApply', 'strictA', 'bulkNames'
    ];
    
    inputsToDisable.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.disabled = true;
        input.style.opacity = '0.5';
      }
    });
    
    // Disable rule configuration inputs
    const ruleInputs = document.querySelectorAll('input[type="number"]');
    ruleInputs.forEach(input => {
      input.disabled = true;
      input.style.opacity = '0.5';
    });
    
    // Disable drag and drop
    const playerTiles = document.querySelectorAll('.player-tile, .ranking-player-tile');
    playerTiles.forEach(tile => {
      tile.draggable = false;
      tile.style.cursor = 'default';
    });
  }

  /**
   * Copy share URL to clipboard
   * @returns {Promise<boolean>} Success status
   */
  async copyShareURL() {
    const shareURL = this.generateShareURL();
    if (!shareURL) {
      return false;
    }
    
    try {
      await navigator.clipboard.writeText(shareURL);
      return true;
    } catch (error) {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareURL;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (fallbackError) {
        console.error('Failed to copy URL:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Show share modal with room and URL options
   */
  showShareModal() {
    const shareURL = this.generateShareURL();
    if (!shareURL) {
      alert('生成分享链接失败');
      return;
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: #1a1b1c;
      border-radius: 16px;
      padding: 32px;
      max-width: 700px;
      width: 90%;
      text-align: center;
      border: 2px solid #3b82f6;
    `;
    
    content.innerHTML = `
      <h2 style="color: #fff; margin: 0 0 16px 0;">🔗 分享比赛数据</h2>
      <div style="background: #2a2b2c; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: #f59e0b; margin: 0; font-size: 14px;">
          ⚠️ 注意：链接包含当前时刻的数据快照，不会自动同步更新<br>
          比赛进行中需要重新生成链接分享最新状态
        </p>
      </div>
      <textarea readonly id="shareURLText" style="
        width: 100%;
        height: 80px;
        background: #2a2b2c;
        color: #fff;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 12px;
        font-family: monospace;
        font-size: 11px;
        resize: none;
        margin-bottom: 20px;
      ">${shareURL}</textarea>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button id="copyShareURL" style="
          padding: 12px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        ">📋 复制链接</button>
        <button id="refreshShareURL" style="
          padding: 12px 20px;
          background: #22c55e;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        ">🔄 更新链接</button>
        <button id="closeShareModal" style="
          padding: 12px 20px;
          background: #666;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        ">关闭</button>
      </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Setup event listeners
    content.querySelector('#copyShareURL').onclick = async () => {
      const success = await this.copyShareURL();
      const btn = content.querySelector('#copyShareURL');
      if (success) {
        btn.textContent = '已复制 ✓';
        btn.style.background = '#22c55e';
        setTimeout(() => {
          btn.textContent = '📋 复制链接';
          btn.style.background = '#3b82f6';
        }, 2000);
      } else {
        btn.textContent = '复制失败';
        btn.style.background = '#ef4444';
        setTimeout(() => {
          btn.textContent = '📋 复制链接';
          btn.style.background = '#3b82f6';
        }, 2000);
      }
    };
    
    content.querySelector('#refreshShareURL').onclick = () => {
      // Generate new URL with current data
      const newURL = this.generateShareURL();
      if (newURL) {
        const textarea = content.querySelector('#shareURLText');
        textarea.value = newURL;
        
        const btn = content.querySelector('#refreshShareURL');
        btn.textContent = '已更新 ✓';
        btn.style.background = '#22c55e';
        setTimeout(() => {
          btn.textContent = '🔄 更新链接';
          btn.style.background = '#22c55e';
        }, 2000);
      }
    };
    
    content.querySelector('#closeShareModal').onclick = () => {
      document.body.removeChild(modal);
    };
    
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  /**
   * Initialize share functionality
   */
  initialize() {
    // Check if URL contains shared data
    const sharedData = this.parseSharedData();
    if (sharedData) {
      // Load shared data and enter read-only mode
      if (this.loadSharedData(sharedData)) {
        this.applyReadOnlyMode();
        return true; // Indicate that we loaded shared data
      }
    }
    return false; // Normal mode
  }
}

export default ShareManager;