/**
 * Guandan Calculator v10.0 - Main Entry Point
 * Modular ES6 rewrite - orchestrates all modules
 */

// Core modules
import { $, on } from './core/utils.js';
import state from './core/state.js';
import config from './core/config.js';
import { on as onEvent, emit } from './core/events.js';

// Controllers (NEW - extracted for maintainability)
import { setupGameControls, attachTouchHandlersToAllTiles } from './controllers/gameControls.js';
import { setupPlayerControls } from './controllers/playerControls.js';
import { setupExportControls } from './controllers/exportControls.js';
import { setupRoomControls } from './controllers/roomControls.js';
import { setupSettingsControls, updateBulkNamesPlaceholder } from './controllers/settingsControls.js';

// Game logic
import { calculateUpgrade } from './game/calculator.js';
import { renderHistory, undoLast, resetAll } from './game/history.js';
import { applyGameResult } from './game/rules.js';

// Player system
import { generatePlayers, getPlayers, removePlayer } from './player/playerManager.js';
import { renderPlayers, updateTeamLabels } from './player/playerRenderer.js';
import { setupDropZones } from './player/dragDrop.js';

// Ranking system
import {
  renderRankingArea,
  renderPlayerPool,
  renderRankingSlots,
  checkGameEnded
} from './ranking/rankingRenderer.js';
import {
  checkAutoCalculate,
  calculateFromRanking,
  getPlayerRankingData
} from './ranking/rankingCalculator.js';
import { clearRanking as clearRankingState, getRanking } from './ranking/rankingManager.js';

// Statistics and UI
import { renderStatistics, updatePlayerStats } from './stats/statistics.js';
import { renderHonors, calculateHonors } from './stats/honors.js';
import { applyTeamStyles, renderTeams, updateRuleHint } from './ui/teamDisplay.js';
import { closeVictoryModal, showVictoryModal, getVotingResults } from './ui/victoryModal.js';

// Share and room features
import {
  checkURLForRoom,
  getRoomInfo
} from './share/roomManager.js';
import { loadFromShareURL } from './share/shareManager.js';
import { initializeViewerVotingSection } from './share/votingManager.js';
import { showRoomUI, showHostBanner, showViewerBanner, disableViewerControls } from './share/roomUI.js';
import { scheduleAutoVotingSync } from './share/votingSync.js';
import { syncProfileStats } from './api/playerApi.js';

// UI management
import { lockTeamAssignmentPanel, unlockTeamAssignmentPanel, showCompactTeamRoster } from './ui/panelManager.js';

/**
 * Initialize application
 */
async function init() {

  try {
    // Check for room in URL first
    const isRoomMode = await checkURLForRoom();

    // Check for share URL
    const isSharedMode = loadFromShareURL();

    if (!isRoomMode && !isSharedMode) {
      // Normal mode - load from localStorage
      state.hydrate();
      config.hydrate();
    }

    // Start session timer (for local games only, not room mode)
    if (!isRoomMode && !state.getSessionStartTime()) {
      state.setSessionStartTime(Date.now());
      console.log('⏱️ Session timer started (local mode)');
    }

    // Setup UI
    initializeUI();

    // Setup event handlers
    setupEventListeners();
    setupModuleEventHandlers();

    // Initial render
    renderInitialState();

    // Show room UI if in room mode
    if (isRoomMode) {
      showRoomUI();
    }

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

  // Update rule hint and bulk names placeholder
  const mode = $('mode');
  if (mode) {
    updateRuleHint(mode.value);
    updateBulkNamesPlaceholder(mode.value);
  }

  // Show honors section (now implemented!)
  const honorHeading = Array.from(document.querySelectorAll('h3')).find(h => h.textContent === '荣誉提名');
  if (honorHeading && honorHeading.parentElement) {
    honorHeading.parentElement.style.display = 'block';
  }

  // Show voting section (人民的声音) - now implemented!
  const votingSection = $('votingSection');
  if (votingSection) {
    votingSection.style.display = 'block';
  }

  // Render initial honors
  renderHonors();
}

/**
 * Setup DOM event listeners
 */
function setupEventListeners() {
  // Delegate to controller modules
  setupGameControls(renderInitialState);
  setupPlayerControls();
  setupExportControls();
  setupRoomControls();
  setupSettingsControls();
}

/**
 * Setup module event handlers (inter-module communication)
 */
function setupModuleEventHandlers() {
  // Ranking events
  onEvent('ranking:updated', async () => {
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
          const winnerLevel = state.getTeamLevel(result.winner);

          // Show "X队获胜" when winning at A-level (通关)
          let upgradeLabel;
          if (upgrade > 0) {
            upgradeLabel = `${winnerName} 升 ${upgrade} 级`;
          } else if (winnerLevel === 'A') {
            upgradeLabel = `${winnerName}获胜`;
          } else {
            upgradeLabel = '不升级';
          }

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

            console.log('Game applied, finalWin:', applyResult.finalWin);

            // Handle final win (A-level victory)
            if (applyResult.finalWin) {
              console.log('🎉 Final win detected! Showing victory modal...');
              // winnerName already calculated above at line 656

              // Show victory celebration first (await to fetch current profile)
              await showVictoryModal(winnerName);
              
              // Schedule auto-sync of voting results (5 minutes)
              scheduleAutoVotingSync();
              
              // Wait a moment for potential voting, then sync stats
              setTimeout(() => {
                // Calculate session honors
                const sessionHonors = calculateHonors(parseInt(mode));
                
                // Get voting results
                const votingResults = getVotingResults();
                
                // Sync profile stats to database (non-blocking)
                const roomInfo = getRoomInfo();
                const allPlayers = getPlayers();
                const sessionStats = state.getPlayerStats();
                syncProfileStats(applyResult.historyEntry, roomInfo.roomCode || 'LOCAL', allPlayers, sessionStats, sessionHonors, votingResults);
              }, 2000); // Wait 2 seconds for voting
            }
          }
        }
      }
    } else {
      // Show progress
      const headline = $('headline');
      const explain = $('explain');
      const winnerDisplay = $('winnerDisplay');

      if (headline) headline.textContent = `已排名 ${check.progress.filled} / ${check.progress.total} 位玩家`;
      if (explain) explain.textContent = '请继续拖拽剩余玩家到排名位置';
      if (winnerDisplay) winnerDisplay.textContent = '—';
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

  onEvent('player:addedFromProfile', () => {
    renderPlayers();
    attachTouchHandlersToAllTiles();
    const mode = parseInt($('mode').value);
    renderRankingArea(mode);
  });

  onEvent('player:removeRequested', ({ playerId }) => {
    const success = removePlayer(playerId);
    if (success) {
      renderPlayers();
      attachTouchHandlersToAllTiles();
      const mode = parseInt($('mode').value);
      renderRankingArea(mode);
    }
  });

  onEvent('player:removed', ({ player }) => {
    console.log('Player removed:', player);
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
    
    // Reset session timer for new game
    state.setSessionStartTime(Date.now());
    console.log('⏱️ Session timer reset for new game');
  });

  onEvent('game:rollback', ({ index }) => {
    // After rollback, refresh all displays
    renderHistory();
    renderTeams();
    renderStatistics();
    renderPlayerPool();
    renderRankingSlots();

    // Update apply tip
    const applyTip = $('applyTip');
    if (applyTip) applyTip.textContent = '已回滚。';

    // Check if should unlock panel (if history is now empty)
    const history = state.getHistory();
    if (history.length === 0) {
      unlockTeamAssignmentPanel();
    }
  });

  // Room events
  onEvent('room:updated', () => {
    // Viewer received update from host - refresh all UI

    const mode = parseInt($('mode').value);

    renderTeams();
    applyTeamStyles();
    renderPlayers();
    renderRankingArea(mode);
    renderHistory();
    renderStatistics();
    renderHonors(); // Update honors on room sync

    // Refresh compact roster for viewers
    const roomInfo = getRoomInfo();
    if (roomInfo.isViewer) {
      showCompactTeamRoster();
    }

    // Show update notification
    const applyTip = $('applyTip');
    if (applyTip) {
      applyTip.textContent = '🔄 房间数据已更新';
      setTimeout(() => {
        applyTip.textContent = '';
      }, 2000);
    }
  });

  onEvent('room:created', ({ roomCode }) => {
  });

  onEvent('room:joined', ({ roomCode, isHost, isViewer }) => {
  });
}

// attachTouchHandlersToAllTiles is now imported from controllers/gameControls.js

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

  // Only auto-generate if no players exist AND not in room/share mode
  // Allow users to start with empty state for profile selection
  if (players.length === 0) {
    // Don't auto-generate - let users choose profile or quick setup
    renderPlayers(); // Render empty state
  } else if (players.length !== mode) {
    // Player count mismatch - regenerate
    generatePlayers(mode, false);
  } else {
    renderPlayers();
  }

  // Setup drop zones
  setupDropZones(mode);

  // Render ranking area
  renderRankingArea(mode);

  // Attach touch handlers AFTER all tiles are rendered (critical for iOS)
  attachTouchHandlersToAllTiles();

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

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('✅ PWA Service Worker registered:', registration.scope);
        })
        .catch(error => {
          console.error('❌ Service Worker registration failed:', error);
        });
    });
  }

  // PWA Install Prompt Handler
  let deferredPrompt = null;
  const installButton = document.getElementById('installPWA');

  // Capture the install prompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 PWA install prompt available');
    e.preventDefault(); // Prevent automatic prompt
    deferredPrompt = e; // Store for later use

    // Show install button
    if (installButton) {
      installButton.style.display = 'block';
    }
  });

  // Handle install button click
  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) {
        console.log('No install prompt available');
        alert('此浏览器不支持安装，请使用 Safari (iOS) 或 Chrome (Android/Desktop)');
        return;
      }

      // Show install prompt
      deferredPrompt.prompt();

      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response: ${outcome}`);

      if (outcome === 'accepted') {
        console.log('✅ PWA installed!');
      }

      // Clear the prompt
      deferredPrompt = null;
      installButton.style.display = 'none';
    });
  }

  // Detect if already installed
  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA successfully installed');
    if (installButton) {
      installButton.style.display = 'none';
    }
    deferredPrompt = null;
  });
}
