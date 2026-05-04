/**
 * Statistics Manager
 * Extracted from app.js lines 1191-1333
 * Handles player statistics tracking and display
 */

import { $} from '../core/utils.js';
import { getPlayers, getPlayerById, getPlayersByTeam } from '../player/playerManager.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit, on as onEvent, off as offEvent } from '../core/events.js';
import { renderHonors } from './honors.js';
import { findMVPAndBurden } from './mvpBurden.js';
import { getManifest } from '../themes/_shared/themeManager.js';
import { renderRankingSparkline } from '../themes/_shared/sparkline.js';

// Re-render the stats table when the theme changes so the sparkline column
// appears/disappears mid-session as featureManifest.sparklines toggles.
const onThemeChange = () => {
  if ($('playerStatsBody')) renderPlayerStatsTable();
};
onEvent('theme:changed', onThemeChange);
// Tear down on Vite HMR replace so listeners don't stack across hot reloads.
if (typeof import.meta !== 'undefined' && import.meta.hot) {
  import.meta.hot.dispose(() => offEvent('theme:changed', onThemeChange));
}

/**
 * Update player statistics from current ranking
 * @param {number} mode - Game mode
 */
export function updatePlayerStats(mode) {
  const num = parseInt(mode);
  const lastPlace = num;
  const ranking = state.getCurrentRanking();
  const playerStats = state.getPlayerStats();

  for (let rank = 1; rank <= num; rank++) {
    const playerId = ranking[rank];
    if (playerId) {
      const player = getPlayerById(playerId);
      if (player) {
        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            games: 0,
            totalRank: 0,
            firstPlaceCount: 0,
            lastPlaceCount: 0,
            rankings: []
          };
        }

        const stats = playerStats[playerId];
        stats.games++;
        stats.totalRank += rank;
        stats.rankings.push(rank);

        // Count first and last places
        if (rank === 1) {
          stats.firstPlaceCount = (stats.firstPlaceCount || 0) + 1;
        }
        if (rank === lastPlace) {
          stats.lastPlaceCount = (stats.lastPlaceCount || 0) + 1;
        }
      }
    }
  }

  state.setPlayerStats(playerStats);
  emit('stats:updated', { playerStats });
}

/**
 * Render statistics (main entry point)
 */
export function renderStatistics() {
  renderPlayerStatsTable();
  renderTeamMVPBurden();
  renderHonors(); // Direct import, not dynamic
}

/**
 * Render player statistics table
 */
export function renderPlayerStatsTable() {
  const tbody = $('playerStatsBody');
  if (!tbody) return;

  const showSpark = !!getManifest().sparklines;
  syncSparklineHeader(tbody, showSpark);

  tbody.innerHTML = '';

  const players = getPlayers();
  const playerStats = state.getPlayerStats();
  const colCount = showSpark ? 7 : 6;

  // Collect player data with stats
  const playerData = [];
  players.forEach(player => {
    const stats = playerStats[player.id];
    if (stats && stats.games > 0) {
      const avgRank = stats.totalRank / stats.games;
      playerData.push({ player, stats, avgRank });
    }
  });

  if (playerData.length === 0) {
    const emptyTr = document.createElement('tr');
    const emptyTd = document.createElement('td');
    emptyTd.colSpan = colCount;
    emptyTd.className = 'muted small';
    emptyTd.textContent = '暂无数据';
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    return;
  }

  // Sort by team, then by average ranking
  playerData.sort((a, b) => {
    if (a.player.team !== b.player.team) {
      return (a.player.team || 999) - (b.player.team || 999);
    }
    return a.avgRank - b.avgRank;
  });

  const mode = players.length || 8;

  // Render rows
  playerData.forEach(data => {
    const { player, stats, avgRank } = data;
    const tr = document.createElement('tr');

    const teamName = player.team === 1 ? config.getTeamName('t1') :
                     (player.team === 2 ? config.getTeamName('t2') : '未分配');
    const teamColor = player.team === 1 ? config.getTeamColor('t1') :
                      (player.team === 2 ? config.getTeamColor('t2') : '#666');

    // Subtle team background
    if (player.team === 1 || player.team === 2) {
      tr.style.background = `linear-gradient(90deg, ${teamColor}08, transparent)`;
    }

    tr.innerHTML = `
      <td><span class="emoji">${player.emoji}</span>${player.name}</td>
      <td><span style="color:${teamColor};font-weight:bold">${teamName}</span></td>
      <td>${stats.games}</td>
      <td><b>${avgRank.toFixed(2)}</b></td>
      <td>${stats.firstPlaceCount || 0}</td>
      <td>${stats.lastPlaceCount || 0}</td>
    `;

    if (showSpark) {
      tr.appendChild(buildSparklineCell(stats.rankings || [], mode, teamColor));
    }

    tbody.appendChild(tr);
  });
}

/**
 * Build a sparkline `<td>` for one player's ranking history.
 *
 * @param {number[]} rankings
 * @param {number} mode
 * @param {string} teamColor
 * @returns {HTMLTableCellElement}
 */
function buildSparklineCell(rankings, mode, teamColor) {
  const td = document.createElement('td');
  td.className = 'stats-table__spark';
  const svg = renderRankingSparkline(rankings, mode, {
    width: 120,
    height: 24,
    color: teamColor || 'var(--accent, currentColor)',
  });
  if (svg) {
    td.appendChild(svg);
  } else {
    td.classList.add('stats-table__spark--empty');
    td.textContent = '—';
  }
  return td;
}

/**
 * Add or remove the sparkline column header to match the active manifest.
 * Idempotent — running with the same flag twice is a no-op.
 *
 * @param {HTMLElement} tbody
 * @param {boolean} showSpark
 */
function syncSparklineHeader(tbody, showSpark) {
  const table = tbody.closest('table.stats-table');
  if (!table) return;
  const headRow = table.querySelector('thead tr');
  if (!headRow) return;
  const existing = headRow.querySelector('.stats-table__th--spark');
  if (showSpark && !existing) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.className = 'stats-table__th--spark';
    th.textContent = '近况';
    headRow.appendChild(th);
  } else if (!showSpark && existing) {
    existing.remove();
  }
}

/**
 * Render team MVP and burden
 */
export function renderTeamMVPBurden() {
  const team1Players = getPlayersByTeam(1);
  const team2Players = getPlayersByTeam(2);
  const playerStats = state.getPlayerStats();

  const team1Result = findMVPAndBurden(team1Players, playerStats);
  const team2Result = findMVPAndBurden(team2Players, playerStats);

  // Update team titles
  const team1Title = $('team1StatsTitle');
  const team2Title = $('team2StatsTitle');
  if (team1Title) team1Title.textContent = config.getTeamName('t1');
  if (team2Title) team2Title.textContent = config.getTeamName('t2');

  // Update MVP/Burden displays
  const team1MVP = $('team1MVP');
  const team1Burden = $('team1Burden');
  const team2MVP = $('team2MVP');
  const team2Burden = $('team2Burden');

  if (team1MVP) {
    team1MVP.innerHTML = team1Result.mvp ?
      `<span class="emoji">${team1Result.mvp.emoji}</span>${team1Result.mvp.name}` : '—';
  }
  if (team1Burden) {
    team1Burden.innerHTML = team1Result.burden ?
      `<span class="emoji">${team1Result.burden.emoji}</span>${team1Result.burden.name}` : '—';
  }
  if (team2MVP) {
    team2MVP.innerHTML = team2Result.mvp ?
      `<span class="emoji">${team2Result.mvp.emoji}</span>${team2Result.mvp.name}` : '—';
  }
  if (team2Burden) {
    team2Burden.innerHTML = team2Result.burden ?
      `<span class="emoji">${team2Result.burden.emoji}</span>${team2Result.burden.name}` : '—';
  }
}
