/**
 * Share Manager - Static URL-based Game Sharing
 * Creates permanent snapshots via URL encoding
 */

import state from '../core/state.js';
import config from '../core/config.js';
import { getPlayers } from '../player/playerManager.js';

/**
 * Generate shareable URL with game state
 * @returns {string} Shareable URL
 */
export function generateShareURL() {
  const gameData = {
    settings: config.getAll(),
    state: {
      teams: {
        t1: { lvl: state.getTeamLevel('t1'), aFail: state.getTeamAFail('t1') },
        t2: { lvl: state.getTeamLevel('t2'), aFail: state.getTeamAFail('t2') }
      },
      roundLevel: state.getRoundLevel(),
      history: state.getHistory()
    },
    players: getPlayers(),
    playerStats: state.getPlayerStats()
  };

  // Compress and encode
  const encoded = btoa(encodeURIComponent(JSON.stringify(gameData)));
  const baseURL = window.location.origin + window.location.pathname;

  return `${baseURL}?share=${encoded}`;
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

    // Load config
    if (decoded.settings) {
      Object.keys(decoded.settings).forEach(key => {
        if (key === 't1' || key === 't2') {
          config.setTeam(key, decoded.settings[key]);
        } else if (['must1', 'autoNext', 'autoApply', 'strictA'].includes(key)) {
          config.setPreference(key, decoded.settings[key]);
        }
      });
    }

    // Load state
    if (decoded.state) {
      const s = decoded.state;

      if (s.teams) {
        state.setTeamLevel('t1', s.teams.t1.lvl);
        state.setTeamAFail('t1', s.teams.t1.aFail || 0);
        state.setTeamLevel('t2', s.teams.t2.lvl);
        state.setTeamAFail('t2', s.teams.t2.aFail || 0);
      }

      if (s.roundLevel) state.setRoundLevel(s.roundLevel);

      // Load history
      if (s.history && Array.isArray(s.history)) {
        state.clearHistory();
        s.history.forEach(entry => state.addHistoryEntry(entry));
      }
    }

    // Load players
    if (decoded.players) {
      state.setPlayers(decoded.players);
    }

    // Load stats
    if (decoded.playerStats) {
      state.setPlayerStats(decoded.playerStats);
    }

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
    background: #1a1b1c; border-radius: 16px; padding: 32px; max-width: 600px;
    border: 2px solid #3b82f6;
  `;

  content.innerHTML = `
    <h2 style="color: #fff; margin: 0 0 16px 0;">📤 分享游戏快照</h2>
    <p style="color: #999; margin-bottom: 20px;">复制此链接，其他人可查看游戏状态（静态快照，不实时更新）</p>
    <textarea readonly style="width: 100%; height: 120px; background: #2a2b2c; color: #fff; border: 1px solid #444;
      border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; resize: none; margin-bottom: 20px;">${shareURL}</textarea>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="copyShareURL" style="padding: 12px 20px; background: #22c55e; color: white; border: none;
        border-radius: 8px; cursor: pointer;">📋 复制链接</button>
      <button id="closeShareModal" style="padding: 12px 20px; background: #666; color: white; border: none;
        border-radius: 8px; cursor: pointer;">关闭</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

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
