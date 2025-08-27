// Statistics and history tracking module
// UTF-8 encoding for Chinese characters

import { $, now } from '../utils/dom.js';

class StatsManager {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /**
   * Update player statistics after a game
   * @param {string} mode - Game mode
   */
  updatePlayerStats(mode) {
    const num = parseInt(mode);
    const lastPlace = num; // 4, 6, or 8 depending on mode
    
    for (let rank = 1; rank <= num; rank++) {
      const playerId = this.gameState.currentRanking[rank];
      if (playerId) {
        const player = this.gameState.players.find(p => p.id === parseInt(playerId));
        if (player) {
          if (!this.gameState.playerStats[playerId]) {
            this.gameState.playerStats[playerId] = {
              games: 0,
              totalRank: 0,
              firstPlaceCount: 0,  // Count of 1st place finishes
              lastPlaceCount: 0,   // Count of last place finishes
              rankings: []
            };
          }
          
          const stats = this.gameState.playerStats[playerId];
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
    
    this.gameState.savePlayerStats();
    this.renderStatistics();
  }

  /**
   * Render all statistics displays
   */
  renderStatistics() {
    this.renderPlayerStatsTable();
    this.renderTeamMVPBurden();
  }

  /**
   * Render player statistics table
   */
  renderPlayerStatsTable() {
    const tbody = $('playerStatsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Collect player data with stats
    const playerData = [];
    this.gameState.players.forEach((player) => {
      const stats = this.gameState.playerStats[player.id];
      if (stats && stats.games > 0) {
        const avgRank = stats.totalRank / stats.games;
        playerData.push({
          player: player,
          stats: stats,
          avgRank: avgRank
        });
      }
    });
    
    if (playerData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted small">暂无数据</td></tr>';
      return;
    }
    
    // Sort by team first, then by average ranking (best to worst within each team)
    playerData.sort((a, b) => {
      // First sort by team
      if (a.player.team !== b.player.team) {
        return (a.player.team || 999) - (b.player.team || 999); // Unassigned teams go last
      }
      // Then sort by average rank within team (lower is better)
      return a.avgRank - b.avgRank;
    });
    
    // Render sorted data
    playerData.forEach((data) => {
      const player = data.player;
      const stats = data.stats;
      const tr = document.createElement('tr');
      const avgRankDisplay = data.avgRank.toFixed(2);
      const teamName = player.team === 1 ? 
        this.gameState.settings.t1.name : 
        (player.team === 2 ? this.gameState.settings.t2.name : '未分配');
      const teamColor = player.team === 1 ? 
        this.gameState.settings.t1.color : 
        (player.team === 2 ? this.gameState.settings.t2.color : '#666');
      
      // Add subtle team background
      if (player.team === 1 || player.team === 2) {
        tr.style.background = 'linear-gradient(90deg, ' + teamColor + '08, transparent)';
      }
      
      tr.innerHTML = 
        '<td><span class="emoji">' + player.emoji + '</span>' + player.name + '</td>' +
        '<td><span style="color:' + teamColor + ';font-weight:bold">' + teamName + '</span></td>' +
        '<td>' + stats.games + '</td>' +
        '<td><b>' + avgRankDisplay + '</b></td>' +
        '<td>' + (stats.firstPlaceCount || 0) + '</td>' +
        '<td>' + (stats.lastPlaceCount || 0) + '</td>';
      
      tbody.appendChild(tr);
    });
  }

  /**
   * Render team MVP and burden displays
   */
  renderTeamMVPBurden() {
    const team1Players = this.gameState.players.filter(p => p.team === 1);
    const team2Players = this.gameState.players.filter(p => p.team === 2);
    
    const team1Result = this.findMVPAndBurden(team1Players);
    const team2Result = this.findMVPAndBurden(team2Players);
    
    const team1StatsTitle = $('team1StatsTitle');
    const team2StatsTitle = $('team2StatsTitle');
    const team1MVP = $('team1MVP');
    const team1Burden = $('team1Burden');
    const team2MVP = $('team2MVP');
    const team2Burden = $('team2Burden');
    
    if (team1StatsTitle) team1StatsTitle.textContent = this.gameState.settings.t1.name;
    if (team2StatsTitle) team2StatsTitle.textContent = this.gameState.settings.t2.name;
    
    if (team1MVP) {
      team1MVP.innerHTML = team1Result.mvp ? 
        '<span class="emoji">' + team1Result.mvp.emoji + '</span>' + team1Result.mvp.name : '—';
    }
    if (team1Burden) {
      team1Burden.innerHTML = team1Result.burden ? 
        '<span class="emoji">' + team1Result.burden.emoji + '</span>' + team1Result.burden.name : '—';
    }
    
    if (team2MVP) {
      team2MVP.innerHTML = team2Result.mvp ? 
        '<span class="emoji">' + team2Result.mvp.emoji + '</span>' + team2Result.mvp.name : '—';
    }
    if (team2Burden) {
      team2Burden.innerHTML = team2Result.burden ? 
        '<span class="emoji">' + team2Result.burden.emoji + '</span>' + team2Result.burden.name : '—';
    }
  }

  /**
   * Find MVP and burden for a team
   * @param {Array} teamPlayers - Array of team players
   * @returns {Object} MVP and burden players
   */
  findMVPAndBurden(teamPlayers) {
    let mvp = null, burden = null;
    let bestAvg = 999, worstAvg = 0;
    
    teamPlayers.forEach((player) => {
      const stats = this.gameState.playerStats[player.id];
      if (stats && stats.games > 0) {
        const avg = stats.totalRank / stats.games;
        if (avg < bestAvg) {
          bestAvg = avg;
          mvp = player;
        }
        if (avg > worstAvg) {
          worstAvg = avg;
          burden = player;
        }
      }
    });
    
    return { mvp: mvp, burden: burden };
  }

  /**
   * Render game history table
   */
  renderHistory() {
    const histBody = $('histBody');
    if (!histBody) return;
    
    histBody.innerHTML = '';
    
    for (let i = 0; i < this.gameState.state.hist.length; i++) {
      const h = this.gameState.state.hist[i];
      const tr = document.createElement('tr');
      tr.className = 'tinted';
      
      // Add color coding based on winning team
      const winColor = h.winKey === 't1' ? 
        this.gameState.settings.t1.color : 
        this.gameState.settings.t2.color;
      tr.style.background = 'linear-gradient(90deg, ' + winColor + '10, transparent)';
      
      // Add team name to upgrade display
      const upgradeText = h.up ? (h.win + ' 升' + h.up + '级') : '不升级';
      
      // Build player ranking display if available
      let rankingDisplay = '';
      if (h.playerRankings) {
        const rankingParts = [];
        for (let j = 1; j <= parseInt(h.mode); j++) {
          if (h.playerRankings[j]) {
            const p = h.playerRankings[j];
            const teamColor = p.team === 1 ? 
              this.gameState.settings.t1.color : 
              this.gameState.settings.t2.color;
            rankingParts.push('<span style="color:' + teamColor + '">' + p.emoji + p.name + '</span>');
          }
        }
        if (rankingParts.length > 0) {
          rankingDisplay = rankingParts.join(' ');
        }
      }
      
      // Keep the original combo display
      const comboDisplay = h.combo || '';
      
      tr.innerHTML = 
        '<td>' + (i + 1) + '</td>' +
        '<td>' + h.ts + '</td>' +
        '<td>' + h.mode + '</td>' +
        '<td>' + comboDisplay + '</td>' +
        '<td>' + rankingDisplay + '</td>' +
        '<td>' + upgradeText + '</td>' +
        '<td style="color:' + winColor + ';font-weight:bold">' + h.win + '</td>' +
        '<td>' + h.t1 + '</td>' +
        '<td>' + h.t2 + '</td>' +
        '<td>' + h.round + '</td>' +
        '<td>' + h.aNote + '</td>';
      
      const td = document.createElement('td');
      const b = document.createElement('button');
      b.textContent = '回滚至此前';
      b.onclick = () => {
        if (confirm('回滚到第 ' + (i + 1) + ' 局之前？')) {
          this.gameState.rollbackTo(i);
          this.renderHistory();
          // Trigger UI updates
          if (this.onHistoryUpdate) {
            this.onHistoryUpdate();
          }
        }
      };
      td.appendChild(b);
      tr.appendChild(td);
      
      histBody.appendChild(tr);
    }
  }

  /**
   * Add game result to history
   * @param {Object} gameResult - Game result data
   */
  addToHistory(gameResult) {
    // Build player ranking details for history
    const playerRankings = {};
    for (const rank in this.gameState.currentRanking) {
      const playerId = this.gameState.currentRanking[rank];
      const player = this.gameState.players.find(p => p.id === playerId);
      if (player) {
        playerRankings[rank] = {
          id: player.id,
          name: player.name,
          emoji: player.emoji,
          team: player.team
        };
      }
    }
    
    // Create history entry
    const row = {
      ts: now(),
      mode: gameResult.mode,
      combo: '(' + gameResult.ranks.join(',') + ')',
      up: gameResult.up,
      win: this.gameState.getWinnerName(),
      t1: this.gameState.state.t1.lvl,
      t2: this.gameState.state.t2.lvl,
      round: gameResult.thisRound,
      aNote: gameResult.aNote,
      winKey: this.gameState.winner,
      prevT1Lvl: gameResult.snapshot.prevT1Lvl,
      prevT1A: gameResult.snapshot.prevT1A,
      prevT2Lvl: gameResult.snapshot.prevT2Lvl,
      prevT2A: gameResult.snapshot.prevT2A,
      prevRound: gameResult.snapshot.prevRound,
      playerRankings: playerRankings
    };
    
    this.gameState.state.hist.push(row);
    this.gameState.saveState();
    this.renderHistory();
    
    return row;
  }

  /**
   * Set history update callback
   * @param {Function} callback - Callback function
   */
  setHistoryUpdateCallback(callback) {
    this.onHistoryUpdate = callback;
  }

  /**
   * Initialize statistics displays
   */
  initialize() {
    this.renderStatistics();
    this.renderHistory();
  }
}

export default StatsManager;