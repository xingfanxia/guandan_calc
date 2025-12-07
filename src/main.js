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
  getPlayersByTeam,
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
import { renderHonors } from './stats/honors.js';
import { applyTeamStyles, renderTeams, updateRuleHint, refreshPreviewOnly } from './ui/teamDisplay.js';
import { showVictoryModal, closeVictoryModal } from './ui/victoryModal.js';

// Export
import { exportTXT, exportCSV, exportLongPNG, exportMobilePNG } from './export/exportHandlers.js';

// Share and room features
import {
  createRoom,
  joinRoom,
  checkURLForRoom,
  getRoomInfo,
  syncNow,
  leaveRoom
} from './share/roomManager.js';
import { generateShareURL, loadFromShareURL, showShareModal } from './share/shareManager.js';
import { initializeViewerVotingSection, showEndGameVotingForViewers, showHostVoting, updateVoteLeaderboard } from './share/votingManager.js';

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

  // Render initial honors
  renderHonors();
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
      updateBulkNamesPlaceholder(newMode);
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

  // Share game button - NOW WORKS!
  const shareGameBtn = $('shareGame');
  if (shareGameBtn) {
    on(shareGameBtn, 'click', () => {
      showShareModal();
    });
  }

  // Export mobile PNG button - NOW WORKS!
  const exportMobilePngBtn = $('exportMobilePng');
  if (exportMobilePngBtn) {
    on(exportMobilePngBtn, 'click', exportMobilePNG);
  }

  // Room buttons - NOW IMPLEMENTED!
  const createRoomBtn = $('createRoom');
  const joinRoomBtn = $('joinRoom');
  const browseRoomsBtn = $('browseRooms');

  if (createRoomBtn) {
    on(createRoomBtn, 'click', async () => {
      if (!confirm('创建房间将重置当前游戏数据，确定继续？')) {
        return;
      }

      // Reset game before creating room
      state.resetAll();

      const roomInfo = await createRoom();

      if (roomInfo) {
        // Redirect to room URL with auth token
        const roomURL = `${window.location.origin}${window.location.pathname}?room=${roomInfo.roomCode}&auth=${roomInfo.authToken}`;
        window.location.href = roomURL;
      } else {
        alert('创建房间失败，请稍后重试');
      }
    });
  }

  if (joinRoomBtn) {
    on(joinRoomBtn, 'click', () => {
      const roomCode = prompt('请输入6位房间代码 (例如: A1B2C3):');
      if (roomCode && roomCode.trim().length === 6) {
        const code = roomCode.trim().toUpperCase();
        window.location.href = `${window.location.pathname}?room=${code}`;
      }
    });
  }

  if (browseRoomsBtn) {
    on(browseRoomsBtn, 'click', () => {
      alert('浏览收藏房间功能开发中');
    });
  }

  // Show voting section (人民的声音) - now implemented!
  const votingSection = $('votingSection');
  if (votingSection) {
    votingSection.style.display = 'block';
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
      const quickNames = mode === 4 ? '豪 小 大 姐' :
                          mode === 6 ? '豪 小 大 姐 夫 塔' :
                          '豪 小 大 姐 夫 塔 帆 鱼';

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
  const reset4Btn = $('reset4');
  const reset6Btn = $('reset6');
  const reset8Btn = $('reset8');

  if (save4Btn) {
    on(save4Btn, 'click', () => {
      config.collectAndSaveRulesFromDOM('4');
      updateRuleHint('4');
      refreshPreviewOnly();
      alert('4人规则已保存到本地浏览器');
    });
  }

  if (save6Btn) {
    on(save6Btn, 'click', () => {
      config.collectAndSaveRulesFromDOM('6');
      updateRuleHint('6');
      refreshPreviewOnly();
      alert('6人规则已保存到本地浏览器');
    });
  }

  if (save8Btn) {
    on(save8Btn, 'click', () => {
      config.collectAndSaveRulesFromDOM('8');
      updateRuleHint('8');
      refreshPreviewOnly();
      alert('8人规则已保存到本地浏览器');
    });
  }

  if (reset4Btn) {
    on(reset4Btn, 'click', () => {
      if (confirm('恢复4人规则到默认值？')) {
        config.resetModeToDefaults('4');
        updateRuleHint('4');
        refreshPreviewOnly();
        alert('4人规则已恢复默认');
      }
    });
  }

  if (reset6Btn) {
    on(reset6Btn, 'click', () => {
      if (confirm('恢复6人规则到默认值？')) {
        config.resetModeToDefaults('6');
        updateRuleHint('6');
        refreshPreviewOnly();
        alert('6人规则已恢复默认');
      }
    });
  }

  if (reset8Btn) {
    on(reset8Btn, 'click', () => {
      if (confirm('恢复8人规则到默认值？')) {
        config.resetModeToDefaults('8');
        updateRuleHint('8');
        refreshPreviewOnly();
        alert('8人规则已恢复默认');
      }
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

/**
 * Show room UI elements (banner, voting section)
 */
function showRoomUI() {
  const roomInfo = getRoomInfo();

  if (roomInfo.isHost) {
    // Show host banner
    showHostBanner(roomInfo.roomCode, roomInfo.authToken);
    // Show host voting interface
    setTimeout(() => showHostVoting(), 1000);
    // Start polling vote leaderboard (static import)
    setInterval(() => {
      updateVoteLeaderboard();
    }, 3000); // Poll every 3s
  } else if (roomInfo.isViewer) {
    // Show viewer banner
    showViewerBanner(roomInfo.roomCode);
    // Disable all controls for viewers
    disableViewerControls();
    // Initialize locked voting section
    initializeViewerVotingSection();

    // Check if game already ended (in case event fired before listener attached)
    setTimeout(() => {
      const history = state.getHistory();
      if (history.length > 0) {
        const latestGame = history[history.length - 1];
        if (latestGame.aNote && latestGame.aNote.includes('通关')) {
          console.log('🎯 Game already ended on load, manually unlocking voting');
          showEndGameVotingForViewers();
        }
      }
    }, 500); // Give time for listener to register
  }
}

/**
 * Disable all game controls for viewers (read-only mode)
 */
function disableViewerControls() {
  const playerSetupSection = $('playerSetupSection');

  if (playerSetupSection) {
    // Collapse and lock the player setup section
    const details = playerSetupSection.querySelector('details');
    if (details) {
      details.open = false; // Collapse
    }

    // Prevent opening
    const summary = playerSetupSection.querySelector('summary');
    if (summary) {
      summary.style.cursor = 'not-allowed';
      summary.onclick = (e) => {
        e.preventDefault();
        return false;
      };

      // Add lock icon to summary
      if (!summary.querySelector('.viewer-lock')) {
        const lockIcon = document.createElement('span');
        lockIcon.className = 'viewer-lock';
        lockIcon.textContent = ' 🔒';
        lockIcon.style.color = '#10b981';
        lockIcon.title = '观看模式：只读';
        summary.appendChild(lockIcon);
      }
    }

    // Show compact team roster
    showCompactTeamRoster();
  }

  // Disable all buttons except export
  const buttons = [
    'generatePlayers', 'shuffleTeams', 'applyBulkNames', 'quickStart',
    'clearRanking', 'randomRanking', 'manualCalc',
    'apply', 'advance', 'undo', 'resetMatch',
    'save4', 'save6', 'save8', 'reset4', 'reset6', 'reset8'
  ];

  buttons.forEach(id => {
    const btn = $(id);
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = '观看模式：只读，无法操作';
    }
  });

  // Disable mode selector and inputs
  const modeSelect = $('mode');
  if (modeSelect) {
    modeSelect.disabled = true;
    modeSelect.style.opacity = '0.5';
  }

  ['must1', 'autoNext', 'autoApply', 'strictA'].forEach(id => {
    const checkbox = $(id);
    if (checkbox) {
      checkbox.disabled = true;
      checkbox.style.opacity = '0.5';
    }
  });

  const bulkNames = $('bulkNames');
  if (bulkNames) {
    bulkNames.disabled = true;
    bulkNames.style.opacity = '0.5';
  }

  // Disable all drag and drop
  const playerTiles = document.querySelectorAll('.player-tile, .ranking-player-tile');
  playerTiles.forEach(tile => {
    tile.draggable = false;
    tile.style.cursor = 'default';
  });

  const dropZones = document.querySelectorAll('.team-drop-zone, .rank-slot, #playerPool');
  dropZones.forEach(zone => {
    zone.style.pointerEvents = 'none';
    zone.style.opacity = '0.7';
  });
}

/**
 * Show host banner with room code
 */
function showHostBanner(roomCode, authToken) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: sticky; top: 0; z-index: 100;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white; padding: 12px 20px; text-align: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    cursor: pointer;
  `;

  const viewerURL = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  banner.innerHTML = `
    <strong>📺 房主模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${roomCode}</strong>
    | <span style="font-size: 12px; opacity: 0.9;">点击横幅复制观众链接</span>
  `;

  banner.onclick = async () => {
    try {
      await navigator.clipboard.writeText(viewerURL);
      banner.innerHTML += ' <span style="color: #22c55e;">✅ 已复制</span>';
      setTimeout(() => {
        banner.innerHTML = `
          <strong>📺 房主模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${roomCode}</strong>
          | <span style="font-size: 12px; opacity: 0.9;">点击横幅复制观众链接</span>
        `;
      }, 2000);
    } catch (e) {
      alert(viewerURL);
    }
  };

  document.body.insertBefore(banner, document.body.firstChild);
}

/**
 * Show viewer banner
 */
function showViewerBanner(roomCode) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: sticky; top: 0; z-index: 100;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white; padding: 12px 20px; text-align: center;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  `;

  banner.innerHTML = `
    <strong>👀 观看模式</strong> | 房间代码: <strong style="font-size: 18px; letter-spacing: 2px;">${roomCode}</strong>
    | <span style="font-size: 12px; opacity: 0.9;">实时观看房主比赛</span>
  `;

  document.body.insertBefore(banner, document.body.firstChild);
}

/**
 * Update bulk names input placeholder based on mode
 */
function updateBulkNamesPlaceholder(mode) {
  const bulkNamesInput = $('bulkNames');
  if (!bulkNamesInput) return;

  const placeholder = mode === '4' ? '豪 小 大 姐' :
                      mode === '6' ? '豪 小 大 姐 夫 塔' :
                      '豪 小 大 姐 夫 塔 帆 鱼';

  bulkNamesInput.placeholder = placeholder;
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
    const bulkNamesInput = $('bulkNames');

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
    if (applyBulkBtn) {
      applyBulkBtn.disabled = true;
      applyBulkBtn.style.opacity = '0.5';
    }
    if (quickStartBtn) {
      quickStartBtn.disabled = true;
      quickStartBtn.style.opacity = '0.5';
    }
    if (bulkNamesInput) {
      bulkNamesInput.disabled = true;
      bulkNamesInput.style.opacity = '0.5';
    }

    // Disable mode selector
    const modeSelect = $('mode');
    if (modeSelect) {
      modeSelect.disabled = true;
      modeSelect.style.opacity = '0.5';
      modeSelect.title = '游戏进行中，无法更改人数';
    }

    // Disable drag and drop for team assignment
    const unassignedZone = $('unassignedPlayers');
    const team1Zone = $('team1Zone');
    const team2Zone = $('team2Zone');

    [unassignedZone, team1Zone, team2Zone].forEach(zone => {
      if (zone) {
        zone.style.pointerEvents = 'none';
        zone.style.opacity = '0.6';
        zone.classList.add('locked');
      }
    });

    // Disable player tile dragging for team assignment
    const playerTiles = playerSetupSection.querySelectorAll('.player-tile');
    playerTiles.forEach(tile => {
      tile.draggable = false;
      tile.style.cursor = 'not-allowed';
      tile.style.opacity = '0.8';
    });

    // Add lock indicator
    const summary = playerSetupSection.querySelector('summary');
    if (summary) {
      // Prevent opening when locked
      summary.style.cursor = 'not-allowed';

      if (!summary.querySelector('.lock-indicator')) {
        const lockIcon = document.createElement('span');
        lockIcon.className = 'lock-indicator';
        lockIcon.textContent = ' 🔒';
        lockIcon.style.color = '#f59e0b';
        lockIcon.title = '游戏进行中，玩家设置已锁定。重置游戏可解锁。';
        summary.appendChild(lockIcon);
      }

      // Prevent details toggle
      summary.onclick = (e) => {
        if (history.length > 0) {
          e.preventDefault();
          return false;
        }
      };
    }

    // Add compact team roster display
    showCompactTeamRoster();
  }
}

/**
 * Show compact team roster when panel is locked
 */
function showCompactTeamRoster() {
  const playerSetupSection = $('playerSetupSection');
  if (!playerSetupSection) return;

  // Remove existing roster if present
  const existingRoster = playerSetupSection.querySelector('.compact-team-roster');
  if (existingRoster) existingRoster.remove();

  // Create compact roster
  const roster = document.createElement('div');
  roster.className = 'compact-team-roster';
  roster.style.cssText = `
    padding: 12px;
    margin-top: 8px;
    background: #1a1b1c;
    border-radius: 8px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    font-size: 13px;
  `;

  const team1Players = getPlayersByTeam(1);
  const team2Players = getPlayersByTeam(2);

  const t1Color = config.getTeamColor('t1');
  const t2Color = config.getTeamColor('t2');
  const t1Name = config.getTeamName('t1');
  const t2Name = config.getTeamName('t2');

  // Team 1 roster
  const team1Div = document.createElement('div');
  team1Div.innerHTML = `
    <div style="color: ${t1Color}; font-weight: bold; margin-bottom: 6px;">${t1Name}</div>
    ${team1Players.map(p => `<div style="display: flex; align-items: center; gap: 6px; padding: 4px 0;">
      <span style="font-size: 16px;">${p.emoji}</span>
      <span>${p.name}</span>
    </div>`).join('')}
  `;

  // Team 2 roster
  const team2Div = document.createElement('div');
  team2Div.innerHTML = `
    <div style="color: ${t2Color}; font-weight: bold; margin-bottom: 6px;">${t2Name}</div>
    ${team2Players.map(p => `<div style="display: flex; align-items: center; gap: 6px; padding: 4px 0;">
      <span style="font-size: 16px;">${p.emoji}</span>
      <span>${p.name}</span>
    </div>`).join('')}
  `;

  roster.appendChild(team1Div);
  roster.appendChild(team2Div);

  // Insert after the entire details element (not inside it)
  const details = playerSetupSection.querySelector('details');
  if (details && details.nextSibling) {
    playerSetupSection.insertBefore(roster, details.nextSibling);
  } else {
    playerSetupSection.appendChild(roster);
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
  const bulkNamesInput = $('bulkNames');

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
  if (applyBulkBtn) {
    applyBulkBtn.disabled = false;
    applyBulkBtn.style.opacity = '1';
  }
  if (quickStartBtn) {
    quickStartBtn.disabled = false;
    quickStartBtn.style.opacity = '1';
  }
  if (bulkNamesInput) {
    bulkNamesInput.disabled = false;
    bulkNamesInput.style.opacity = '1';
  }

  // Re-enable mode selector
  const modeSelect = $('mode');
  if (modeSelect) {
    modeSelect.disabled = false;
    modeSelect.style.opacity = '1';
    modeSelect.title = '';
  }

  // Re-enable drag and drop zones
  const unassignedZone = $('unassignedPlayers');
  const team1Zone = $('team1Zone');
  const team2Zone = $('team2Zone');

  [unassignedZone, team1Zone, team2Zone].forEach(zone => {
    if (zone) {
      zone.style.pointerEvents = '';
      zone.style.opacity = '';
      zone.classList.remove('locked');
    }
  });

  // Re-enable player tile dragging
  const playerTiles = playerSetupSection.querySelectorAll('.player-tile');
  playerTiles.forEach(tile => {
    tile.draggable = true;
    tile.style.cursor = '';
    tile.style.opacity = '';
  });

  // Remove lock indicator and restore summary click
  const summary = playerSetupSection.querySelector('summary');
  if (summary) {
    summary.style.cursor = 'pointer';
    summary.onclick = null; // Remove click blocker

    const lockIndicator = summary.querySelector('.lock-indicator');
    if (lockIndicator) {
      lockIndicator.remove();
    }
  }

  // Remove compact roster
  const compactRoster = playerSetupSection.querySelector('.compact-team-roster');
  if (compactRoster) {
    compactRoster.remove();
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
