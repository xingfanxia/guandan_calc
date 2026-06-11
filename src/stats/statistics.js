/**
 * Statistics Manager
 * Extracted from app.js lines 1191-1333
 * Handles player statistics tracking and display
 */

import { $, escapeHtml } from '../core/utils.js';
import { getPlayers, getPlayersByTeam, normalizeTeamNumber } from '../player/playerManager.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit, on as onEvent, off as offEvent } from '../core/events.js';
import { renderHonors } from './honors.js';
import { findMVPAndBurden } from './mvpBurden.js';
import { getManifest } from '../themes/_shared/themeManager.js';
import { renderRankingSparkline } from '../themes/_shared/sparkline.js';
import { resolveStatsSparklinePlayerCount } from './statsMode.js';
import { applyRankingToPlayerStats } from './statisticsUpdater.js';

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
  const result = applyRankingToPlayerStats({
    players: getPlayers(),
    playerStats: state.getPlayerStats(),
    ranking: state.getCurrentRanking(),
    mode
  });

  if (!result.ok) {
    console.error(result.message);
    return result;
  }

  state.setPlayerStats(result.playerStats);
  emit('stats:updated', { playerStats: result.playerStats });
  return result;
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
    const teamA = normalizeTeamNumber(a.player.team) || 999;
    const teamB = normalizeTeamNumber(b.player.team) || 999;
    if (teamA !== teamB) {
      return teamA - teamB;
    }
    return a.avgRank - b.avgRank;
  });

  const mode = resolveStatsSparklinePlayerCount($('mode')?.value, players.length);

  // Render rows
  playerData.forEach(data => {
    const { player, stats, avgRank } = data;
    const tr = document.createElement('tr');
    const team = normalizeTeamNumber(player.team);

    const teamName = team === 1 ? config.getTeamName('t1') :
                     (team === 2 ? config.getTeamName('t2') : '未分配');
    const teamColor = team === 1 ? config.getTeamColor('t1') :
                      (team === 2 ? config.getTeamColor('t2') : '#666');

    // Subtle team background
    if (team === 1 || team === 2) {
      tr.style.background = `linear-gradient(90deg, ${teamColor}08, transparent)`;
    }

    tr.innerHTML = `
      <td><span class="emoji">${escapeHtml(player.emoji)}</span>${escapeHtml(player.name)}</td>
      <td><span style="color:${teamColor};font-weight:bold">${escapeHtml(teamName)}</span></td>
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
      `<span class="emoji">${escapeHtml(team1Result.mvp.emoji)}</span>${escapeHtml(team1Result.mvp.name)}` : '—';
  }
  if (team1Burden) {
    team1Burden.innerHTML = team1Result.burden ?
      `<span class="emoji">${escapeHtml(team1Result.burden.emoji)}</span>${escapeHtml(team1Result.burden.name)}` : '—';
  }
  if (team2MVP) {
    team2MVP.innerHTML = team2Result.mvp ?
      `<span class="emoji">${escapeHtml(team2Result.mvp.emoji)}</span>${escapeHtml(team2Result.mvp.name)}` : '—';
  }
  if (team2Burden) {
    team2Burden.innerHTML = team2Result.burden ?
      `<span class="emoji">${escapeHtml(team2Result.burden.emoji)}</span>${escapeHtml(team2Result.burden.name)}` : '—';
  }
}
