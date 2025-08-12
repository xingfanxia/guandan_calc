// Main application orchestrator
import { GameState } from './modules/gameState.js';
import { Calculator } from './modules/calculator.js';
import { UIRenderer } from './modules/ui.js';
import { DragDropHandler } from './modules/dragDrop.js';
import { ExportHandler } from './modules/export.js';

class GuandanApp {
  constructor() {
    this.gameState = new GameState();
    this.calculator = new Calculator();
    this.ui = new UIRenderer();
    this.dragDrop = new DragDropHandler();
    this.exportHandler = new ExportHandler();
    
    this.init();
  }

  init() {
    // Set up event listeners and initialize the app
    this.setupEventListeners();
    this.loadGameState();
    this.render();
  }

  setupEventListeners() {
    // Add Player button
    const addPlayerBtn = document.getElementById('addPlayerBtn');
    if (addPlayerBtn) {
      addPlayerBtn.addEventListener('click', () => this.addPlayer());
    }

    // Calculate button
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
      calculateBtn.addEventListener('click', () => this.calculate());
    }

    // Clear All button
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

    // Round level change
    const roundLevelSelect = document.getElementById('roundLevel');
    if (roundLevelSelect) {
      roundLevelSelect.addEventListener('change', (e) => {
        this.gameState.setRoundLevel(parseInt(e.target.value));
        this.saveGameState();
      });
    }

    // Set up drag and drop callbacks
    this.dragDrop.onDrop = (playerId, rank) => {
      this.gameState.setPlayerRank(playerId, rank);
      this.updateRankingInput();
      this.saveGameState();
    };

    this.dragDrop.onDragStart = () => {
      // Optional: Add visual feedback
    };

    this.dragDrop.onDragEnd = () => {
      // Optional: Clean up visual feedback
    };
  }

  loadGameState() {
    // Load from localStorage
    const savedState = localStorage.getItem('guandanGameState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.players) {
          state.players.forEach(player => {
            this.gameState.addPlayer(player.name, player.id);
          });
        }
        if (state.roundLevel) {
          this.gameState.setRoundLevel(state.roundLevel);
        }
        if (state.currentRanking) {
          Object.entries(state.currentRanking).forEach(([rank, playerId]) => {
            if (playerId) {
              this.gameState.setPlayerRank(playerId, parseInt(rank));
            }
          });
        }
      } catch (e) {
        console.error('Error loading saved state:', e);
      }
    } else {
      // Initialize with default 8 players
      for (let i = 1; i <= 8; i++) {
        this.gameState.addPlayer(`玩家${i}`);
      }
    }
  }

  saveGameState() {
    const state = {
      players: this.gameState.players.map(p => ({ id: p.id, name: p.name })),
      roundLevel: this.gameState.roundLevel,
      currentRanking: this.gameState.currentRanking
    };
    localStorage.setItem('guandanGameState', JSON.stringify(state));
  }

  render() {
    // Update round level select
    const roundLevelSelect = document.getElementById('roundLevel');
    if (roundLevelSelect) {
      roundLevelSelect.value = this.gameState.roundLevel;
    }

    // Render players
    const playersContainer = document.getElementById('playersContainer');
    if (playersContainer) {
      playersContainer.innerHTML = '';
      this.gameState.players.forEach(player => {
        const tile = this.ui.createPlayerTile(player);
        
        // Add event listeners for player name editing
        const input = tile.querySelector('input');
        if (input) {
          input.addEventListener('input', (e) => {
            this.gameState.updatePlayerName(player.id, e.target.value);
            this.saveGameState();
          });
        }

        // Add delete button listener
        const deleteBtn = tile.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => {
            this.removePlayer(player.id);
          });
        }

        // Initialize drag and drop for this tile
        this.dragDrop.initializeDraggable(tile, player.id);
        
        playersContainer.appendChild(tile);
      });
    }

    // Initialize rank boxes
    const rankBoxes = document.querySelectorAll('.rank-box');
    rankBoxes.forEach(box => {
      this.dragDrop.initializeDropZone(box);
    });

    // Render current ranking
    this.renderRanking();
    
    // Update ranking input display
    this.updateRankingInput();
  }

  renderRanking() {
    // Clear all rank boxes first
    document.querySelectorAll('.rank-box').forEach(box => {
      const existingTiles = box.querySelectorAll('.player-tile');
      existingTiles.forEach(tile => tile.remove());
    });

    // Place ranked players
    Object.entries(this.gameState.currentRanking).forEach(([rank, playerId]) => {
      if (playerId) {
        const player = this.gameState.players.find(p => p.id === playerId);
        if (player) {
          const rankBox = document.querySelector(`.rank-box[data-rank="${rank}"]`);
          if (rankBox) {
            const tile = this.ui.createRankedTile(player);
            
            // Add remove button listener
            const removeBtn = tile.querySelector('.remove-btn');
            if (removeBtn) {
              removeBtn.addEventListener('click', () => {
                this.gameState.removePlayerRank(player.id);
                this.render();
                this.saveGameState();
              });
            }

            rankBox.appendChild(tile);
          }
        }
      }
    });
  }

  updateRankingInput() {
    const rankingInput = document.getElementById('rankingInput');
    if (!rankingInput) return;

    const rankedPlayers = [];
    for (let i = 1; i <= 8; i++) {
      const playerId = this.gameState.currentRanking[i];
      if (playerId) {
        const player = this.gameState.players.find(p => p.id === playerId);
        if (player) {
          rankedPlayers.push(player.name || `玩家${playerId}`);
        }
      }
    }

    if (rankedPlayers.length === this.gameState.players.length) {
      rankingInput.value = rankedPlayers.join(' ');
      rankingInput.style.color = '#4CAF50';
    } else {
      rankingInput.value = '等待排名完成';
      rankingInput.style.color = '#ff6b6b';
    }
  }

  addPlayer() {
    const playerCount = this.gameState.players.length;
    if (playerCount >= 12) {
      alert('最多支持12个玩家');
      return;
    }
    
    const newPlayer = this.gameState.addPlayer(`玩家${playerCount + 1}`);
    this.render();
    this.saveGameState();
  }

  removePlayer(playerId) {
    if (this.gameState.players.length <= 4) {
      alert('至少需要4个玩家');
      return;
    }
    
    this.gameState.removePlayer(playerId);
    this.render();
    this.saveGameState();
  }

  calculate() {
    // Get ranking from state
    const ranking = [];
    for (let i = 1; i <= this.gameState.players.length; i++) {
      const playerId = this.gameState.currentRanking[i];
      if (playerId) {
        const player = this.gameState.players.find(p => p.id === playerId);
        if (player) {
          ranking.push(player.name);
        }
      }
    }

    if (ranking.length !== this.gameState.players.length) {
      alert('请完成所有玩家的排名');
      return;
    }

    // Calculate scores
    const result = this.calculator.calculate(
      ranking,
      this.gameState.roundLevel,
      this.gameState.players.length
    );

    if (!result.success) {
      alert(result.error || '计算失败');
      return;
    }

    // Display results
    this.displayResults(result);
  }

  displayResults(result) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = this.ui.renderResults(result);
    resultsDiv.style.display = 'block';
  }

  clearAll() {
    if (confirm('确定要清除所有数据吗？')) {
      this.gameState.reset();
      
      // Reset to 8 default players
      for (let i = 1; i <= 8; i++) {
        this.gameState.addPlayer(`玩家${i}`);
      }
      
      this.render();
      this.saveGameState();
      
      // Clear results
      const resultsDiv = document.getElementById('results');
      if (resultsDiv) {
        resultsDiv.style.display = 'none';
        resultsDiv.innerHTML = '';
      }
    }
  }

  exportPNG() {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv || resultsDiv.style.display === 'none') {
      alert('请先计算结果');
      return;
    }

    this.exportHandler.exportAsPNG(resultsDiv);
  }

  exportCSV() {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv || resultsDiv.style.display === 'none') {
      alert('请先计算结果');
      return;
    }

    // Get the current result data from the display
    const rankingInput = document.getElementById('rankingInput').value;
    const ranking = rankingInput.split(/\s+/);
    
    const result = this.calculator.calculate(
      ranking,
      this.gameState.roundLevel,
      this.gameState.players.length
    );

    if (result.success) {
      this.exportHandler.exportAsCSV(result);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.guandanApp = new GuandanApp();
  });
} else {
  window.guandanApp = new GuandanApp();
}

export default GuandanApp;