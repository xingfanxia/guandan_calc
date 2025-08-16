/**
 * History Module
 * Manages game history and undo functionality
 */

import { LEVEL_RULES, CONFIG } from './config.js';

export class History {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /**
   * Add entry to game history
   */
  addEntry(result, applyResult) {
    const entry = this.createHistoryEntry(result, applyResult);
    this.gameState.gameHistory.push(entry);
    
    // Limit history size
    if (this.gameState.gameHistory.length > CONFIG.UI.MAX_HISTORY) {
      this.gameState.gameHistory.shift();
    }
    
    return entry;
  }

  /**
   * Create a history entry
   */
  createHistoryEntry(result, applyResult) {
    const timestamp = new Date();
    const ranking = [];
    
    // Build full ranking with player names
    for (let i = 1; i <= this.gameState.mode; i++) {
      const playerId = this.gameState.currentRanking[i];
      const player = this.gameState.getPlayer(playerId);
      if (player) {
        ranking.push({
          rank: i,
          player: {
            id: player.id,
            name: player.name,
            emoji: player.emoji,
            team: player.team
          }
        });
      }
    }
    
    return {
      id: Date.now(),
      roundNumber: this.gameState.roundNumber,
      timestamp: timestamp.toISOString(),
      timeString: this.formatDateTime(timestamp),
      mode: this.gameState.mode,
      winner: result.winner,
      winnerTeam: {
        id: result.winner,
        name: this.gameState.teams[result.winner].name,
        color: this.gameState.teams[result.winner].color
      },
      loser: result.winner === 't1' ? 't2' : 't1',
      winnerRanks: result.winnerRanks,
      score: result.score,
      label: result.label,
      pattern: result.pattern,
      upgradeAmount: result.upgradeAmount,
      ranking: ranking,
      teamLevels: {
        before: {
          t1: this.gameState.teams.t1.level,
          t2: this.gameState.teams.t2.level
        },
        after: {
          t1: applyResult.winnerTeamId === 't1' ? applyResult.newWinnerLevel : this.gameState.teams.t1.level,
          t2: applyResult.winnerTeamId === 't2' ? applyResult.newWinnerLevel : this.gameState.teams.t2.level
        }
      },
      aLevelState: {
        t1: { ...this.gameState.aLevelState.t1 },
        t2: { ...this.gameState.aLevelState.t2 }
      },
      aLevelNote: applyResult.aLevelNote || '',
      a3Penalty: applyResult.a3Penalty || false,
      currentRoundLevel: this.gameState.getCurrentRoundLevel()
    };
  }

  /**
   * Format date and time
   */
  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Undo last entry
   */
  undo() {
    if (this.gameState.gameHistory.length === 0) {
      return {
        success: false,
        error: '没有可撤销的记录'
      };
    }
    
    const lastEntry = this.gameState.gameHistory.pop();
    
    // Restore team levels to before state
    this.gameState.teams.t1.level = lastEntry.teamLevels.before.t1;
    this.gameState.teams.t2.level = lastEntry.teamLevels.before.t2;
    
    // Restore A-level state (approximate)
    // This is not perfect but close enough for undo
    if (lastEntry.aLevelNote.includes('通过A级')) {
      const winnerTeam = lastEntry.winner;
      this.gameState.aLevelState[winnerTeam].wonA = false;
      this.gameState.aLevelState[winnerTeam].inA = true;
    }
    
    if (lastEntry.a3Penalty) {
      const loserTeam = lastEntry.loser;
      this.gameState.aLevelState[loserTeam].failures = 2; // Reset to before A3
    }
    
    // Decrement round number
    this.gameState.roundNumber = Math.max(0, this.gameState.roundNumber - 1);
    
    // Restore ranking
    this.gameState.currentRanking = {};
    lastEntry.ranking.forEach(({ rank, player }) => {
      this.gameState.currentRanking[rank] = player.id;
    });
    
    // Recalculate statistics (simplified - should recalculate from scratch)
    this.recalculateStats();
    
    return {
      success: true,
      undoneEntry: lastEntry
    };
  }

  /**
   * Delete specific entry
   */
  deleteEntry(entryId) {
    const index = this.gameState.gameHistory.findIndex(e => e.id === entryId);
    
    if (index === -1) {
      return {
        success: false,
        error: '记录不存在'
      };
    }
    
    this.gameState.gameHistory.splice(index, 1);
    
    // Recalculate everything from remaining history
    this.recalculateFromHistory();
    
    return {
      success: true
    };
  }

  /**
   * Recalculate stats from history
   */
  recalculateStats() {
    // Reset player stats
    this.gameState.playerStats = {};
    
    // Recalculate from history
    for (const entry of this.gameState.gameHistory) {
      // Update stats for each player in the entry
      entry.ranking.forEach(({ rank, player }) => {
        if (!this.gameState.playerStats[player.id]) {
          this.gameState.playerStats[player.id] = {
            games: 0,
            wins: 0,
            losses: 0,
            totalRank: 0,
            avgRank: 0,
            bestRank: 999,
            worstRank: 0,
            firstPlaceCount: 0,
            lastPlaceCount: 0,
            rankings: []
          };
        }
        
        const stats = this.gameState.playerStats[player.id];
        stats.games++;
        stats.totalRank += rank;
        stats.rankings.push(rank);
        stats.avgRank = stats.totalRank / stats.games;
        
        if (rank < stats.bestRank) stats.bestRank = rank;
        if (rank > stats.worstRank) stats.worstRank = rank;
        if (rank === 1) stats.firstPlaceCount++;
        if (rank === this.gameState.mode) stats.lastPlaceCount++;
        
        const isWinner = (player.team === 1 && entry.winner === 't1') || 
                        (player.team === 2 && entry.winner === 't2');
        if (isWinner) {
          stats.wins++;
        } else {
          stats.losses++;
        }
      });
    }
  }

  /**
   * Recalculate entire game state from history
   */
  recalculateFromHistory() {
    // This is a complex operation that rebuilds the entire game state
    // from the history. For simplicity, we'll just recalculate stats
    this.recalculateStats();
    
    // Update round number
    this.gameState.roundNumber = this.gameState.gameHistory.length;
  }

  /**
   * Get history for display
   */
  getHistoryForDisplay() {
    return this.gameState.gameHistory.map(entry => ({
      id: entry.id,
      round: entry.roundNumber,
      time: entry.timeString,
      mode: entry.mode + '人',
      winnerCombo: entry.winnerRanks.join(','),
      ranking: entry.ranking.map(r => r.player.name).join(' > '),
      upgrade: `${entry.label} (+${entry.upgradeAmount})`,
      winner: entry.winnerTeam.name,
      t1Level: LEVEL_RULES.getLevelDisplay(entry.teamLevels.after.t1),
      t2Level: LEVEL_RULES.getLevelDisplay(entry.teamLevels.after.t2),
      roundLevel: LEVEL_RULES.getLevelDisplay(entry.currentRoundLevel),
      aNote: entry.aLevelNote || '—'
    }));
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.gameState.gameHistory = [];
    this.gameState.roundNumber = 0;
    this.recalculateStats();
  }

  /**
   * Export history
   */
  exportHistory() {
    return {
      matchInfo: {
        startTime: this.gameState.gameHistory[0]?.timestamp || new Date().toISOString(),
        endTime: this.gameState.gameHistory[this.gameState.gameHistory.length - 1]?.timestamp || new Date().toISOString(),
        totalRounds: this.gameState.gameHistory.length,
        mode: this.gameState.mode,
        teams: {
          t1: this.gameState.teams.t1,
          t2: this.gameState.teams.t2
        }
      },
      history: this.gameState.gameHistory,
      finalState: {
        teams: this.gameState.teams,
        playerStats: this.gameState.playerStats
      }
    };
  }

  /**
   * Import history
   */
  importHistory(data) {
    if (!data.history || !Array.isArray(data.history)) {
      return {
        success: false,
        error: '无效的历史数据'
      };
    }
    
    this.gameState.gameHistory = data.history;
    
    if (data.matchInfo) {
      this.gameState.mode = data.matchInfo.mode || 8;
      if (data.matchInfo.teams) {
        this.gameState.teams = data.matchInfo.teams;
      }
    }
    
    if (data.finalState) {
      if (data.finalState.playerStats) {
        this.gameState.playerStats = data.finalState.playerStats;
      }
    }
    
    this.recalculateFromHistory();
    
    return {
      success: true,
      imported: data.history.length
    };
  }
}

export default History;