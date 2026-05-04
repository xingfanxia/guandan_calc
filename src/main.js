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
import { renderPlayers, renderTeamRosters, updateTeamLabels } from './player/playerRenderer.js';
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
import { initTickerSync } from './ui/tickerSync.js';
import { initCalcPreviewSync, renderCalcPreview } from './ui/calcPreviewSync.js';
import { initRulesDrawerSync, renderRulesDrawerChips } from './ui/rulesDrawerSync.js';
import { initProfileSnippetSync, renderProfileSnippet } from './ui/profileSnippetSync.js';

// Theme system
import * as themeManager from './themes/_shared/themeManager.js';
import * as broadcastTheme from './themes/broadcast/index.js';
import { mountPicker as mountThemePicker } from './themes/_shared/ThemePicker.js';

/**
 * Initialize application
 */
async function init() {

  try {
    // Register + mount theme before any other UI work — settles the data-theme
    // attribute and palette so subsequent renderers paint correctly on first frame.
    themeManager.register(broadcastTheme);
    await themeManager.mount(themeManager.resolveBootTheme('broadcast'));

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

  // Mount theme picker (single theme today; placeholder UI until Phase 2 ships Linear)
  const pickerMount = $('themePickerMount');
  if (pickerMount) mountThemePicker(pickerMount);

  // Wire ticker to live game state (M2 fix)
  initTickerSync();

  // Wire editorial calc preview (red/blue/差距 segments)
  initCalcPreviewSync();

  // Wire compact rules drawer chip strip
  initRulesDrawerSync();

  // Wire profile snippet (bottom-of-page personal data card)
  initProfileSnippetSync();

  // Wire AUTO badge on apply/advance buttons (toggles when autoApply changes)
  function updateAutoBadges() {
    const autoOn = config.getPreference('autoApply');
    const applyNote = $('applyAutoNote');
    const advanceNote = $('advanceAutoNote');
    if (applyNote) applyNote.hidden = !autoOn;
    if (advanceNote) advanceNote.hidden = !autoOn;
  }
  updateAutoBadges();
  onEvent('config:preferenceChanged', ({ key }) => {
    if (key === 'autoApply') updateAutoBadges();
  });
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
    renderTeamRosters();
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

              // Show victory celebration first (await to fetch current profile)
              await showVictoryModal(winnerName);

              // Schedule auto-sync of voting results (5 minutes)
              scheduleAutoVotingSync();

              // Snapshot all state SYNCHRONOUSLY before the 2-second timeout.
              // Without this, a user clicking Undo / Reset / Apply during the wait
              // would cause syncProfileStats to read the post-mutation values
              // (wrong stats credited to the wrong session).
              const capturedMode = parseInt(mode);
              const capturedHistoryEntry = JSON.parse(JSON.stringify(applyResult.historyEntry));
              const capturedRoomInfo = getRoomInfo();
              const capturedPlayers = getPlayers().map(p => ({ ...p }));
              const capturedStats = JSON.parse(JSON.stringify(state.getPlayerStats()));

              setTimeout(() => {
                const sessionHonors = calculateHonors(capturedMode);
                const votingResults = getVotingResults();

                let sessionDuration = capturedHistoryEntry.sessionDuration || 0;
                if (capturedRoomInfo.createdAt && capturedRoomInfo.finishedAt) {
                  sessionDuration = Math.floor(
                    (new Date(capturedRoomInfo.finishedAt).getTime() - new Date(capturedRoomInfo.createdAt).getTime()) / 1000
                  );
                  console.log(`✅ Calculated session duration from room: ${sessionDuration}s`);
                }

                const historyWithDuration = {
                  ...capturedHistoryEntry,
                  sessionDuration
                };

                syncProfileStats(
                  historyWithDuration,
                  capturedRoomInfo.roomCode || 'LOCAL',
                  capturedPlayers,
                  capturedStats,
                  sessionHonors,
                  votingResults,
                  capturedRoomInfo.authToken || null  // host-only; viewers/LOCAL get null
                );
              }, 2000);
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
    renderTeamRosters();
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
    attachTouchHandlersToAllTiles();
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
        // No native prompt available - show platform-specific instructions
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

        if (isIOS || isSafari) {
          // Create visual instruction modal for iOS
          const modal = document.createElement('div');
          modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          `;
          
          modal.innerHTML = `
            <div style="background: #1a1a1a; border-radius: 16px; padding: 24px; max-width: 400px; border: 2px solid #22c55e;">
              <h2 style="color: #22c55e; margin-top: 0;">📱 iOS 安装指南</h2>
              
              <div style="background: #0b0b0c; padding: 16px; border-radius: 8px; margin: 16px 0; line-height: 1.8;">
                <p style="margin: 8px 0;"><strong style="color: #22c55e;">第1步:</strong> 点击底部 <span style="background: #333; padding: 2px 8px; border-radius: 4px;">分享</span> 按钮</p>
                <p style="margin: 8px 0; font-size: 32px; text-align: center;">□↑</p>
                
                <p style="margin: 8px 0;"><strong style="color: #22c55e;">第2步:</strong> 向上滚动菜单</p>
                
                <p style="margin: 8px 0;"><strong style="color: #22c55e;">第3步:</strong> 找到 <span style="background: #333; padding: 2px 8px; border-radius: 4px;">添加到主屏幕</span></p>
                
                <p style="margin: 8px 0;"><strong style="color: #22c55e;">第4步:</strong> 点击 <span style="background: #22c55e; color: black; padding: 2px 8px; border-radius: 4px; font-weight: bold;">添加</span></p>
              </div>
              
              <div style="background: #2a1a1a; padding: 12px; border-radius: 8px; border-left: 3px solid #fbbf24; margin: 16px 0;">
                <p style="color: #fbbf24; margin: 0; font-size: 13px;">
                  💡 提示: Safari浏览器目前不支持一键安装，需要手动操作
                </p>
              </div>
              
              <button onclick="this.closest('div').parentElement.remove()" style="width: 100%; padding: 12px; background: #22c55e; color: black; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">
                知道了
              </button>
            </div>
          `;
          
          modal.addEventListener('click', (e) => {
            if (e.target === modal) {
              modal.remove();
            }
          });
          
          document.body.appendChild(modal);
        } else {
          alert('💻 安装方法：\n\n1. Chrome: 地址栏右侧的安装图标\n2. 或浏览器菜单 → "安装应用"\n\n如已安装，此按钮不会显示安装提示。');
        }
        return;
      }

      // Show native install prompt (Chrome/Edge)
      deferredPrompt.prompt();

      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response: ${outcome}`);

      if (outcome === 'accepted') {
        console.log('✅ PWA installed!');
      }

      // Clear the prompt
      deferredPrompt = null;
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
