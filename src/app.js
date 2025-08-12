/**
 * Main Application Orchestrator
 * Coordinates all modules and manages application flow
 */

import { GameState } from './modules/gameState.js';
import { Calculator } from './modules/calculator.js';
import { UIRenderer } from './modules/ui.js';
import { DragDropHandler } from './modules/dragDrop.js';
import { ExportHandler } from './modules/export.js';
import './styles/main.css';

class GuandanApp {
  constructor() {
    this.gameState = new GameState();
    this.calculator = new Calculator();
    this.ui = new UIRenderer();
    this.dragDrop = new DragDropHandler();
    this.exportHandler = new ExportHandler();
    
    this.init();
  }

  /**
   * Initialize application
   */
  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  /**
   * Setup application
   */
  setup() {
    this.initializeDOM();
    this.loadSavedState();
    this.setupEventListeners();
    this.setupDragDropHandlers();
    this.render();
  }

  /**
   * Initialize DOM elements
   */
  initializeDOM() {
    this.ui.setElements({
      playersContainer: document.getElementById('playerPool'),
      rankingContainer: document.getElementById('rankingArea'),
      resultsContainer: document.getElementById('results'),
      teamContainers: {
        t1: document.getElementById('team1Container'),
        t2: document.getElementById('team2Container')
      },
      roundLevelSelect: document.getElementById('roundLevel'),
      modeSelect: document.getElementById('modeSelect'),
      autoApplyCheckbox: document.getElementById('autoApplyCheckbox')
    });
  }

  /**
   * Load saved state from localStorage
   */
  loadSavedState() {
    const savedState = localStorage.getItem('guandanState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        this.gameState.import(state);
      } catch (error) {
        console.error('Failed to load saved state:', error);
        this.initializeDefaultState();
      }
    } else {
      this.initializeDefaultState();
    }
  }

  /**
   * Initialize with default state
   */
  initializeDefaultState() {
    this.gameState.initDefault();
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    const state = this.gameState.export();
    localStorage.setItem('guandanState', JSON.stringify(state));
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Mode change
    const modeSelect = document.getElementById('modeSelect');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.handleModeChange(parseInt(e.target.value));
      });
    }

    // Round level change
    const roundLevel = document.getElementById('roundLevel');
    if (roundLevel) {
      roundLevel.addEventListener('change', (e) => {
        this.gameState.setRoundLevel(parseInt(e.target.value));
        this.saveState();
        this.render();
      });
    }

    // Auto-apply toggle
    const autoApply = document.getElementById('autoApplyCheckbox');
    if (autoApply) {
      autoApply.addEventListener('change', () => {
        this.gameState.toggleAutoApply();
        this.saveState();
      });
    }

    // Add player button
    const addPlayerBtn = document.getElementById('addPlayerBtn');
    if (addPlayerBtn) {
      addPlayerBtn.addEventListener('click', () => this.addPlayer());
    }

    // Calculate button
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
      calculateBtn.addEventListener('click', () => this.calculate());
    }

    // Clear all button
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => this.clearAll());
    }

    // Export buttons
    const exportPNGBtn = document.getElementById('exportPNGBtn');
    if (exportPNGBtn) {
      exportPNGBtn.addEventListener('click', () => this.exportPNG());
    }

    const exportCSVBtn = document.getElementById('exportCSVBtn');
    if (exportCSVBtn) {
      exportCSVBtn.addEventListener('click', () => this.exportCSV());
    }

    const exportJSONBtn = document.getElementById('exportJSONBtn');
    if (exportJSONBtn) {
      exportJSONBtn.addEventListener('click', () => this.exportJSON());
    }

    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn && navigator.share) {
      shareBtn.style.display = 'inline-block';
      shareBtn.addEventListener('click', () => this.share());
    }

    // Apply result button
    const applyBtn = document.getElementById('applyResultBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyResult());
    }

    // Import JSON
    const importBtn = document.getElementById('importJSONBtn');
    const importInput = document.getElementById('importJSONInput');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => this.importJSON(e.target.files[0]));
    }
  }

  /**
   * Setup drag and drop handlers
   */
  setupDragDropHandlers() {
    this.dragDrop.onDrop = (draggedData, dropData) => {
      this.handleDrop(draggedData, dropData);
    };

    this.dragDrop.onDragStart = (data) => {
      // Optional: Add visual feedback
      console.log('Drag started:', data);
    };

    this.dragDrop.onDragEnd = () => {
      // Optional: Clean up visual feedback
      console.log('Drag ended');
    };
  }

  /**
   * Handle drop event
   */
  handleDrop(draggedData, dropData) {
    if (dropData.type === 'rank') {
      this.gameState.setPlayerRank(draggedData, dropData.rank);
      this.checkAutoCalculate();
    } else if (dropData.type === 'team') {
      this.gameState.setPlayerTeam(draggedData, dropData.team);
    } else if (dropData.type === 'pool') {
      this.gameState.removePlayerRank(draggedData);
    }
    
    this.saveState();
    this.render();
  }

  /**
   * Check if should auto-calculate
   */
  checkAutoCalculate() {
    if (this.gameState.isRankingComplete()) {
      this.calculate();
    }
  }

  /**
   * Render the entire UI
   */
  render() {
    this.renderPlayers();
    this.renderRanking();
    this.renderTeams();
    this.updateUI();
  }

  /**
   * Render players pool
   */
  renderPlayers() {
    this.ui.renderPlayersPool(this.gameState.players, this.gameState.currentRanking);
    
    // Initialize drag and drop for player tiles
    const tiles = document.querySelectorAll('#playerPool .player-tile');
    tiles.forEach(tile => {
      const playerId = parseInt(tile.dataset.playerId);
      this.dragDrop.initializeDraggable(tile, playerId);
      
      // Setup name editing
      const input = tile.querySelector('.player-name-input');
      if (input) {
        input.addEventListener('change', (e) => {
          this.gameState.updatePlayerName(playerId, e.target.value);
          this.saveState();
        });
      }
      
      // Setup delete button
      const deleteBtn = tile.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          this.removePlayer(playerId);
        });
      }
    });
  }

  /**
   * Render ranking area
   */
  renderRanking() {
    this.ui.renderRankingSlots(this.gameState.mode);
    this.ui.updateRanking(this.gameState.currentRanking, this.gameState.players);
    
    // Initialize drop zones
    const rankBoxes = document.querySelectorAll('.rank-box');
    rankBoxes.forEach(box => {
      this.dragDrop.initializeDropZone(box);
    });
    
    // Setup remove buttons for ranked tiles
    const rankedTiles = document.querySelectorAll('.rank-box .player-tile');
    rankedTiles.forEach(tile => {
      const removeBtn = tile.querySelector('.remove-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          const playerId = parseInt(tile.dataset.playerId);
          this.gameState.removePlayerRank(playerId);
          this.saveState();
          this.render();
        });
      }
    });
  }

  /**
   * Render teams
   */
  renderTeams() {
    this.ui.renderTeams(
      this.gameState.players,
      this.gameState.roundLevel,
      this.calculator.roundLevels
    );
  }

  /**
   * Update UI elements
   */
  updateUI() {
    this.ui.updateModeDisplay(this.gameState.mode);
    this.ui.updateRoundLevelDisplay(this.gameState.roundLevel);
    this.ui.updateAutoApplyDisplay(this.gameState.autoApply);
  }

  /**
   * Handle mode change
   */
  handleModeChange(newMode) {
    this.gameState.setMode(newMode);
    
    // Adjust player count if needed
    while (this.gameState.players.length < newMode) {
      this.gameState.addPlayer(`玩家${this.gameState.players.length + 1}`);
    }
    
    while (this.gameState.players.length > newMode) {
      this.gameState.removePlayer(this.gameState.players[this.gameState.players.length - 1].id);
    }
    
    this.gameState.assignTeams();
    this.saveState();
    this.render();
  }

  /**
   * Add a player
   */
  addPlayer() {
    if (this.gameState.players.length >= 12) {
      this.ui.showMessage('最多支持12个玩家', 'warning');
      return;
    }
    
    const player = this.gameState.addPlayer(`玩家${this.gameState.players.length + 1}`);
    this.gameState.assignTeams();
    this.saveState();
    this.render();
  }

  /**
   * Remove a player
   */
  removePlayer(playerId) {
    if (this.gameState.players.length <= 4) {
      this.ui.showMessage('至少需要4个玩家', 'warning');
      return;
    }
    
    this.gameState.removePlayer(playerId);
    this.gameState.assignTeams();
    this.saveState();
    this.render();
  }

  /**
   * Calculate results
   */
  calculate() {
    if (!this.gameState.isRankingComplete()) {
      this.ui.showMessage('请完成所有玩家的排名', 'warning');
      return;
    }
    
    // Get full ranking
    const fullRanking = [];
    for (let i = 1; i <= this.gameState.mode; i++) {
      const playerId = this.gameState.currentRanking[i];
      const player = this.gameState.getPlayer(playerId);
      if (player) {
        fullRanking.push(player.name);
      }
    }
    
    // Calculate team-based result
    const result = this.calculator.calculateTeamBased(
      fullRanking,
      this.gameState.players,
      this.gameState.roundLevel
    );
    
    if (result.success) {
      this.lastResult = result;
      const html = this.ui.renderResults(result);
      this.ui.showResults(html);
      
      // Update player stats
      for (let i = 1; i <= this.gameState.mode; i++) {
        const playerId = this.gameState.currentRanking[i];
        this.gameState.updatePlayerStats(playerId, i);
      }
      
      // Auto-apply if enabled
      if (this.gameState.autoApply) {
        this.applyResult();
      }
      
      this.saveState();
    } else {
      this.ui.showMessage(result.error, 'error');
    }
  }

  /**
   * Apply calculation result
   */
  applyResult() {
    if (!this.lastResult || !this.lastResult.success) {
      this.ui.showMessage('请先计算结果', 'warning');
      return;
    }
    
    // Update round level
    this.gameState.setRoundLevel(this.lastResult.upgrade.newLevel);
    
    // Clear ranking
    this.gameState.currentRanking = {};
    
    // Save and re-render
    this.saveState();
    this.render();
    this.ui.clearResults();
    
    this.ui.showMessage('结果已应用，级别已更新', 'success');
  }

  /**
   * Clear all data
   */
  clearAll() {
    if (confirm('确定要清除所有数据吗？')) {
      this.gameState.reset();
      this.initializeDefaultState();
      this.saveState();
      this.render();
      this.ui.clearResults();
      this.ui.showMessage('数据已清除', 'info');
    }
  }

  /**
   * Export as PNG
   */
  async exportPNG() {
    const resultsEl = document.getElementById('results');
    if (!resultsEl || !this.lastResult) {
      this.ui.showMessage('请先计算结果', 'warning');
      return;
    }
    
    const result = await this.exportHandler.exportAsPNG(resultsEl);
    if (result.success) {
      this.ui.showMessage('图片已导出', 'success');
    } else {
      this.ui.showMessage('导出失败: ' + result.error, 'error');
    }
  }

  /**
   * Export as CSV
   */
  exportCSV() {
    if (!this.lastResult) {
      this.ui.showMessage('请先计算结果', 'warning');
      return;
    }
    
    const result = this.exportHandler.exportAsCSV(this.lastResult);
    if (result.success) {
      this.ui.showMessage('CSV已导出', 'success');
    } else {
      this.ui.showMessage('导出失败: ' + result.error, 'error');
    }
  }

  /**
   * Export as JSON
   */
  exportJSON() {
    const result = this.exportHandler.exportAsJSON(
      this.gameState.export(),
      this.lastResult
    );
    
    if (result.success) {
      this.ui.showMessage('游戏数据已导出', 'success');
    } else {
      this.ui.showMessage('导出失败: ' + result.error, 'error');
    }
  }

  /**
   * Import from JSON
   */
  async importJSON(file) {
    if (!file) return;
    
    try {
      const result = await this.exportHandler.importFromJSON(file);
      if (result.success) {
        this.gameState.import(result.data.gameState);
        this.saveState();
        this.render();
        this.ui.showMessage('游戏数据已导入', 'success');
      }
    } catch (error) {
      this.ui.showMessage('导入失败: ' + error.error, 'error');
    }
  }

  /**
   * Share results
   */
  async share() {
    if (!this.lastResult) {
      this.ui.showMessage('请先计算结果', 'warning');
      return;
    }
    
    const result = await this.exportHandler.shareResults(this.lastResult);
    if (!result.success && result.error !== 'User cancelled') {
      this.ui.showMessage('分享失败: ' + result.error, 'error');
    }
  }
}

// Initialize app
const app = new GuandanApp();

// Export for debugging
window.guandanApp = app;

export default GuandanApp;