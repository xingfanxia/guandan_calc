// Main application coordinator - Guandan Calculator (Modular Version)
// UTF-8 encoding for Chinese characters
// This is the modular ES6 version that replaces the monolithic app.js

// Import all modules
import { $, on } from './utils/dom.js';
import gameState from './core/gameState.js';
import { parseRanks, calculateUpgrade, checkALevelRules, nextLevel } from './core/gameRules.js';
import PlayerSystem from './players/playerSystem.js';
import TouchHandlers from './players/touchHandlers.js';
import UIRenderer from './ui/renderer.js';
import VictoryModal from './ui/victoryModal.js';
import StatsManager from './statistics/statsManager.js';
import ExportManager from './export/exportManager.js';

// Main application class
class GuandanApp {
  constructor() {
    this.input = { value: '' };
    this.selected = [];
    
    // Initialize all subsystems
    this.playerSystem = new PlayerSystem(gameState);
    this.touchHandlers = new TouchHandlers(this.playerSystem);
    this.uiRenderer = new UIRenderer(gameState);
    this.victoryModal = new VictoryModal(gameState);
    this.statsManager = new StatsManager(gameState);
    this.exportManager = new ExportManager(gameState);
    
    // Setup inter-module communication
    this.setupCallbacks();
    
    // Initialize the application
    this.initialize();
  }

  /**
   * Setup callbacks between modules
   */
  setupCallbacks() {
    // Connect TouchHandlers to PlayerSystem
    this.playerSystem.setTouchHandlers(this.touchHandlers);
    
    // Player system callbacks
    this.playerSystem.setPlayerUpdateCallback(() => {
      this.statsManager.renderStatistics();
    });
    
    // Touch handlers callbacks
    this.touchHandlers.setAutoCalculateCallback(() => {
      this.checkAutoCalculate();
    });
    
    // UI renderer callbacks
    this.uiRenderer.setCalculationCallback(() => {
      const result = this.calc();
      return result;
    });
    
    this.uiRenderer.setAutoApplyCallback(() => {
      if (gameState.settings.autoApply) {
        const result = this.calc();
        if (result && result.ok) {
          this.applyResult();
        }
      }
    });
    
    // Stats manager callbacks
    this.statsManager.setHistoryUpdateCallback(() => {
      this.uiRenderer.renderTeams();
      this.calc();
    });
  }

  /**
   * Initialize the application
   */
  initialize() {
    // Initialize all subsystems
    this.uiRenderer.initializeUI();
    this.victoryModal.init();
    this.statsManager.initialize();
    
    // Generate initial players
    this.playerSystem.generatePlayers($('mode').value, false);
    this.playerSystem.setupDropZones();
    this.playerSystem.renderPlayers();
    this.playerSystem.renderRankingArea();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial UI state
    this.updateUI();
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Mode change
    on($('mode'), 'change', () => {
      this.selected = [];
      this.input.value = '';
      this.uiRenderer.updateRuleHint();
      this.calc();
      this.playerSystem.generatePlayers($('mode').value, false);
      // Update placeholder text for bulk name input
      this.playerSystem.updatePlaceholder();
    });
    
    // Game controls
    on($('apply'), 'click', () => this.applyResult());
    on($('advance'), 'click', () => this.doAdvance());
    on($('undo'), 'click', () => this.undoLast());
    
    // Export functions
    on($('exportTxt'), 'click', () => this.exportManager.exportTXT());
    on($('exportCsv'), 'click', () => this.exportManager.exportCSV());
    on($('exportLongPng'), 'click', () => this.exportManager.exportLongPNG());
    
    // Reset
    on($('resetMatch'), 'click', () => this.resetAll());
    
    // Player system controls
    on($('generatePlayers'), 'click', () => {
      this.playerSystem.generatePlayers($('mode').value, true);
      this.playerSystem.renderPlayers();
      this.playerSystem.renderRankingArea();
    });
    
    // Setup bulk name input
    this.playerSystem.setupBulkNameInput();
    
    on($('shuffleTeams'), 'click', () => {
      this.playerSystem.shuffleTeams($('mode').value);
      this.playerSystem.renderPlayers();
      this.playerSystem.renderRankingArea();
    });
    
    on($('clearRanking'), 'click', () => {
      this.playerSystem.clearRanking();
    });
    
    on($('randomRanking'), 'click', () => {
      this.playerSystem.randomizeRanking();
      this.checkAutoCalculate();
    });
    
    on($('manualCalc'), 'click', () => {
      // Force rebuild currentRanking from what's actually in the slots
      const area = $('rankingArea');
      const slots = area.querySelectorAll('.rank-slot');
      const newRanking = {};
      
      slots.forEach((slot) => {
        const rank = parseInt(slot.dataset.rank);
        const playerTile = slot.querySelector('.ranking-player-tile');
        if (playerTile) {
          const playerId = parseInt(playerTile.dataset.playerId);
          if (playerId) {
            newRanking[rank] = playerId;
          }
        }
      });
      
      gameState.currentRanking = newRanking;
      
      // Now calculate
      this.calculateFromRanking();
      
      // Also trigger apply if calculation was successful
      const r = this.calc();
      if (r.ok) {
        this.applyResult();
      }
    });
    
    // Settings
    on($('must1'), 'change', () => {
      gameState.settings.must1 = !!$('must1').checked;
      gameState.saveSettings();
      this.uiRenderer.refreshPreviewOnly();
    });
    
    on($('autoNext'), 'change', () => {
      gameState.settings.autoNext = !!$('autoNext').checked;
      gameState.saveSettings();
    });
    
    on($('autoApply'), 'change', () => {
      gameState.settings.autoApply = !!$('autoApply').checked;
      gameState.saveSettings();
    });
    
    on($('strictA'), 'change', () => {
      gameState.settings.strictA = !!$('strictA').checked;
      gameState.saveSettings();
    });
    
    // Rule saving
    on($('save4'), 'click', () => this.uiRenderer.collectAndSaveRules());
    on($('save6'), 'click', () => this.uiRenderer.collectAndSaveRules());
    on($('save8'), 'click', () => this.uiRenderer.collectAndSaveRules());
    
    // Make global functions available for HTML onclick handlers
    this.setupGlobalFunctions();
  }

  /**
   * Setup global functions for HTML onclick handlers
   */
  setupGlobalFunctions() {
    window.exportTXT = () => this.exportManager.exportTXT();
    window.exportCSV = () => this.exportManager.exportCSV();
    window.exportLongPNG = () => this.exportManager.exportLongPNG();
    window.resetAll = () => this.resetAll();
    window.closeVictoryModal = () => this.victoryModal.closeVictoryModal();
  }

  /**
   * Check and trigger auto-calculation
   */
  checkAutoCalculate() {
    const mode = $('mode').value;
    const num = parseInt(mode);
    let rankedCount = 0;
    
    // Count how many players are actually ranked
    for (let i = 1; i <= num; i++) {
      if (gameState.currentRanking[i]) {
        rankedCount++;
      }
    }
    
    console.log('checkAutoCalculate: ranked', rankedCount, 'of', num);
    const allRanked = rankedCount === num;
    
    if (allRanked) {
      console.log('All players ranked, calculating...');
      this.calculateFromRanking();
    } else {
      // Show progress
      const headline = $('headline');
      const explain = $('explain');
      const winnerDisplay = $('winnerDisplay');
      
      if (headline) headline.textContent = '已排名 ' + rankedCount + ' / ' + num + ' 位玩家';
      if (explain) explain.textContent = '请继续拖拽剩余玩家到排名位置';
      if (winnerDisplay) winnerDisplay.textContent = '—';
    }
  }

  /**
   * Calculate from current ranking
   */
  calculateFromRanking() {
    const mode = $('mode').value;
    const num = parseInt(mode);
    
    // Count properly ranked players
    let rankedCount = 0;
    for (let i = 1; i <= num; i++) {
      if (gameState.currentRanking[i]) {
        rankedCount++;
      }
    }
    
    console.log('calculateFromRanking: ranked', rankedCount, 'of', num);
    
    if (rankedCount !== num) {
      // If not all players are ranked, clear results
      const headline = $('headline');
      const explain = $('explain');
      const winnerDisplay = $('winnerDisplay');
      
      if (headline) headline.textContent = '等待排名完成 (' + rankedCount + '/' + num + ')';
      if (explain) explain.textContent = '请将所有玩家拖到排名位置';
      if (winnerDisplay) winnerDisplay.textContent = '—';
      return;
    }
    
    // First, determine who won based on who has rank 1
    const firstPlacePlayerId = gameState.currentRanking[1];
    if (!firstPlacePlayerId) {
      const headline = $('headline');
      if (headline) headline.textContent = '错误：未找到第1名';
      return;
    }
    
    const firstPlacePlayer = gameState.players.find(p => p.id === firstPlacePlayerId);
    if (!firstPlacePlayer) {
      const headline = $('headline');
      if (headline) headline.textContent = '错误：未找到第1名玩家';
      return;
    }
    
    // Set winner based on who has first place
    const actualWinner = firstPlacePlayer.team === 1 ? 't1' : 't2';
    this.uiRenderer.setWinner(actualWinner);
    
    const team1Ranks = [];
    const team2Ranks = [];
    
    for (let rank = 1; rank <= num; rank++) {
      const playerId = gameState.currentRanking[rank];
      if (playerId) {
        const player = gameState.players.find(p => p.id === parseInt(playerId));
        if (player) {
          if (player.team === 1) {
            team1Ranks.push(rank);
          } else {
            team2Ranks.push(rank);
          }
        }
      }
    }
    
    // Use the winning team's ranks for calculation
    const winnerRanks = actualWinner === 't1' ? team1Ranks : team2Ranks;
    winnerRanks.sort((a, b) => a - b);
    
    // Set the ranks input value
    this.input.value = winnerRanks.join(' ');
    this.selected = winnerRanks.slice();
    
    // Calculate and display results
    const result = this.calc();
    
    // Auto-apply if enabled and calculation successful
    if (gameState.settings.autoApply && result.ok) {
      this.applyResult();
    }
  }

  /**
   * Main calculation function (ported from original calc())
   */
  calc() {
    const mode = $('mode').value;
    const need = (mode === '4' ? 2 : (mode === '6' ? 3 : 4));
    
    // Check if we have valid ranking input
    if (!this.input.value) {
      const result = {
        ok: false,
        headline: '等待排名完成',
        explain: '请将所有玩家拖到排名位置'
      };
      this.uiRenderer.updateCalculationDisplay(result);
      return result;
    }
    
    const pr = parseRanks(this.input.value, need);
    if (!pr.ok) {
      const result = {
        ok: false,
        headline: '输入有误',
        explain: pr.msg
      };
      this.uiRenderer.updateCalculationDisplay(result);
      return result;
    }
    
    const ranks = pr.ranks;
    const calcResult = calculateUpgrade(mode, ranks, gameState.settings, gameState.settings.must1);
    const up = calcResult.upgrade;
    
    // Add team name to upgrade label
    const winnerName = gameState.getWinnerName();
    const label = (up > 0 ? (winnerName + ' 升 ' + up + ' 级') : '不升级');
    const base = gameState.state.roundLevel;
    
    // Calculate what the next round would be if we apply this result
    const winnerCurrentLevel = (gameState.winner === 't1') ? gameState.state.t1.lvl : gameState.state.t2.lvl;
    const winnerNewLevel = nextLevel(winnerCurrentLevel, up);
    const preview = gameState.state.nextRoundBase || winnerNewLevel;
    
    // Get team names for display
    const currentRoundTeam = base === gameState.state.t1.lvl ? gameState.settings.t1.name : 
                            (base === gameState.state.t2.lvl ? gameState.settings.t2.name : '');
    
    const headline = (mode + '人：' + '(' + ranks.join(',') + ')' + ' → ' + label + 
                     '｜本局 ' + base + (currentRoundTeam ? ' (' + currentRoundTeam + ')' : '') + 
                     ' → 下局 ' + preview + ' (' + winnerName + ')');
    
    const explain = (mode === '4' ? 
                    ('4人表：(1,2)=' + gameState.settings.c4['1,2'] + '；(1,3)=' + gameState.settings.c4['1,3'] + '；(1,4)=' + gameState.settings.c4['1,4']) : 
                    '分差与资格规则已计算');
    
    const result = {
      ok: true,
      mode: mode,
      ranks: ranks,
      up: up,
      base: base,
      preview: winnerNewLevel,
      headline: headline,
      explain: explain
    };
    
    this.uiRenderer.updateCalculationDisplay(result);
    return result;
  }

  /**
   * Apply calculation result (ported from original applyResult())
   */
  applyResult() {
    const r = this.calc();
    if (!r.ok) {
      const applyTip = $('applyTip');
      if (applyTip) applyTip.textContent = '请先计算';
      return;
    }
    
    const win = gameState.winner;
    const lose = (win === 't1' ? 't2' : 't1');
    const thisRound = gameState.state.roundLevel;
    
    // Snapshot current state
    const snapshot = {
      prevT1Lvl: gameState.state.t1.lvl,
      prevT1A: gameState.state.t1.aFail || 0,
      prevT2Lvl: gameState.state.t2.lvl,
      prevT2A: gameState.state.t2.aFail || 0,
      prevRound: gameState.state.roundLevel
    };
    
    // Calculate new levels
    let winNew = nextLevel(gameState.state[win].lvl, r.up);
    let loseNew = gameState.state[lose].lvl;
    const nextBaseByRule = winNew; // Key: next round = winner's upgraded level
    
    // A-level logic
    const aLevelResult = checkALevelRules(gameState.state, gameState.settings, win, r.ranks, r.mode);
    let aNote = aLevelResult.aNote;
    let finalWin = aLevelResult.finalWin;
    
    // Apply A-level modifications if any
    if (aLevelResult.winnerNewLevel) {
      winNew = aLevelResult.winnerNewLevel;
    }
    if (aLevelResult.loserNewLevel) {
      loseNew = aLevelResult.loserNewLevel;
    }
    
    // Apply upgrades to teams
    gameState.state[win].lvl = winNew;
    gameState.state[lose].lvl = loseNew;
    
    // Decide and save "next round level"
    if (gameState.settings.autoNext || finalWin) {
      gameState.state.roundLevel = String(nextBaseByRule); // Move to next round
      gameState.state.roundOwner = win; // The winner owns the next round
      gameState.state.nextRoundBase = null;
      console.log('Auto advancing: roundLevel set to', gameState.state.roundLevel, 'from', thisRound, 'owner:', win);
    } else {
      gameState.state.roundLevel = String(thisRound); // Stay at current round
      gameState.state.nextRoundBase = String(nextBaseByRule); // But preview shows what next round would be
      // Don't change round owner when staying at same round
      console.log('Manual mode: roundLevel stays at', gameState.state.roundLevel, 'next would be', gameState.state.nextRoundBase, 'owner:', gameState.state.roundOwner);
    }
    
    // Save state
    gameState.saveState();
    
    // Add to history
    const gameResult = {
      mode: r.mode,
      ranks: r.ranks,
      up: r.up,
      thisRound: thisRound,
      aNote: aNote,
      snapshot: snapshot
    };
    
    const row = this.statsManager.addToHistory(gameResult);
    
    // Update player stats
    this.statsManager.updatePlayerStats(r.mode);
    
    // Clear ranking for next round
    gameState.currentRanking = {};
    this.input.value = ''; // Clear the input as well
    
    // Update UI
    this.uiRenderer.renderTeams();
    this.playerSystem.renderRankingArea();
    this.calc();
    
    const applyTip = $('applyTip');
    if (applyTip) {
      applyTip.textContent = finalWin ? 
        ('🎉 ' + row.win + ' A级通关！') : 
        (gameState.settings.autoNext ? 
         ('已应用，已进入下一局（本局→下局：' + thisRound + '→' + nextBaseByRule + '）。') : 
         ('已应用。下局级牌：' + nextBaseByRule + '。'));
    }
    
    // Show victory modal if A-level was won
    if (finalWin) {
      this.victoryModal.showVictoryModal(row.win);
    }
    
    // Clear ranking for next round if auto-apply is enabled
    if (gameState.settings.autoApply) {
      this.playerSystem.clearRanking();
    }
  }

  /**
   * Advance to next round (ported from original doAdvance())
   */
  doAdvance() {
    if (gameState.state.nextRoundBase) {
      gameState.state.roundLevel = gameState.state.nextRoundBase;
      // Set round owner to the last winner
      if (gameState.state.hist.length > 0) {
        gameState.state.roundOwner = gameState.state.hist[gameState.state.hist.length - 1].winKey;
      }
      gameState.state.nextRoundBase = null;
      gameState.saveState();
      this.uiRenderer.renderTeams();
      this.calc();
      
      const applyTip = $('applyTip');
      if (applyTip) applyTip.textContent = '已进入下一局';
    } else {
      const applyTip = $('applyTip');
      if (applyTip) applyTip.textContent = '没有待进入的下一局（或已自动进入）。';
    }
  }

  /**
   * Undo last game (ported from original undoLast())
   */
  undoLast() {
    if (!gameState.state.hist.length) {
      alert('没有可撤销的记录');
      return;
    }
    gameState.rollbackTo(gameState.state.hist.length - 1);
    this.updateUI();
    
    const applyTip = $('applyTip');
    if (applyTip) applyTip.textContent = '已撤销。';
  }

  /**
   * Reset game (preserve player names and team assignments)
   */
  resetAll() {
    if (!confirm('重置比赛？（保留玩家姓名和队伍分配）')) return;
    
    gameState.resetAll();
    
    // Clear UI state
    this.selected = [];
    this.input.value = '';
    
    // Re-render everything (but preserve players)
    this.uiRenderer.renderTeams();
    this.statsManager.renderHistory();
    this.calc();
    this.statsManager.renderStatistics();
    this.playerSystem.renderRankingArea();
    // Note: Don't regenerate players - preserve existing names and team assignments
    
    const applyTip = $('applyTip');
    if (applyTip) applyTip.textContent = '已重置比赛（保留玩家设置）';
    
    // Close victory modal if it's open
    this.victoryModal.closeVictoryModal();
  }

  /**
   * Update UI elements
   */
  updateUI() {
    this.uiRenderer.renderTeams();
    this.statsManager.renderHistory();
    this.calc();
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new GuandanApp();
  
  // Make app globally accessible for debugging
  window.guandanApp = app;
});

// For backwards compatibility, export the main class
export default GuandanApp;