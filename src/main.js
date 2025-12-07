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
import { renderPlayers, updateTeamLabels, attachTouchHandlers } from './player/playerRenderer.js';
import { setupDropZones } from './player/dragDrop.js';
import { handleTouchStart, handleTouchMove, handleTouchEnd } from './player/touchHandler.js';

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
import { applyTeamStyles, renderTeams, updateRuleHint, refreshPreviewOnly } from './ui/teamDisplay.js';
import { showVictoryModal, closeVictoryModal } from './ui/victoryModal.js';

// Export
import { exportTXT, exportCSV, exportLongPNG } from './export/exportHandlers.js';

/**
 * Initialize application
 */
function init() {
  console.log('🎮 Guandan Calculator v9.0 - Modular Edition');
  console.log('DOM ready state:', document.readyState);

  try {
    // Hydrate state and config from localStorage
    console.log('Hydrating state and config...');
    state.hydrate();
    config.hydrate();
    console.log('✅ State and config hydrated');

    // Setup UI
    console.log('Initializing UI...');
    initializeUI();
    console.log('✅ UI initialized');

    // Setup event handlers
    console.log('Setting up event listeners...');
    setupEventListeners();
    console.log('✅ Event listeners set up');

    console.log('Setting up module event handlers...');
    setupModuleEventHandlers();
    console.log('✅ Module event handlers set up');

    // Initial render
    console.log('Rendering initial state...');
    renderInitialState();
    console.log('✅ Initial state rendered');

    console.log('✅ Application initialized successfully');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    console.error('Error stack:', error.stack);
  }
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

        // Merge ranks into calcResult for applyGameResult
        const fullCalcResult = {
          ...result.calcResult,
          ranks: result.ranks,
          mode: String(mode)
        };

        const applyResult = applyGameResult(fullCalcResult, result.winner, playerRankingData);

        if (applyResult && applyResult.applied) {
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
          attachTouchHandlersToAllTiles();

          // Show victory modal if final win
          if (applyResult.finalWin) {
            const winnerName = result.winner === 't1' ? config.getTeamName('t1') : config.getTeamName('t2');
            showVictoryModal(winnerName);
          }
        }
      } else {
        // Show error message
        const applyTip = $('applyTip');
        if (applyTip) {
          applyTip.textContent = result.message || '请先完成排名';
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
      console.log('Random ranking button clicked');

      if (!areAllPlayersAssigned()) {
        alert('请先分配所有玩家到队伍');
        return;
      }

      const mode = parseInt($('mode').value);
      const players = getPlayers();
      const playerIds = players.map(p => p.id);

      console.log('Calling randomizeRanking with:', { playerIds, mode });
      randomizeRanking(playerIds, mode);
    });
  }

  // Manual calc button
  const manualCalcBtn = $('manualCalc');
  if (manualCalcBtn) {
    on(manualCalcBtn, 'click', () => {
      const mode = parseInt($('mode').value);
      const result = calculateFromRanking(mode);

      if (result.ok && config.getPreference('autoApply')) {
        const playerRankingData = getPlayerRankingData();
        applyGameResult(result.calcResult, result.winner, playerRankingData);
        updatePlayerStats(mode);
        clearRankingState();

        const applyTip = $('applyTip');
        if (applyTip) applyTip.textContent = '已应用';

        renderTeams();
        renderHistory();
        renderPlayerPool();
        renderRankingSlots();
        renderStatistics();
      }
    });
  }

  // Share game button
  const shareGameBtn = $('shareGame');
  if (shareGameBtn) {
    on(shareGameBtn, 'click', () => {
      alert('分享功能开发中');
    });
  }

  // Export mobile PNG button
  const exportMobilePngBtn = $('exportMobilePng');
  if (exportMobilePngBtn) {
    on(exportMobilePngBtn, 'click', () => {
      alert('移动端PNG导出功能开发中，请使用桌面PNG导出');
    });
  }

  // Room buttons (disable for now - not implemented in modular version)
  const createRoomBtn = $('createRoom');
  const joinRoomBtn = $('joinRoom');
  const browseRoomsBtn = $('browseRooms');
  const favoriteRoomBtn = $('favoriteRoomTop');

  if (createRoomBtn) {
    on(createRoomBtn, 'click', () => {
      alert('房间功能尚未在模块化版本中实现，请使用 guodan_calc.html 版本体验房间功能');
    });
  }
  if (joinRoomBtn) {
    on(joinRoomBtn, 'click', () => {
      alert('房间功能尚未在模块化版本中实现，请使用 guodan_calc.html 版本体验房间功能');
    });
  }
  if (browseRoomsBtn) {
    on(browseRoomsBtn, 'click', () => {
      alert('房间功能尚未在模块化版本中实现，请使用 guodan_calc.html 版本体验房间功能');
    });
  }

  // Hide voting section (not implemented in modular version)
  const votingSection = $('votingSection');
  if (votingSection) {
    votingSection.style.display = 'none';
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

  // Custom rules save buttons
  const save4Btn = $('save4');
  const save6Btn = $('save6');
  const save8Btn = $('save8');

  if (save4Btn) {
    on(save4Btn, 'click', () => {
      config.collectAndSaveRulesFromDOM('4');
      updateRuleHint('4');
      refreshPreviewOnly();
    });
  }

  if (save6Btn) {
    on(save6Btn, 'click', () => {
      config.collectAndSaveRulesFromDOM('6');
      updateRuleHint('6');
      refreshPreviewOnly();
    });
  }

  if (save8Btn) {
    on(save8Btn, 'click', () => {
      config.collectAndSaveRulesFromDOM('8');
      updateRuleHint('8');
      refreshPreviewOnly();
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
    attachTouchHandlersToAllTiles();

    const mode = parseInt($('mode').value);
    const check = checkAutoCalculate(mode);

    if (check.shouldCalculate) {
      const result = calculateFromRanking(mode);

      // Update calculation display
      if (result.ok) {
        const headline = $('headline');
        const explain = $('explain');
        const winnerDisplay = $('winnerDisplay');

        const winnerName = result.winner === 't1' ? config.getTeamName('t1') : config.getTeamName('t2');
        const winnerColor = result.winner === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');

        if (headline) {
          const mode = result.calcResult.mode;
          const ranks = result.ranks;
          const upgrade = result.calcResult.upgrade;
          const roundLevel = state.getRoundLevel();
          const upgradeLabel = upgrade > 0 ? `${winnerName} 升 ${upgrade} 级` : '不升级';

          headline.textContent = `${mode}人：(${ranks.join(',')}) → ${upgradeLabel}`;
        }

        if (explain) {
          explain.textContent = result.calcResult.mode === '4'
            ? `4人表：(1,2)=${config.get4PlayerRules()['1,2']}；(1,3)=${config.get4PlayerRules()['1,3']}；(1,4)=${config.get4PlayerRules()['1,4']}`
            : '分差与资格规则已计算';
        }

        if (winnerDisplay) {
          winnerDisplay.textContent = winnerName;
          winnerDisplay.style.color = winnerColor;
        }

        // Auto-apply if enabled
        if (config.getPreference('autoApply')) {
          const playerRankingData = getPlayerRankingData();

          // Merge ranks into calcResult for applyGameResult
          const fullCalcResult = {
            ...result.calcResult,
            ranks: result.ranks,
            mode: String(mode)
          };

          const applyResult = applyGameResult(fullCalcResult, result.winner, playerRankingData);

          if (applyResult && applyResult.applied) {
            updatePlayerStats(parseInt(mode));
            clearRankingState();

            const applyTip = $('applyTip');
            if (applyTip) applyTip.textContent = applyResult.message;

            renderTeams();
            renderHistory();
            renderStatistics();

            if (applyResult.finalWin) {
              showVictoryModal(winnerName);
            }
          }
        }
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
    attachTouchHandlersToAllTiles();

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
    attachTouchHandlersToAllTiles();
    const mode = parseInt($('mode').value);
    renderRankingArea(mode);
  });

  onEvent('player:teamAssigned', () => {
    renderPlayers();
    attachTouchHandlersToAllTiles();
    const mode = parseInt($('mode').value);
    renderRankingArea(mode);
  });

  onEvent('player:teamsShuffled', () => {
    renderPlayers();
    attachTouchHandlersToAllTiles();
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
    lockTeamAssignmentPanel();
  });

  onEvent('state:gameReset', () => {
    unlockTeamAssignmentPanel();
  });

  onEvent('state:allReset', () => {
    unlockTeamAssignmentPanel();
  });
}

/**
 * Lock and collapse team assignment panel after game starts
 */
function lockTeamAssignmentPanel() {
  const playerSetupSection = $('playerSetupSection');
  const history = state.getHistory();

  // Only lock if there's history (game has started)
  if (history.length > 0 && playerSetupSection) {
    const details = playerSetupSection.querySelector('details');
    if (details) {
      details.open = false; // Collapse
    }

    // Disable team assignment buttons
    const generateBtn = $('generatePlayers');
    const shuffleBtn = $('shuffleTeams');
    const applyBulkBtn = $('applyBulkNames');
    const quickStartBtn = $('quickStart');

    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.style.opacity = '0.5';
      generateBtn.title = '游戏进行中，无法修改玩家';
    }
    if (shuffleBtn) {
      shuffleBtn.disabled = true;
      shuffleBtn.style.opacity = '0.5';
      shuffleBtn.title = '游戏进行中，无法重新分配队伍';
    }
    if (applyBulkBtn) applyBulkBtn.disabled = true;
    if (quickStartBtn) quickStartBtn.disabled = true;

    // Disable mode selector
    const modeSelect = $('mode');
    if (modeSelect) {
      modeSelect.disabled = true;
      modeSelect.style.opacity = '0.5';
      modeSelect.title = '游戏进行中，无法更改人数';
    }

    // Add lock indicator
    const summary = playerSetupSection.querySelector('summary');
    if (summary && !summary.querySelector('.lock-indicator')) {
      const lockIcon = document.createElement('span');
      lockIcon.className = 'lock-indicator';
      lockIcon.textContent = ' 🔒';
      lockIcon.style.color = '#f59e0b';
      lockIcon.title = '游戏进行中，玩家设置已锁定。重置游戏可解锁。';
      summary.appendChild(lockIcon);
    }
  }
}

/**
 * Unlock team assignment panel after reset
 */
function unlockTeamAssignmentPanel() {
  const playerSetupSection = $('playerSetupSection');
  if (!playerSetupSection) return;

  const details = playerSetupSection.querySelector('details');
  if (details) {
    details.open = true; // Expand
  }

  // Re-enable buttons
  const generateBtn = $('generatePlayers');
  const shuffleBtn = $('shuffleTeams');
  const applyBulkBtn = $('applyBulkNames');
  const quickStartBtn = $('quickStart');

  if (generateBtn) {
    generateBtn.disabled = false;
    generateBtn.style.opacity = '1';
    generateBtn.title = '';
  }
  if (shuffleBtn) {
    shuffleBtn.disabled = false;
    shuffleBtn.style.opacity = '1';
    shuffleBtn.title = '';
  }
  if (applyBulkBtn) applyBulkBtn.disabled = false;
  if (quickStartBtn) quickStartBtn.disabled = false;

  // Re-enable mode selector
  const modeSelect = $('mode');
  if (modeSelect) {
    modeSelect.disabled = false;
    modeSelect.style.opacity = '1';
    modeSelect.title = '';
  }

  // Remove lock indicator
  const lockIndicator = playerSetupSection.querySelector('.lock-indicator');
  if (lockIndicator) {
    lockIndicator.remove();
  }
}

/**
 * Attach touch handlers to all player tiles
 */
function attachTouchHandlersToAllTiles() {
  // Attach to player tiles
  const playerTiles = document.querySelectorAll('.player-tile');
  playerTiles.forEach(tile => {
    const playerData = JSON.parse(tile.dataset.playerData || '{}');
    if (playerData.id) {
      const player = getPlayers().find(p => p.id === playerData.id);
      if (player) {
        attachTouchHandlers(tile, player, handleTouchStart, handleTouchMove, handleTouchEnd);
      }
    }
  });

  // Attach to ranking tiles
  const rankingTiles = document.querySelectorAll('.ranking-player-tile');
  rankingTiles.forEach(tile => {
    const playerId = parseInt(tile.dataset.playerId);
    if (playerId) {
      const player = getPlayers().find(p => p.id === playerId);
      if (player) {
        attachTouchHandlers(tile, player, handleTouchStart, handleTouchMove, handleTouchEnd);
      }
    }
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

  // Attach touch handlers after rendering
  attachTouchHandlersToAllTiles();

  // Setup drop zones
  setupDropZones(mode);

  // Render ranking area
  renderRankingArea(mode);

  // Render history and statistics
  renderHistory();
  renderStatistics();

  // Lock team panel if game has started
  const history = state.getHistory();
  if (history.length > 0) {
    lockTeamAssignmentPanel();
  }

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

// Export globally for HTML inline handlers
if (typeof window !== 'undefined') {
  window.closeVictoryModal = closeVictoryModal;
  window.resetAll = () => {
    const result = resetAll(true);
    if (result.success) {
      renderInitialState();
      closeVictoryModal();
    }
  };

  // Debug interface
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
