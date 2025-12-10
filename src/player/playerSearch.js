// Player Search UI Component
// Search existing player profiles and add them to the game

import { searchPlayers, getPlayStyleLabel } from '../api/playerApi.js';
import { $, on } from '../core/utils.js';

let searchTimeout = null;
let onPlayerSelectedCallback = null;
let onCreatePlayerCallback = null;

/**
 * Initialize player search UI
 * @param {Function} onPlayerSelected - Callback when player is selected
 * @param {Function} onCreatePlayer - Callback when create player is clicked
 */
export function initializePlayerSearch(onPlayerSelected, onCreatePlayer) {
  onPlayerSelectedCallback = onPlayerSelected;
  onCreatePlayerCallback = onCreatePlayer;

  const searchInput = $('playerSearchInput');
  const searchButton = $('playerSearchButton');
  const createButton = $('createPlayerButton');

  if (searchInput) {
    // Real-time search with debounce
    on(searchInput, 'input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(searchInput.value);
      }, 300); // 300ms debounce
    });

    // Search on Enter key
    on(searchInput, 'keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch(searchInput.value);
      }
    });
  }

  if (searchButton) {
    on(searchButton, 'click', () => {
      if (searchInput) {
        performSearch(searchInput.value);
      }
    });
  }

  if (createButton && onCreatePlayerCallback) {
    on(createButton, 'click', () => {
      onCreatePlayerCallback();
    });
  }
}

/**
 * Perform player search
 * @param {string} query - Search query
 */
async function performSearch(query) {
  const resultsContainer = $('playerSearchResults');
  if (!resultsContainer) return;

  // Show loading state
  resultsContainer.innerHTML = '<div class="small muted">搜索中...</div>';

  try {
    const { players, total } = await searchPlayers(query, 20);

    if (players.length === 0) {
      resultsContainer.innerHTML = `
        <div class="small muted">
          ${query ? `未找到匹配 "${query}" 的玩家` : '暂无玩家，点击"创建玩家"开始'}
        </div>
      `;
      return;
    }

    // Render results
    renderSearchResults(players, resultsContainer);
  } catch (error) {
    console.error('Search error:', error);
    resultsContainer.innerHTML = `
      <div class="small" style="color: #ef4444;">
        搜索失败: ${error.message}
      </div>
    `;
  }
}

/**
 * Render search results
 * @param {Array} players - Player profiles
 * @param {HTMLElement} container - Results container
 */
function renderSearchResults(players, container) {
  container.innerHTML = '';

  players.forEach(player => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-search-item';
    playerItem.style.cssText = `
      display: flex;
      align-items: center;
      padding: 8px 12px;
      margin: 4px 0;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    playerItem.innerHTML = `
      <span style="font-size: 24px; margin-right: 12px;">${player.emoji}</span>
      <div style="flex: 1;">
        <div style="font-weight: bold; margin-bottom: 2px;">
          ${player.displayName}
          <span style="color: #888; font-weight: normal; font-size: 0.9em;">@${player.handle}</span>
        </div>
        <div style="font-size: 0.85em; color: #888;">
          ${getPlayStyleLabel(player.playStyle)} · ${player.stats.gamesPlayed} 场游戏
        </div>
      </div>
      <button class="select-player-btn" style="padding: 6px 12px; background: #22c55e; color: white; border: none; border-radius: 4px; cursor: pointer;">
        选择
      </button>
    `;

    // Hover effect
    on(playerItem, 'mouseenter', () => {
      playerItem.style.background = '#252525';
      playerItem.style.borderColor = '#444';
    });

    on(playerItem, 'mouseleave', () => {
      playerItem.style.background = '#1a1a1a';
      playerItem.style.borderColor = '#333';
    });

    // Click entire row to select
    on(playerItem, 'click', () => {
      if (onPlayerSelectedCallback) {
        onPlayerSelectedCallback(player);
      }
    });

    container.appendChild(playerItem);
  });
}

/**
 * Clear search results
 */
export function clearSearchResults() {
  const resultsContainer = $('playerSearchResults');
  if (resultsContainer) {
    resultsContainer.innerHTML = '';
  }

  const searchInput = $('playerSearchInput');
  if (searchInput) {
    searchInput.value = '';
  }
}

/**
 * Show initial state (popular players or recent)
 */
export async function showInitialPlayers() {
  const resultsContainer = $('playerSearchResults');
  if (!resultsContainer) return;

  try {
    // Show most recent players as default
    const { players } = await searchPlayers('', 10);

    if (players.length > 0) {
      resultsContainer.innerHTML = '<div class="small muted" style="margin-bottom: 8px;">最近创建的玩家:</div>';
      const tempContainer = document.createElement('div');
      renderSearchResults(players, tempContainer);
      resultsContainer.appendChild(tempContainer);
    } else {
      resultsContainer.innerHTML = '<div class="small muted">暂无玩家，点击"创建玩家"开始</div>';
    }
  } catch (error) {
    console.error('Failed to load initial players:', error);
  }
}
