/**
 * Share Manager - Static URL-based Game Sharing
 * Creates permanent snapshots via URL encoding
 */

import state from '../core/state.js';
import config from '../core/config.js';
import { getHistoryEntries, resolveGameStatus } from '../game/gameStatus.js';
import { getPlayers } from '../player/playerManager.js';
import {
  canonicalizeRoomSnapshotPayload,
  isValidRoomSnapshotPayload
} from './roomSnapshotValidation.js';
import { applySnapshotSettings } from './roomSettings.js';

function snapshotWinnerFromStatus(gameStatus) {
  return gameStatus?.winnerKey || state.getWinner();
}

function latestHistoryWinner(history) {
  return [...history]
    .reverse()
    .find(entry => entry?.winKey === 't1' || entry?.winKey === 't2')
    ?.winKey || null;
}

function resolveSnapshotWinner(snapshotWinner, gameStatus, history = []) {
  if (gameStatus?.ended && (gameStatus.winnerKey === 't1' || gameStatus.winnerKey === 't2')) {
    return gameStatus.winnerKey;
  }
  if (snapshotWinner === 't1' || snapshotWinner === 't2') return snapshotWinner;
  const historyWinner = latestHistoryWinner(history);
  if (historyWinner) return historyWinner;
  return gameStatus?.winnerKey || null;
}

/**
 * Generate shareable URL with game state
 * @returns {string} Shareable URL
 */
export function generateShareURL() {
  const history = state.getHistory();
  const gameStatus = resolveGameStatus(state.getGameStatus(), history);

  const gameData = canonicalizeRoomSnapshotPayload({
    settings: config.getAll(),
    state: {
      teams: {
        t1: { lvl: state.getTeamLevel('t1'), aFail: state.getTeamAFail('t1') },
        t2: { lvl: state.getTeamLevel('t2'), aFail: state.getTeamAFail('t2') }
      },
      roundLevel: state.getRoundLevel(),
      roundOwner: state.getRoundOwner(),
      nextRoundBase: state.getNextRoundBase(),
      gameStatus,
      history,
      winner: snapshotWinnerFromStatus(gameStatus)
    },
    players: getPlayers(),
    playerStats: state.getPlayerStats(),
    currentRanking: state.getCurrentRanking()
  });

  // Compress and encode
  const encoded = btoa(encodeURIComponent(JSON.stringify(gameData)));
  const baseURL = window.location.origin + window.location.pathname;

  return `${baseURL}?share=${encodeURIComponent(encoded)}`;
}

/**
 * Load game state from URL
 * @returns {boolean} True if share data found and loaded
 */
export function loadFromShareURL() {
  const params = new URLSearchParams(window.location.search);
  const shareData = params.get('share');

  if (!shareData) return false;

  try {
    const decoded = JSON.parse(decodeURIComponent(atob(shareData)));
    const snapshot = canonicalizeRoomSnapshotPayload(decoded);
    if (!isValidRoomSnapshotPayload(snapshot)) {
      return false;
    }

    // Load config
    if (snapshot.settings) {
      applySnapshotSettings(snapshot.settings);
    }

    // Load state
    if (snapshot.state) {
      const s = snapshot.state;
      const incomingHistory = getHistoryEntries(s);

      state.setTeamLevel('t1', s.teams?.t1?.lvl ?? '2');
      state.setTeamAFail('t1', s.teams?.t1?.aFail ?? 0);
      state.setTeamLevel('t2', s.teams?.t2?.lvl ?? '2');
      state.setTeamAFail('t2', s.teams?.t2?.aFail ?? 0);
      state.setRoundLevel(s.roundLevel ?? '2');
      state.setRoundOwner(s.roundOwner ?? null);
      state.setNextRoundBase(s.nextRoundBase ?? null);

      // Treat shared state as a complete snapshot. A legacy snapshot without
      // history means "no captured history", not "keep stale local history".
      state.setHistory(incomingHistory);
      const loadedGameStatus = resolveGameStatus(s.gameStatus, incomingHistory);
      state.setGameStatus(loadedGameStatus);
      state.setWinner(resolveSnapshotWinner(s.winner, loadedGameStatus, incomingHistory) || 't1');
    }

    // Load dependent player data as a complete snapshot. Missing legacy
    // fields mean "not captured", not "keep whatever local state had".
    state.setPlayers(snapshot.players || []);
    state.setPlayerStats(snapshot.playerStats || {});
    state.setCurrentRanking(snapshot.currentRanking || {});

    return true;
  } catch (error) {
    console.error('Failed to load share URL:', error);
    return false;
  }
}

/**
 * Show share modal with URL
 */
export function showShareModal() {
  const shareURL = generateShareURL();

  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); z-index: 9999;
    display: flex; align-items: center; justify-content: center;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: var(--surface); border-radius: 16px; padding: 32px; max-width: 600px;
    border: 1px solid var(--rule); border-left: 3px solid var(--accent);
  `;

  content.innerHTML = `
    <h2 style="color: var(--ink); margin: 0 0 16px 0;">📤 分享游戏快照</h2>
    <p style="color: var(--ink-dim); margin-bottom: 20px;">复制此链接，其他人可查看游戏状态（静态快照，不实时更新）</p>
    <textarea id="shareURLText" readonly style="width: 100%; height: 120px; background: var(--surface-2); color: var(--ink); border: 1px solid var(--rule);
      border-radius: 8px; padding: 12px; font-family: var(--font-mono); font-size: 12px; resize: none; margin-bottom: 20px;"></textarea>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="copyShareURL" style="padding: 12px 20px; background: var(--accent); color: var(--on-accent); border: none;
        border-radius: 8px; cursor: pointer;">📋 复制链接</button>
      <button id="closeShareModal" style="padding: 12px 20px; background: var(--surface-3); color: var(--ink); border: 1px solid var(--rule);
        border-radius: 8px; cursor: pointer;">关闭</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  const shareURLText = content.querySelector('#shareURLText');
  if (shareURLText) {
    shareURLText.value = shareURL;
  }

  // Event listeners
  content.querySelector('#copyShareURL').onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareURL);
      const btn = content.querySelector('#copyShareURL');
      btn.textContent = '✅ 已复制';
      setTimeout(() => btn.textContent = '📋 复制链接', 2000);
    } catch (e) {
      alert('复制失败，请手动复制');
    }
  };

  content.querySelector('#closeShareModal').onclick = () => {
    document.body.removeChild(modal);
  };
}
