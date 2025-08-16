/**
 * Statistics Module
 * Tracks and calculates player and team statistics
 */

export class Statistics {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /**
   * Update statistics after a round
   */
  updateStats(result) {
    if (!result.success) return;

    // Update player stats
    for (let rank = 1; rank <= this.gameState.mode; rank++) {
      const playerId = this.gameState.currentRanking[rank];
      if (playerId) {
        this.updatePlayerStats(playerId, rank, result);
      }
    }

    // Update team stats
    this.updateTeamStats(result);
  }

  /**
   * Update individual player statistics
   */
  updatePlayerStats(playerId, rank, result) {
    if (!this.gameState.playerStats[playerId]) {
      this.gameState.playerStats[playerId] = this.createEmptyPlayerStats();
    }

    const stats = this.gameState.playerStats[playerId];
    const player = this.gameState.getPlayer(playerId);
    
    // Basic stats
    stats.games++;
    stats.totalRank += rank;
    stats.rankings.push(rank);
    stats.avgRank = stats.totalRank / stats.games;
    
    // Best/worst rank
    if (rank < stats.bestRank) stats.bestRank = rank;
    if (rank > stats.worstRank) stats.worstRank = rank;
    
    // Position counts
    if (rank === 1) stats.firstPlaceCount++;
    if (rank === this.gameState.mode) stats.lastPlaceCount++;
    
    // Win/loss tracking
    if (player) {
      const isWinner = (player.team === 1 && result.winner === 't1') || 
                       (player.team === 2 && result.winner === 't2');
      if (isWinner) {
        stats.wins++;
        stats.currentStreak = stats.currentStreak >= 0 ? stats.currentStreak + 1 : 1;
        if (stats.currentStreak > stats.bestStreak) {
          stats.bestStreak = stats.currentStreak;
        }
      } else {
        stats.losses++;
        stats.currentStreak = stats.currentStreak <= 0 ? stats.currentStreak - 1 : -1;
        if (Math.abs(stats.currentStreak) > stats.worstStreak) {
          stats.worstStreak = Math.abs(stats.currentStreak);
        }
      }
    }
    
    // Score contribution (for winning team only)
    if (player && ((player.team === 1 && result.winner === 't1') || 
                   (player.team === 2 && result.winner === 't2'))) {
      stats.totalScore += this.calculatePlayerScore(rank);
      stats.avgScore = stats.totalScore / stats.wins;
    }
  }

  /**
   * Update team statistics
   */
  updateTeamStats(result) {
    // This is handled in game history
    // Could add aggregate team stats here if needed
  }

  /**
   * Create empty player stats object
   */
  createEmptyPlayerStats() {
    return {
      games: 0,
      wins: 0,
      losses: 0,
      totalRank: 0,
      avgRank: 0,
      bestRank: 999,
      worstRank: 0,
      firstPlaceCount: 0,
      lastPlaceCount: 0,
      rankings: [],
      currentStreak: 0,
      bestStreak: 0,
      worstStreak: 0,
      totalScore: 0,
      avgScore: 0
    };
  }

  /**
   * Calculate score contribution for a player based on rank
   */
  calculatePlayerScore(rank) {
    const mode = this.gameState.mode;
    
    if (mode === 4) {
      const scores = { 1: 3, 2: 2, 3: 1, 4: 0 };
      return scores[rank] || 0;
    } else if (mode === 6) {
      const points = this.gameState.customScoring.p6;
      return points[rank] || 0;
    } else if (mode === 8) {
      const points = this.gameState.customScoring.p8;
      return points[rank] || 0;
    }
    
    return 0;
  }

  /**
   * Get player statistics summary
   */
  getPlayerStats(playerId) {
    return this.gameState.playerStats[playerId] || this.createEmptyPlayerStats();
  }

  /**
   * Get all players statistics
   */
  getAllPlayerStats() {
    const stats = [];
    
    for (const player of this.gameState.players) {
      const playerStats = this.getPlayerStats(player.id);
      stats.push({
        player,
        stats: playerStats
      });
    }
    
    // Sort by average rank (best first)
    stats.sort((a, b) => {
      if (a.stats.games === 0) return 1;
      if (b.stats.games === 0) return -1;
      return a.stats.avgRank - b.stats.avgRank;
    });
    
    return stats;
  }

  /**
   * Get team statistics
   */
  getTeamStats(teamNumber) {
    const teamPlayers = this.gameState.getTeamPlayers(teamNumber);
    const stats = {
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0,
      avgRank: 0,
      mvp: null,
      burden: null,
      players: []
    };
    
    let totalRankSum = 0;
    let totalGamesSum = 0;
    let bestAvgRank = 999;
    let worstAvgRank = 0;
    
    for (const player of teamPlayers) {
      const playerStats = this.getPlayerStats(player.id);
      stats.players.push({ player, stats: playerStats });
      
      if (playerStats.games > 0) {
        totalRankSum += playerStats.totalRank;
        totalGamesSum += playerStats.games;
        stats.totalWins += playerStats.wins;
        stats.totalLosses += playerStats.losses;
        
        // Find MVP (best average rank)
        if (playerStats.avgRank < bestAvgRank) {
          bestAvgRank = playerStats.avgRank;
          stats.mvp = player;
        }
        
        // Find Burden (worst average rank)
        if (playerStats.avgRank > worstAvgRank) {
          worstAvgRank = playerStats.avgRank;
          stats.burden = player;
        }
      }
    }
    
    if (totalGamesSum > 0) {
      stats.avgRank = totalRankSum / totalGamesSum;
      stats.totalGames = totalGamesSum / teamPlayers.length;
    }
    
    return stats;
  }

  /**
   * Get win/loss streaks
   */
  getStreaks() {
    const t1Stats = this.getTeamStats(1);
    const t2Stats = this.getTeamStats(2);
    
    // Calculate current streak from history
    let currentStreak = 0;
    let currentTeam = null;
    
    // Look at recent history
    const recentHistory = this.gameState.gameHistory.slice(-10);
    for (const entry of recentHistory.reverse()) {
      if (!currentTeam) {
        currentTeam = entry.winner;
        currentStreak = 1;
      } else if (entry.winner === currentTeam) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    return {
      currentStreak,
      currentTeam,
      t1Wins: t1Stats.totalWins,
      t2Wins: t2Stats.totalWins
    };
  }

  /**
   * Calculate performance rating for a player
   */
  calculatePerformanceRating(playerId) {
    const stats = this.getPlayerStats(playerId);
    if (stats.games === 0) return 0;
    
    // Weighted formula considering various factors
    const avgRankScore = (this.gameState.mode - stats.avgRank + 1) / this.gameState.mode * 40;
    const winRateScore = (stats.wins / stats.games) * 30;
    const firstPlaceScore = (stats.firstPlaceCount / stats.games) * 20;
    const consistencyScore = Math.max(0, 10 - (stats.worstRank - stats.bestRank)) * 1;
    
    return Math.round(avgRankScore + winRateScore + firstPlaceScore + consistencyScore);
  }

  /**
   * Get leaderboard
   */
  getLeaderboard() {
    const players = this.getAllPlayerStats();
    
    return players.map(({ player, stats }) => ({
      player,
      stats,
      rating: this.calculatePerformanceRating(player.id)
    })).sort((a, b) => b.rating - a.rating);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.gameState.playerStats = {};
  }

  /**
   * Export statistics for display
   */
  exportStatsForDisplay() {
    const stats = this.getAllPlayerStats();
    const team1Stats = this.getTeamStats(1);
    const team2Stats = this.getTeamStats(2);
    const streaks = this.getStreaks();
    
    return {
      players: stats.map(({ player, stats }) => ({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        team: player.team,
        games: stats.games,
        wins: stats.wins,
        losses: stats.losses,
        avgRank: stats.avgRank.toFixed(2),
        firstPlace: stats.firstPlaceCount,
        lastPlace: stats.lastPlaceCount,
        currentStreak: stats.currentStreak,
        rating: this.calculatePerformanceRating(player.id)
      })),
      teams: {
        t1: {
          name: this.gameState.teams.t1.name,
          mvp: team1Stats.mvp,
          burden: team1Stats.burden,
          avgRank: team1Stats.avgRank.toFixed(2),
          wins: team1Stats.totalWins,
          losses: team1Stats.totalLosses
        },
        t2: {
          name: this.gameState.teams.t2.name,
          mvp: team2Stats.mvp,
          burden: team2Stats.burden,
          avgRank: team2Stats.avgRank.toFixed(2),
          wins: team2Stats.totalWins,
          losses: team2Stats.totalLosses
        }
      },
      streaks
    };
  }
}

export default Statistics;