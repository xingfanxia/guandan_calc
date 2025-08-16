/**
 * Main Application Orchestrator
 * Coordinates all modules and manages application lifecycle
 */

import { GameState } from './core/gameState.js';
import { Calculator } from './core/calculator.js';
import { Statistics } from './core/statistics.js';
import { History } from './core/history.js';
import { UIComponents } from './ui/components.js';
import { DragDropHandler } from './ui/dragDrop.js';
import storage from './utils/storage.js';
import { ExportManager } from './utils/export.js';
import { CONFIG, LEVEL_RULES } from './core/config.js';

class GuandanApp {
  constructor() {
    // Core modules
    this.gameState = new GameState();
    this.calculator = new Calculator(this.gameState);
    this.statistics = new Statistics(this.gameState);
    this.history = new History(this.gameState);
    this.exportManager = new ExportManager(this.gameState);
    
    // Attach modules to gameState for cross-reference
    this.gameState.calculator = this.calculator;
    this.gameState.statistics = this.statistics;
    this.gameState.history = this.history;
    
    // UI handlers
    this.dragDropHandler = new DragDropHandler();
    
    // DOM references
    this.elements = {};
    
    // State
    this.isInitialized = false;
    this.autoSaveInterval = null;
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      // Load saved state
      this.loadState();
      
      // Cache DOM elements
      this.cacheElements();
      
      // Initialize UI
      this.initializeUI();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Setup drag and drop
      this.setupDragDrop();
      
      // Start auto-save
      this.startAutoSave();
      
      // Update displays
      this.updateAllDisplays();
      
      this.isInitialized = true;
      console.log('Guandan App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      UIComponents.showNotification('初始化失败: ' + error.message, 'error');
    }
  }

  /**
   * Cache DOM element references
   */
  cacheElements() {
    // Mode selector
    this.elements.modeSelector = document.getElementById('modeSelector');
    
    // Team areas
    this.elements.t1Area = document.getElementById('t1Area');
    this.elements.t2Area = document.getElementById('t2Area');
    this.elements.unassignedArea = document.getElementById('unassignedArea');
    
    // Ranking area
    this.elements.rankingPool = document.getElementById('rankingPool');
    this.elements.rankingSlots = document.getElementById('rankingSlots');
    this.elements.calcButton = document.getElementById('calcButton');
    this.elements.resultDisplay = document.getElementById('resultDisplay');
    
    // Controls
    this.elements.applyButton = document.getElementById('applyButton');
    this.elements.resetRankButton = document.getElementById('resetRankButton');
    this.elements.newRoundButton = document.getElementById('newRoundButton');
    this.elements.undoButton = document.getElementById('undoButton');
    
    // Settings checkboxes
    this.elements.must1 = document.getElementById('must1');
    this.elements.autoNext = document.getElementById('autoNext');
    this.elements.autoApply = document.getElementById('autoApply');
    this.elements.strictA = document.getElementById('strictA');
    
    // Team inputs
    this.elements.t1Name = document.getElementById('t1Name');
    this.elements.t2Name = document.getElementById('t2Name');
    this.elements.t1Color = document.getElementById('t1Color');
    this.elements.t2Color = document.getElementById('t2Color');
    
    // History and stats
    this.elements.histTable = document.getElementById('histTable');
    this.elements.statsTable = document.getElementById('statsTable');
    
    // Export buttons
    this.elements.exportTxt = document.getElementById('exportTxt');
    this.elements.exportCsv = document.getElementById('exportCsv');
    this.elements.exportPng = document.getElementById('exportPng');
    this.elements.exportLongPng = document.getElementById('exportLongPng');
    this.elements.exportJson = document.getElementById('exportJson');
    this.elements.importJson = document.getElementById('importJson');
    this.elements.importFile = document.getElementById('importFile');
  }

  /**
   * Initialize UI components
   */
  initializeUI() {
    // Set initial mode
    if (this.elements.modeSelector) {
      this.elements.modeSelector.value = this.gameState.mode;
    }
    
    // Create initial player tiles
    this.createPlayerTiles();
    
    // Create ranking slots
    this.createRankingSlots();
    
    // Update team settings
    this.updateTeamSettings();
    
    // Update checkboxes
    this.updateSettingsUI();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Mode change
    this.elements.modeSelector?.addEventListener('change', (e) => {
      this.handleModeChange(parseInt(e.target.value));
    });
    
    // Calculate button
    this.elements.calcButton?.addEventListener('click', () => {
      this.handleCalculate();
    });
    
    // Apply result
    this.elements.applyButton?.addEventListener('click', () => {
      this.handleApplyResult();
    });
    
    // Reset ranking
    this.elements.resetRankButton?.addEventListener('click', () => {
      this.resetRanking();
    });
    
    // New round
    this.elements.newRoundButton?.addEventListener('click', () => {
      this.startNewRound();
    });
    
    // Undo
    this.elements.undoButton?.addEventListener('click', () => {
      this.handleUndo();
    });
    
    // Settings checkboxes
    this.elements.must1?.addEventListener('change', (e) => {
      this.gameState.settings.must1 = e.target.checked;
      this.saveState();
    });
    
    this.elements.autoNext?.addEventListener('change', (e) => {
      this.gameState.settings.autoNext = e.target.checked;
      this.saveState();
    });
    
    this.elements.autoApply?.addEventListener('change', (e) => {
      this.gameState.settings.autoApply = e.target.checked;
      this.saveState();
    });
    
    this.elements.strictA?.addEventListener('change', (e) => {
      this.gameState.settings.strictA = e.target.checked;
      this.saveState();
    });
    
    // Team settings
    this.elements.t1Name?.addEventListener('input', (e) => {
      this.gameState.teams.t1.name = e.target.value || '蓝队';
      UIComponents.updateTeamDisplay('t1', this.gameState);
      this.saveState();
    });
    
    this.elements.t2Name?.addEventListener('input', (e) => {
      this.gameState.teams.t2.name = e.target.value || '红队';
      UIComponents.updateTeamDisplay('t2', this.gameState);
      this.saveState();
    });
    
    this.elements.t1Color?.addEventListener('input', (e) => {
      this.gameState.teams.t1.color = e.target.value;
      this.updateTeamColors();
      this.saveState();
    });
    
    this.elements.t2Color?.addEventListener('input', (e) => {
      this.gameState.teams.t2.color = e.target.value;
      this.updateTeamColors();
      this.saveState();
    });
    
    // Export/Import
    this.elements.exportTxt?.addEventListener('click', () => {
      this.exportManager.exportAndDownload('txt');
    });
    
    this.elements.exportCsv?.addEventListener('click', () => {
      this.exportManager.exportAndDownload('csv');
    });
    
    this.elements.exportPng?.addEventListener('click', () => {
      this.exportManager.exportAndDownload('png');
    });
    
    this.elements.exportLongPng?.addEventListener('click', () => {
      this.exportManager.exportAndDownload('longpng');
    });
    
    this.elements.exportJson?.addEventListener('click', () => {
      this.exportManager.exportAndDownload('json');
    });
    
    this.elements.importJson?.addEventListener('click', () => {
      this.elements.importFile?.click();
    });
    
    this.elements.importFile?.addEventListener('change', (e) => {
      this.handleImport(e.target.files[0]);
    });
    
    // Player name inputs (delegated)
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('player-name-input')) {
        const playerId = e.target.dataset.playerId;
        const player = this.gameState.getPlayer(playerId);
        if (player) {
          player.name = e.target.value || `玩家${playerId}`;
          this.updateRankingPool();
          this.saveState();
        }
      }
    });
    
    // Delete player buttons (delegated)
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) {
        const playerId = e.target.dataset.playerId;
        this.deletePlayer(playerId);
      }
      
      if (e.target.classList.contains('delete-history-btn')) {
        const entryId = parseInt(e.target.dataset.entryId);
        this.deleteHistoryEntry(entryId);
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.handleUndo();
      }
      
      // Ctrl/Cmd + S for save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveState();
        UIComponents.showNotification('已保存', 'success');
      }
    });
  }

  /**
   * Setup drag and drop
   */
  setupDragDrop() {
    // Configure callbacks
    this.dragDropHandler.onDragStart = (playerData) => {
      console.log('Drag started:', playerData);
    };
    
    this.dragDropHandler.onDragEnd = () => {
      console.log('Drag ended');
    };
    
    this.dragDropHandler.onDrop = (playerData, dropData) => {
      this.handleDrop(playerData, dropData);
    };
    
    // Initialize draggables and drop zones
    this.initializeDragDrop();
  }

  /**
   * Initialize drag and drop elements
   */
  initializeDragDrop() {
    // Make player tiles draggable
    document.querySelectorAll('.player-tile').forEach(tile => {
      const playerId = tile.dataset.playerId;
      const player = this.gameState.getPlayer(playerId);
      if (player) {
        this.dragDropHandler.initDraggable(tile, player);
      }
    });
    
    // Make ranking tiles draggable
    document.querySelectorAll('.ranking-player-tile').forEach(tile => {
      const playerId = tile.dataset.playerId;
      const player = this.gameState.getPlayer(playerId);
      if (player) {
        this.dragDropHandler.initDraggable(tile, player);
      }
    });
    
    // Setup team drop zones
    const teamZones = document.querySelectorAll('.team-drop-zone');
    teamZones.forEach(zone => {
      const team = parseInt(zone.dataset.team);
      this.dragDropHandler.initDropZone(zone, { type: 'team', team });
    });
    
    // Setup ranking slots
    const rankSlots = document.querySelectorAll('.rank-slot');
    rankSlots.forEach(slot => {
      const rank = parseInt(slot.dataset.rank);
      this.dragDropHandler.initDropZone(slot, { type: 'rank', rank });
    });
  }

  /**
   * Handle drop event
   */
  handleDrop(playerData, dropData) {
    if (dropData.type === 'team') {
      // Assign player to team
      this.assignPlayerToTeam(playerData.id, dropData.team);
    } else if (dropData.type === 'rank') {
      // Assign player to rank
      this.assignPlayerToRank(playerData.id, dropData.rank);
    }
  }

  /**
   * Handle mode change
   */
  handleModeChange(newMode) {
    if (this.gameState.gameHistory.length > 0) {
      if (!confirm('切换模式将重置所有数据，确定继续？')) {
        this.elements.modeSelector.value = this.gameState.mode;
        return;
      }
    }
    
    this.gameState.setMode(newMode);
    this.createPlayerTiles();
    this.createRankingSlots();
    this.resetRanking();
    this.saveState();
    UIComponents.showNotification(`已切换到 ${newMode}人模式`, 'success');
  }

  /**
   * Create player tiles
   */
  createPlayerTiles() {
    // Clear existing tiles
    if (this.elements.unassignedArea) {
      this.elements.unassignedArea.innerHTML = '';
    }
    
    // Initialize players if needed
    if (this.gameState.players.length === 0) {
      this.gameState.initializePlayers();
    }
    
    // Create tiles for unassigned players
    this.gameState.players.forEach(player => {
      if (!player.team) {
        const tile = UIComponents.createPlayerTile(player);
        this.elements.unassignedArea?.appendChild(tile);
      }
    });
    
    // Update team areas
    this.updateTeamAreas();
  }

  /**
   * Create ranking slots
   */
  createRankingSlots() {
    if (!this.elements.rankingSlots) return;
    
    this.elements.rankingSlots.innerHTML = '';
    
    for (let i = 1; i <= this.gameState.mode; i++) {
      const slot = UIComponents.createRankingSlot(i);
      this.elements.rankingSlots.appendChild(slot);
    }
  }

  /**
   * Assign player to team
   */
  assignPlayerToTeam(playerId, teamNumber) {
    const result = this.gameState.assignPlayerToTeam(playerId, teamNumber);
    
    if (result.success) {
      this.updateTeamAreas();
      this.updateRankingPool();
      this.saveState();
    } else {
      UIComponents.showNotification(result.error, 'error');
    }
  }

  /**
   * Assign player to rank
   */
  assignPlayerToRank(playerId, rank) {
    this.gameState.currentRanking[rank] = playerId;
    this.updateRankingDisplay();
    this.checkRankingComplete();
  }

  /**
   * Handle calculate
   */
  handleCalculate() {
    const result = this.calculator.calculate();
    this.lastCalculationResult = result;
    
    if (result.success) {
      // Display result
      const resultElement = UIComponents.createResultDisplay(result, this.gameState);
      if (this.elements.resultDisplay) {
        this.elements.resultDisplay.innerHTML = '';
        this.elements.resultDisplay.appendChild(resultElement);
      }
      
      // Enable apply button
      if (this.elements.applyButton) {
        this.elements.applyButton.disabled = false;
      }
      
      // Auto apply if enabled
      if (this.gameState.settings.autoApply) {
        setTimeout(() => this.handleApplyResult(), 500);
      }
    } else {
      UIComponents.showNotification(result.error, 'error');
    }
  }

  /**
   * Handle apply result
   */
  handleApplyResult() {
    if (!this.lastCalculationResult || !this.lastCalculationResult.success) {
      UIComponents.showNotification('请先计算结果', 'error');
      return;
    }
    
    const applyResult = this.calculator.applyResult(this.lastCalculationResult);
    
    if (applyResult.success) {
      // Add to history
      this.history.addEntry(this.lastCalculationResult, applyResult);
      
      // Update statistics
      this.statistics.updateStats(this.lastCalculationResult);
      
      // Update displays
      this.updateAllDisplays();
      
      // Check for victory
      if (applyResult.victory) {
        this.showVictoryModal(applyResult.winnerTeamId);
      } else if (this.gameState.settings.autoNext) {
        // Auto start new round
        setTimeout(() => this.startNewRound(), 500);
      }
      
      // Save state
      this.saveState();
      
      // Clear last result
      this.lastCalculationResult = null;
      if (this.elements.applyButton) {
        this.elements.applyButton.disabled = true;
      }
      
      UIComponents.showNotification('已应用结果', 'success');
    } else {
      UIComponents.showNotification(applyResult.error, 'error');
    }
  }

  /**
   * Start new round
   */
  startNewRound() {
    this.resetRanking();
    this.updateRankingPool();
    UIComponents.showNotification('新回合开始', 'info');
  }

  /**
   * Reset ranking
   */
  resetRanking() {
    this.gameState.currentRanking = {};
    this.updateRankingDisplay();
    
    if (this.elements.resultDisplay) {
      this.elements.resultDisplay.innerHTML = '';
    }
    
    if (this.elements.applyButton) {
      this.elements.applyButton.disabled = true;
    }
  }

  /**
   * Handle undo
   */
  handleUndo() {
    const result = this.history.undo();
    
    if (result.success) {
      this.updateAllDisplays();
      this.saveState();
      UIComponents.showNotification('已撤销', 'success');
    } else {
      UIComponents.showNotification(result.error, 'error');
    }
  }

  /**
   * Delete player
   */
  deletePlayer(playerId) {
    if (!confirm('确定删除该玩家？')) return;
    
    const result = this.gameState.removePlayer(playerId);
    
    if (result.success) {
      this.updateTeamAreas();
      this.updateRankingPool();
      this.saveState();
      UIComponents.showNotification('已删除玩家', 'success');
    } else {
      UIComponents.showNotification(result.error, 'error');
    }
  }

  /**
   * Delete history entry
   */
  deleteHistoryEntry(entryId) {
    if (!confirm('确定删除该记录？')) return;
    
    const result = this.history.deleteEntry(entryId);
    
    if (result.success) {
      this.updateHistoryDisplay();
      this.updateStatsDisplay();
      this.saveState();
      UIComponents.showNotification('已删除记录', 'success');
    } else {
      UIComponents.showNotification(result.error, 'error');
    }
  }

  /**
   * Update all displays
   */
  updateAllDisplays() {
    this.updateTeamAreas();
    this.updateRankingPool();
    this.updateRankingDisplay();
    this.updateTeamDisplays();
    this.updateHistoryDisplay();
    this.updateStatsDisplay();
    UIComponents.updateRoundLevelDisplay(this.gameState);
  }

  /**
   * Update team areas
   */
  updateTeamAreas() {
    // Clear team areas
    ['t1Area', 't2Area'].forEach(areaId => {
      const area = this.elements[areaId];
      if (area) {
        // Keep the drop zone, remove tiles
        const tiles = area.querySelectorAll('.player-tile');
        tiles.forEach(tile => tile.remove());
      }
    });
    
    // Add players to their teams
    this.gameState.players.forEach(player => {
      if (player.team) {
        const areaId = player.team === 1 ? 't1Area' : 't2Area';
        const area = this.elements[areaId];
        if (area) {
          const tile = UIComponents.createPlayerTile(player);
          area.appendChild(tile);
        }
      }
    });
    
    // Reinitialize drag drop for new tiles
    this.initializeDragDrop();
  }

  /**
   * Update ranking pool
   */
  updateRankingPool() {
    if (!this.elements.rankingPool) return;
    
    this.elements.rankingPool.innerHTML = '';
    
    // Get players with teams
    const players = this.gameState.players.filter(p => p.team);
    
    players.forEach(player => {
      const tile = UIComponents.createRankingPlayerTile(player);
      this.elements.rankingPool.appendChild(tile);
    });
    
    // Reinitialize drag drop
    this.initializeDragDrop();
  }

  /**
   * Update ranking display
   */
  updateRankingDisplay() {
    const slots = document.querySelectorAll('.rank-slot');
    
    slots.forEach(slot => {
      const rank = parseInt(slot.dataset.rank);
      const playerId = this.gameState.currentRanking[rank];
      
      // Remove existing player tile
      const existingTile = slot.querySelector('.ranking-player-tile');
      if (existingTile) {
        existingTile.remove();
      }
      
      // Add new player tile if assigned
      if (playerId) {
        const player = this.gameState.getPlayer(playerId);
        if (player) {
          const tile = UIComponents.createRankingPlayerTile(player);
          slot.appendChild(tile);
        }
      }
    });
  }

  /**
   * Check if ranking is complete
   */
  checkRankingComplete() {
    const rankedCount = Object.keys(this.gameState.currentRanking).length;
    
    if (rankedCount === this.gameState.mode) {
      if (this.elements.calcButton) {
        this.elements.calcButton.disabled = false;
      }
      UIComponents.showNotification('排名完成，可以计算了', 'success');
    } else {
      if (this.elements.calcButton) {
        this.elements.calcButton.disabled = true;
      }
    }
  }

  /**
   * Update team displays
   */
  updateTeamDisplays() {
    UIComponents.updateTeamDisplay('t1', this.gameState);
    UIComponents.updateTeamDisplay('t2', this.gameState);
  }

  /**
   * Update team settings UI
   */
  updateTeamSettings() {
    if (this.elements.t1Name) {
      this.elements.t1Name.value = this.gameState.teams.t1.name;
    }
    if (this.elements.t2Name) {
      this.elements.t2Name.value = this.gameState.teams.t2.name;
    }
    if (this.elements.t1Color) {
      this.elements.t1Color.value = this.gameState.teams.t1.color;
    }
    if (this.elements.t2Color) {
      this.elements.t2Color.value = this.gameState.teams.t2.color;
    }
  }

  /**
   * Update team colors
   */
  updateTeamColors() {
    // Update team drop zones
    document.querySelectorAll('.team-drop-zone').forEach(zone => {
      const team = parseInt(zone.dataset.team);
      const color = team === 1 ? this.gameState.teams.t1.color : this.gameState.teams.t2.color;
      zone.style.borderColor = color;
    });
    
    // Update player tiles
    this.updateTeamAreas();
    this.updateRankingPool();
  }

  /**
   * Update settings UI
   */
  updateSettingsUI() {
    if (this.elements.must1) {
      this.elements.must1.checked = this.gameState.settings.must1;
    }
    if (this.elements.autoNext) {
      this.elements.autoNext.checked = this.gameState.settings.autoNext;
    }
    if (this.elements.autoApply) {
      this.elements.autoApply.checked = this.gameState.settings.autoApply;
    }
    if (this.elements.strictA) {
      this.elements.strictA.checked = this.gameState.settings.strictA;
    }
  }

  /**
   * Update history display
   */
  updateHistoryDisplay() {
    if (!this.elements.histTable) return;
    
    const tbody = this.elements.histTable.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const historyData = this.history.getHistoryForDisplay();
    historyData.forEach((entry, index) => {
      const row = UIComponents.createHistoryRow(entry, index);
      tbody.appendChild(row);
    });
  }

  /**
   * Update stats display
   */
  updateStatsDisplay() {
    if (!this.elements.statsTable) return;
    
    const tbody = this.elements.statsTable.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const stats = this.statistics.getAllPlayerStats();
    stats.forEach(({ player, stats }) => {
      if (stats.games > 0) {
        const row = UIComponents.createPlayerStatsRow({
          ...player,
          games: stats.games,
          avgRank: stats.avgRank.toFixed(2),
          firstPlace: stats.firstPlaceCount,
          lastPlace: stats.lastPlaceCount
        });
        tbody.appendChild(row);
      }
    });
  }

  /**
   * Show victory modal
   */
  showVictoryModal(winnerTeamId) {
    const team = this.gameState.teams[winnerTeamId];
    const modal = UIComponents.createVictoryModal(team.name, team.color);
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('victoryExportTxt')?.addEventListener('click', () => {
      this.exportManager.exportAndDownload('txt');
    });
    
    document.getElementById('victoryExportCsv')?.addEventListener('click', () => {
      this.exportManager.exportAndDownload('csv');
    });
    
    document.getElementById('victoryExportPng')?.addEventListener('click', () => {
      this.exportManager.exportAndDownload('longpng');
    });
    
    document.getElementById('victoryReset')?.addEventListener('click', () => {
      this.resetGame();
      modal.remove();
    });
    
    document.getElementById('victoryClose')?.addEventListener('click', () => {
      modal.remove();
    });
  }

  /**
   * Reset game
   */
  resetGame() {
    if (!confirm('确定要重置整场比赛？所有数据将被清除。')) return;
    
    this.gameState.reset();
    this.history.clearHistory();
    this.statistics.resetStats();
    this.createPlayerTiles();
    this.resetRanking();
    this.updateAllDisplays();
    this.saveState();
    UIComponents.showNotification('游戏已重置', 'success');
  }

  /**
   * Handle import
   */
  async handleImport(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const result = this.exportManager.importJSON(text);
      
      if (result.success) {
        this.updateAllDisplays();
        this.saveState();
        UIComponents.showNotification(`成功导入 ${result.imported.rounds} 回合数据`, 'success');
      } else {
        UIComponents.showNotification('导入失败: ' + result.error, 'error');
      }
    } catch (error) {
      UIComponents.showNotification('读取文件失败', 'error');
    }
    
    // Reset file input
    if (this.elements.importFile) {
      this.elements.importFile.value = '';
    }
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    storage.saveGameState(this.gameState);
    storage.saveSettings(this.gameState.settings);
    storage.savePlayerStats(this.gameState.playerStats);
    storage.saveHistory(this.gameState.gameHistory);
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    // Load settings
    const settings = storage.loadSettings();
    if (settings) {
      this.gameState.settings = settings;
    }
    
    // Load game state
    const state = storage.loadGameState();
    if (state) {
      this.gameState.importState(state);
    }
    
    // Load player stats
    const stats = storage.loadPlayerStats();
    if (stats) {
      this.gameState.playerStats = stats;
    }
    
    // Load history
    const history = storage.loadHistory();
    if (history) {
      this.gameState.gameHistory = history;
    }
  }

  /**
   * Start auto-save
   */
  startAutoSave() {
    // Save every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveState();
    }, 30000);
  }

  /**
   * Stop auto-save
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    this.stopAutoSave();
    this.dragDropHandler.destroy();
    this.saveState();
  }
}

// Initialize app when DOM is ready
let app = null;

function initApp() {
  app = new GuandanApp();
  app.init();
  
  // Make app globally accessible for debugging
  window.guandanApp = app;
}

// Check if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (app) {
    app.saveState();
  }
});

export default GuandanApp;