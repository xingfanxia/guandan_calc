/**
 * Guandan Calculator v9.0 - Main Entry Point
 * Modular ES6 rewrite - orchestrates all modules
 */

// Core modules
import { $, on } from './core/utils.js';
import state from './core/state.js';
import config from './core/config.js';
import { on as onEvent, emit } from './core/events.js';

// Game logic
import { calculateUpgrade } from './game/calculator.js';
import { applyGameResult, advanceToNextRound } from './game/rules.js';
import { renderHistory, undoLast, resetAll } from './game/history.js';

// Player system
import {
  generatePlayers,
  getPlayers,
  shuffleTeams,
  applyBulkNames,
  areAllPlayersAssigned
} from './player/playerManager.js';
import { renderPlayers, updateTeamLabels } from './player/playerRenderer.js';
import { setupDropZones } from './player/dragDrop.js';

// Ranking system
import {
  getRanking,
  clearRanking as clearRankingState,
  randomizeRanking,
  isRankingComplete
} from './ranking/rankingManager.js';
import {
  renderRankingArea,
  renderPlayerPool,
  renderRankingSlots
} from './ranking/rankingRenderer.js';
import {
  checkAutoCalculate,
  calculateFromRanking,
  getPlayerRankingData
} from './ranking/rankingCalculator.js';

// Statistics and UI
import { updatePlayerStats, renderStatistics } from './stats/statistics.js';
import { applyTeamStyles, renderTeams, updateRuleHint } from './ui/teamDisplay.js';
import { showVictoryModal, closeVictoryModal } from './ui/victoryModal.js';

// Export
import { exportTXT, exportCSV, exportLongPNG } from './export/exportHandlers.js';

/**
 * Initialize application
 */
function init() {
  console.log('🎮 Guandan Calculator v9.0 - Modular Edition');

  // Hydrate state and config from localStorage
  state.hydrate();
  config.hydrate();

  // Setup UI
  initializeUI();

  // Setup event handlers
  setupEventListeners();
  setupModuleEventHandlers();

  // Initial render
  renderInitialState();

  console.log('✅ Application initialized successfully');
}

/**
 * Initialize UI elements
 */
function initializeUI() {
  // Apply team styling
  applyTeamStyles();
  updateTeamLabels();

  // Update checkboxes from config
  const must1 = $('must1');
  const autoNext = $('autoNext');
  const autoApply = $('autoApply');
  const strictA = $('strictA');

  const prefs = config.getPreferences();
  if (must1) must1.checked = prefs.must1;
  if (autoNext) autoNext.checked = prefs.autoNext;
  if (autoApply) autoApply.checked = prefs.autoApply;
  if (strictA) strictA.checked = prefs.strictA;

  // Update rule hint
  const mode = $('mode');
  if (mode) {
    updateRuleHint(mode.value);
  }
}

/**
 * Setup DOM event listeners
 */
function setupEventListeners() {
  // Mode change
  const modeSelect = $('mode');
  if (modeSelect) {
    on(modeSelect, 'change', (e) => {
      const newMode = e.target.value;
      updateRuleHint(newMode);
      generatePlayers(parseInt(newMode), false);
      emit('ui:modeChanged', { mode: newMode });
    });
  }

  // Game controls
  const applyBtn = $('apply');
  const advanceBtn = $('advance');
  const undoBtn = $('undo');
  const resetBtn = $('resetMatch');

  if (applyBtn) {
    on(applyBtn, 'click', () => {
      const mode = $('mode').value;
      const result = calculateFromRanking(parseInt(mode));

      if (result.ok) {
        const playerRankingData = getPlayerRankingData();
        const applyResult = applyGameResult(result.calcResult, result.winner, playerRankingData);

        // Update player stats
        updatePlayerStats(parseInt(mode));

        // Clear ranking for next round
        clearRankingState();

        // Show message
        const applyTip = $('applyTip');
        if (applyTip) {
          applyTip.textContent = applyResult.message;
        }

        // Render updates
        renderTeams();
        renderHistory();
        renderPlayerPool();
        renderRankingSlots();
        renderStatistics();

        // Show victory modal if final win
        if (applyResult.finalWin) {
          const winnerName = result.winner === 't1' ? config.getTeamName('t1') : config.getTeamName('t2');
          showVictoryModal(winnerName);
        }
      }
    });
  }

  if (advanceBtn) {
    on(advanceBtn, 'click', () => {
      const result = advanceToNextRound();
      const applyTip = $('applyTip');
      if (applyTip) {
        applyTip.textContent = result.message;
      }
      renderTeams();
    });
  }

  if (undoBtn) {
    on(undoBtn, 'click', () => {
      undoLast();
      const applyTip = $('applyTip');
      if (applyTip) applyTip.textContent = '已撤销。';
      renderTeams();
      renderHistory();
      renderStatistics();
    });
  }

  if (resetBtn) {
    on(resetBtn, 'click', () => {
      const result = resetAll(true);
      if (result.success) {
        const applyTip = $('applyTip');
        if (applyTip) applyTip.textContent = result.message;
        renderInitialState();
        closeVictoryModal();
      }
    });
  }

  // Player controls
  const generateBtn = $('generatePlayers');
  const shuffleBtn = $('shuffleTeams');
  const clearRankingBtn = $('clearRanking');
  const randomRankingBtn = $('randomRanking');

  if (generateBtn) {
    on(generateBtn, 'click', () => {
      const mode = parseInt($('mode').value);
      generatePlayers(mode, true);
    });
  }

  if (shuffleBtn) {
    on(shuffleBtn, 'click', () => {
      const mode = parseInt($('mode').value);
      shuffleTeams(mode);
    });
  }

  if (clearRankingBtn) {
    on(clearRankingBtn, 'click', () => {
      clearRankingState();
    });
  }

  if (randomRankingBtn) {
    on(randomRankingBtn, 'click', () => {
      if (!areAllPlayersAssigned()) {
        alert('请先分配所有玩家到队伍');
        return;
      }

      const mode = parseInt($('mode').value);
      const players = getPlayers();
      const playerIds = players.map(p => p.id);
      randomizeRanking(playerIds, mode);
    });
  }

  // Bulk name input
  const applyBulkNamesBtn = $('applyBulkNames');
  const quickStartBtn = $('quickStart');

  if (applyBulkNamesBtn) {
    on(applyBulkNamesBtn, 'click', () => {
      const bulkNames = $('bulkNames');
      if (bulkNames && bulkNames.value) {
        const success = applyBulkNames(bulkNames.value);
        if (success) {
          renderPlayers();
          bulkNames.value = '';
        } else {
          alert('姓名数量不匹配玩家数量');
        }
      }
    });
  }

  if (quickStartBtn) {
    on(quickStartBtn, 'click', () => {
      const mode = parseInt($('mode').value);
      const quickNames = mode === 4 ? '超 豪 姐 哥' :
                          mode === 6 ? '超 豪 姐 哥 帆 夫' :
                          '超 豪 姐 哥 帆 夫 塔 小';

      const success = applyBulkNames(quickNames);
      if (success) {
        shuffleTeams(mode);
        renderPlayers();
        renderRankingArea(mode);
      }
    });
  }

  // Settings
  const must1 = $('must1');
  const autoNext = $('autoNext');
  const autoApply = $('autoApply');
  const strictA = $('strictA');

  if (must1) {
    on(must1, 'change', (e) => {
      config.setPreference('must1', e.target.checked);
    });
  }

  if (autoNext) {
    on(autoNext, 'change', (e) => {
      config.setPreference('autoNext', e.target.checked);
    });
  }

  if (autoApply) {
    on(autoApply, 'change', (e) => {
      config.setPreference('autoApply', e.target.checked);
    });
  }

  if (strictA) {
    on(strictA, 'change', (e) => {
      config.setPreference('strictA', e.target.checked);
    });
  }

  // Export buttons
  const exportTxtBtn = $('exportTxt');
  const exportCsvBtn = $('exportCsv');
  const exportPngBtn = $('exportLongPng');

  if (exportTxtBtn) on(exportTxtBtn, 'click', exportTXT);
  if (exportCsvBtn) on(exportCsvBtn, 'click', exportCSV);
  if (exportPngBtn) on(exportPngBtn, 'click', exportLongPNG);
}

/**
 * Setup module event handlers (inter-module communication)
 */
function setupModuleEventHandlers() {
  // Ranking events
  onEvent('ranking:updated', () => {
    renderPlayerPool();
    renderRankingSlots();

    const mode = parseInt($('mode').value);
    const check = checkAutoCalculate(mode);

    if (check.shouldCalculate) {
      const result = calculateFromRanking(mode);
      if (result.ok && config.getPreference('autoApply')) {
        // Auto-apply will be handled by the apply button logic
      }
    } else {
      // Show progress
      const headline = $('headline');
      const explain = $('explain');
      if (headline) headline.textContent = `已排名 ${check.progress.filled} / ${check.progress.total} 位玩家`;
      if (explain) explain.textContent = '请继续拖拽剩余玩家到排名位置';
    }
  });

  onEvent('ranking:cleared', () => {
    renderPlayerPool();
    renderRankingSlots();

    const headline = $('headline');
    const explain = $('explain');
    const winnerDisplay = $('winnerDisplay');

    if (headline) headline.textContent = '等待排名';
    if (explain) explain.textContent = '请将玩家拖到排名位置';
    if (winnerDisplay) winnerDisplay.textContent = '—';
  });

  // Player events
  onEvent('player:generated', () => {
    renderPlayers();
    const mode = parseInt($('mode').value);
    renderRankingArea(mode);
  });

  onEvent('player:teamAssigned', () => {
    renderPlayers();
    const mode = parseInt($('mode').value);
    renderRankingArea(mode);
  });

  onEvent('player:teamsShuffled', () => {
    renderPlayers();
    const mode = parseInt($('mode').value);
    renderRankingArea(mode);
  });

  onEvent('player:updated', () => {
    renderPlayers();
    renderStatistics();
  });

  // Config events
  onEvent('config:teamChanged', () => {
    applyTeamStyles();
    updateTeamLabels();
    renderPlayers();
  });

  // State events
  onEvent('state:teamLevelChanged', () => {
    renderTeams();
  });

  onEvent('state:historyAdded', () => {
    renderHistory();
  });
}

/**
 * Render initial application state
 */
function renderInitialState() {
  // Render teams
  renderTeams();
  applyTeamStyles();

  // Generate or load players
  const mode = parseInt($('mode').value);
  const players = getPlayers();

  if (players.length === 0 || players.length !== mode) {
    generatePlayers(mode, false);
  } else {
    renderPlayers();
  }

  // Setup drop zones
  setupDropZones(mode);

  // Render ranking area
  renderRankingArea(mode);

  // Render history and statistics
  renderHistory();
  renderStatistics();

  // Initial placeholder state
  const headline = $('headline');
  const explain = $('explain');
  const winnerDisplay = $('winnerDisplay');

  if (headline) headline.textContent = '等待排名';
  if (explain) explain.textContent = '请将玩家拖到排名位置';
  if (winnerDisplay) winnerDisplay.textContent = '—';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
if (typeof window !== 'undefined') {
  window.guandanApp = {
    state,
    config,
    modules: {
      game: { calculateUpgrade, applyGameResult },
      player: { generatePlayers, getPlayers },
      ranking: { getRanking, calculateFromRanking },
      history: { renderHistory, undoLast, resetAll }
    }
  };
}
