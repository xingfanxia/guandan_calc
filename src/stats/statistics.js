/**
 * Statistics Manager
 * Extracted from app.js lines 1191-1333
 * Handles player statistics tracking and display
 */

import { $} from '../core/utils.js';
import { getPlayers, getPlayerById, getPlayersByTeam } from '../player/playerManager.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';
import { renderHonors } from './honors.js';

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

  tbody.innerHTML = '';

  const players = getPlayers();
  const playerStats = state.getPlayerStats();

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
    tbody.innerHTML = '<tr><td colspan="6" class="muted small">暂无数据</td></tr>';
    return;
  }

  // Sort by team, then by average ranking
  playerData.sort((a, b) => {
    if (a.player.team !== b.player.team) {
      return (a.player.team || 999) - (b.player.team || 999);
    }
    return a.avgRank - b.avgRank;
  });

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

    tbody.appendChild(tr);
  });
}

/**
 * Render team MVP and burden
 */
export function renderTeamMVPBurden() {
  const team1Players = getPlayersByTeam(1);
  const team2Players = getPlayersByTeam(2);
  const playerStats = state.getPlayerStats();

  function findMVPAndBurden(teamPlayers) {
    let mvp = null, burden = null;
    let mvpStats = null, burdenStats = null;

    teamPlayers.forEach(player => {
      const stats = playerStats[player.id];
      if (stats && stats.games > 0) {
        const avg = stats.totalRank / stats.games;

        // MVP: lowest average rank (best performance)
        if (!mvp) {
          mvp = player;
          mvpStats = { avg, stats };
        } else {
          const mvpAvg = mvpStats.avg;
          if (avg < mvpAvg) {
            mvp = player;
            mvpStats = { avg, stats };
          } else if (avg === mvpAvg) {
            // Tie-breaker 1: more 1st places
            if (stats.firstPlaceCount > mvpStats.stats.firstPlaceCount) {
              mvp = player;
              mvpStats = { avg, stats };
            } else if (stats.firstPlaceCount === mvpStats.stats.firstPlaceCount) {
              // Tie-breaker 2: fewer last places
              if (stats.lastPlaceCount < mvpStats.stats.lastPlaceCount) {
                mvp = player;
                mvpStats = { avg, stats };
              }
            }
          }
        }

        // Burden: highest average rank (worst performance)
        if (!burden) {
          burden = player;
          burdenStats = { avg, stats };
        } else {
          const burdenAvg = burdenStats.avg;
          if (avg > burdenAvg) {
            burden = player;
            burdenStats = { avg, stats };
          } else if (avg === burdenAvg) {
            // Tie-breaker 1: more last places
            if (stats.lastPlaceCount > burdenStats.stats.lastPlaceCount) {
              burden = player;
              burdenStats = { avg, stats };
            } else if (stats.lastPlaceCount === burdenStats.stats.lastPlaceCount) {
              // Tie-breaker 2: fewer 1st places
              if (stats.firstPlaceCount < burdenStats.stats.firstPlaceCount) {
                burden = player;
                burdenStats = { avg, stats };
              }
            }
          }
        }
      }
    });

    return { mvp, burden };
  }

  const team1Result = findMVPAndBurden(team1Players);
  const team2Result = findMVPAndBurden(team2Players);

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
