/**
 * Game Controls Controller
 * Handles game progression buttons: Apply, Advance, Undo, Reset
 */

import { $, on } from '../core/utils.js';
import config from '../core/config.js';
import { handleFinalWinSideEffects } from './finalWinSideEffects.js';
import { calculateFromRanking, getPlayerRankingData } from '../ranking/rankingCalculator.js';
import { applyGameResult, advanceToNextRound } from '../game/rules.js';
import { undoLast, resetAll, renderHistory } from '../game/history.js';
import { clearRanking as clearRankingState } from '../ranking/rankingManager.js';
import { renderPlayerPool, renderRankingSlots, checkGameEnded } from '../ranking/rankingRenderer.js';
import { updatePlayerStats, renderStatistics } from '../stats/statistics.js';
import { renderTeams } from '../ui/teamDisplay.js';
import { closeVictoryModal } from '../ui/victoryModal.js';
import { getPlayers } from '../player/playerManager.js';
import { syncNow } from '../share/roomManager.js';
import { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } from '../player/touchHandler.js';
import { attachTouchHandlers } from '../player/playerRenderer.js';

function normalizeTilePlayerId(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value.trim())) {
    return null;
  }
  return Number(value.trim());
}

function safeParseTilePlayerId(rawPlayerData) {
  if (typeof rawPlayerData !== 'string' || rawPlayerData.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPlayerData);
    return normalizeTilePlayerId(parsed?.id);
  } catch {
    return null;
  }
}

/**
 * Attach touch handlers to all player and ranking tiles
 * Uses a data attribute to prevent double-attachment
 */
export function attachTouchHandlersToAllTiles() {
  // Attach to player tiles (team assignment area)
  const playerTiles = document.querySelectorAll('.player-tile');

  playerTiles.forEach(tile => {
    // Skip if already has handlers attached
    if (tile.dataset.touchHandlersAttached === 'true') return;

    const playerId = safeParseTilePlayerId(tile.dataset.playerData);
    if (playerId) {
      const player = getPlayers().find(p => p.id === playerId);
      if (player) {
        attachTouchHandlers(tile, player, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel);
        tile.dataset.touchHandlersAttached = 'true';
      }
    }
  });

  // Attach to ranking tiles (ranking area)
  const rankingTiles = document.querySelectorAll('.ranking-player-tile');

  rankingTiles.forEach(tile => {
    // Skip if already has handlers attached
    if (tile.dataset.touchHandlersAttached === 'true') return;

    const playerId = normalizeTilePlayerId(tile.dataset.playerId);
    if (playerId) {
      const player = getPlayers().find(p => p.id === playerId);
      if (player) {
        attachTouchHandlers(tile, player, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel);
        tile.dataset.touchHandlersAttached = 'true';
      }
    }
  });
}

function setApplyTip(text) {
  const applyTip = $('applyTip');
  if (applyTip) applyTip.textContent = text;
}

/**
 * Apply one completed ranking calculation and run all downstream side effects.
 * This is the single transaction boundary for mutating levels/history/stats,
 * clearing ranking slots, syncing rooms, and scheduling final-win profile work.
 */
export async function applyCalculatedRankingResult(result, mode) {
  if (!result?.ok) {
    const message = result?.message || '请先完成排名';
    setApplyTip(message);
    return { applied: false, reason: 'calculation_failed', message };
  }

  const playerRankingData = getPlayerRankingData();
  const fullCalcResult = {
    ...result.calcResult,
    ranks: result.ranks,
    mode: String(mode)
  };

  const applyResult = applyGameResult(fullCalcResult, result.winner, playerRankingData);

  if (!applyResult?.applied) {
    const message = applyResult?.message || '应用失败：本局结果未写入';
    setApplyTip(message);
    return applyResult || { applied: false, reason: 'apply_failed', message };
  }

  updatePlayerStats(mode);
  clearRankingState();
  setApplyTip(applyResult.message || '已应用');

  renderTeams();
  renderHistory();
  renderPlayerPool();
  renderRankingSlots();
  renderStatistics();
  attachTouchHandlersToAllTiles();

  const roomSync = syncNow();
  console.log('Game applied, finalWin:', applyResult.finalWin);

  if (applyResult.finalWin) {
    const winnerName = result.winner === 't1' ? config.getTeamName('t1') : config.getTeamName('t2');
    await roomSync;
    await handleFinalWinSideEffects({ applyResult, winnerName, mode });
  }

  return applyResult;
}

export function resetMatchAndSync(renderInitialState) {
  const result = resetAll(true);
  if (result.success) {
    setApplyTip(result.message);
    renderInitialState();
    closeVictoryModal();
    syncNow();
  }
  return result;
}

/**
 * Setup all game control button handlers
 */
export function setupGameControls(renderInitialState) {
  const applyBtn = $('apply');
  const advanceBtn = $('advance');
  const undoBtn = $('undo');
  const resetBtn = $('resetMatch');

  // Apply button - Apply calculated results
  if (applyBtn) {
    on(applyBtn, 'click', async () => {
      // Double-submit guard — final-win side effects are async, so this handler
      // async, so a fast double-click could trigger two applyGameResult runs and
      // double-increment team levels before the first finishes.
      if (applyBtn.disabled) return;
      applyBtn.disabled = true;

      try {
        // Check if game has ended (A级通关)
        const victory = checkGameEnded();
        if (victory) {
          const applyTip = $('applyTip');
          if (applyTip) applyTip.textContent = '比赛已结束，请重置游戏开始新一局';
          return;
        }

        const mode = $('mode').value;
        const result = calculateFromRanking(mode);

        await applyCalculatedRankingResult(result, mode);
      } finally {
        applyBtn.disabled = false;
      }
    });
  }

  // Advance button - Move to next round
  if (advanceBtn) {
    on(advanceBtn, 'click', () => {
      const result = advanceToNextRound();
      const applyTip = $('applyTip');
      if (applyTip) {
        applyTip.textContent = result.message;
      }
      if (result.advanced) {
        renderTeams();
        syncNow();
      }
    });
  }

  // Undo button - Undo last round
  if (undoBtn) {
    on(undoBtn, 'click', () => {
      const result = undoLast();
      const applyTip = $('applyTip');
      if (!result.success && applyTip) {
        applyTip.textContent = result.message || '撤销失败。';
      }
    });
  }

  // Reset button - Reset entire game
  if (resetBtn) {
    on(resetBtn, 'click', () => {
      resetMatchAndSync(renderInitialState);
    });
  }

  // Manual calc button - Trigger calculation manually
  const manualCalcBtn = $('manualCalc');
  if (manualCalcBtn) {
    on(manualCalcBtn, 'click', async () => {
      if (manualCalcBtn.disabled) return;
      manualCalcBtn.disabled = true;

      try {
        // Check if game has ended (A级通关)
        if (checkGameEnded()) {
          const applyTip = $('applyTip');
          if (applyTip) applyTip.textContent = '比赛已结束';
          return;
        }

        const mode = $('mode').value;
        const result = calculateFromRanking(mode);

        if (result.ok && config.getPreference('autoApply')) {
          await applyCalculatedRankingResult(result, mode);
        }
      } finally {
        manualCalcBtn.disabled = false;
      }
    });
  }
}
