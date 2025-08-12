/**
 * Calculator Module
 * Handles all scoring calculations for Guandan game
 */

export class Calculator {
  constructor() {
    // Scoring rules for different game modes
    this.scoringRules = {
      4: {
        winPatterns: {
          '1 2': { score: 3, label: '双下', teams: ['winner', 'winner'] },
          '1 3': { score: 2, label: '赢', teams: ['winner', 'loser', 'winner'] },
          '1 4': { score: 1, label: '赢', teams: ['winner', 'loser', 'loser', 'winner'] },
          '2 3': { score: 1, label: '赢', teams: ['loser', 'winner', 'winner'] }
        }
      },
      6: {
        winPatterns: {
          '1 2': { score: 5, label: '三打一', teams: ['winner', 'winner'] },
          '1 2 3': { score: 4, label: '双下', teams: ['winner', 'winner', 'winner'] },
          '1 2 4': { score: 3, label: '单下', teams: ['winner', 'winner', 'loser', 'winner'] },
          '1 2 5': { score: 2, label: '赢', teams: ['winner', 'winner', 'loser', 'loser', 'winner'] },
          '1 3 4': { score: 2, label: '赢', teams: ['winner', 'loser', 'winner', 'winner'] },
          '1 3 5': { score: 1, label: '赢', teams: ['winner', 'loser', 'winner', 'loser', 'winner'] },
          '1 4 5': { score: 1, label: '赢', teams: ['winner', 'loser', 'loser', 'winner', 'winner'] },
          '2 3 4': { score: 1, label: '赢', teams: ['loser', 'winner', 'winner', 'winner'] }
        }
      },
      8: {
        winPatterns: {
          '1 2': { score: 7, label: '四打一', teams: ['winner', 'winner'] },
          '1 2 3': { score: 6, label: '三打一', teams: ['winner', 'winner', 'winner'] },
          '1 2 3 4': { score: 5, label: '双下', teams: ['winner', 'winner', 'winner', 'winner'] },
          '1 2 3 5': { score: 4, label: '过牌双下', teams: ['winner', 'winner', 'winner', 'loser', 'winner'] },
          '1 2 4 5': { score: 3, label: '单下', teams: ['winner', 'winner', 'loser', 'winner', 'winner'] },
          '1 2 4 6': { score: 2, label: '过牌', teams: ['winner', 'winner', 'loser', 'winner', 'loser', 'winner'] },
          '1 3 4 5': { score: 2, label: '过牌', teams: ['winner', 'loser', 'winner', 'winner', 'winner'] },
          '1 2 5 6': { score: 2, label: '大过牌', teams: ['winner', 'winner', 'loser', 'loser', 'winner', 'winner'] },
          '1 3 4 6': { score: 1, label: '赢', teams: ['winner', 'loser', 'winner', 'winner', 'loser', 'winner'] },
          '1 3 5 7': { score: 1, label: '赢', teams: ['winner', 'loser', 'winner', 'loser', 'winner', 'loser', 'winner'] },
          '2 3 4 5': { score: 1, label: '赢', teams: ['loser', 'winner', 'winner', 'winner', 'winner'] }
        }
      }
    };

    // Round level mappings
    this.roundLevels = {
      2: 'A', 3: 'K', 4: 'Q', 5: 'J', 6: '10',
      7: '9', 8: '8', 9: '7', 10: '6', 11: '5',
      12: '4', 13: '3', 14: '2'
    };
  }

  /**
   * Main calculation function
   * @param {Array} ranking - Array of player names in rank order
   * @param {number} roundLevel - Current round level (2-14)
   * @param {number} mode - Game mode (4, 6, or 8 players)
   * @returns {Object} Calculation result
   */
  calculate(ranking, roundLevel, mode) {
    try {
      // Validate inputs
      if (!ranking || ranking.length !== mode) {
        return {
          success: false,
          error: `需要 ${mode} 个名次`
        };
      }

      // Get the winning team's ranks
      const winnerRanks = this.extractWinnerRanks(ranking);
      
      // Find matching pattern
      const pattern = this.findPattern(winnerRanks, mode);
      
      if (!pattern) {
        return {
          success: false,
          error: '无效的排名组合'
        };
      }

      // Calculate upgrade levels
      const upgradeInfo = this.calculateUpgrade(pattern.score, roundLevel);
      
      return {
        success: true,
        ok: true,
        pattern: pattern,
        ranking: ranking,
        winnerRanks: winnerRanks,
        score: pattern.score,
        label: pattern.label,
        upgrade: upgradeInfo,
        roundLevel: roundLevel,
        mode: mode
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract winner ranks from full ranking
   * Assumes the ranking is already filtered to winner's team only
   */
  extractWinnerRanks(ranking) {
    // In the modular version, we expect to receive only the winner's ranks
    // as numbers, not player names
    if (typeof ranking[0] === 'number') {
      return ranking;
    }
    
    // If we receive player names, convert to ranks (1-based)
    return ranking.map((_, index) => index + 1);
  }

  /**
   * Find matching scoring pattern
   */
  findPattern(ranks, mode) {
    const rules = this.scoringRules[mode];
    if (!rules) return null;

    const ranksStr = ranks.join(' ');
    
    for (const [pattern, info] of Object.entries(rules.winPatterns)) {
      if (pattern === ranksStr) {
        return info;
      }
    }
    
    return null;
  }

  /**
   * Calculate upgrade levels
   */
  calculateUpgrade(score, currentLevel) {
    const newLevel = Math.min(currentLevel + score, 14); // Max level is 14 (2)
    const levelsUpgraded = newLevel - currentLevel;
    
    return {
      currentLevel: currentLevel,
      currentLevelName: this.roundLevels[currentLevel],
      newLevel: newLevel,
      newLevelName: this.roundLevels[newLevel],
      levelsUpgraded: levelsUpgraded,
      isMaxLevel: newLevel >= 14
    };
  }

  /**
   * Calculate team-based results
   * @param {Array} fullRanking - Complete ranking with all players
   * @param {Array} players - Player objects with team info
   * @param {number} roundLevel - Current round level
   */
  calculateTeamBased(fullRanking, players, roundLevel) {
    const mode = fullRanking.length;
    
    // Determine winner based on first place
    const firstPlacePlayer = players.find(p => p.name === fullRanking[0]);
    if (!firstPlacePlayer) {
      return { success: false, error: '无法确定获胜队伍' };
    }
    
    const winningTeam = firstPlacePlayer.team;
    
    // Get winning team's ranks
    const winnerRanks = [];
    fullRanking.forEach((playerName, index) => {
      const player = players.find(p => p.name === playerName);
      if (player && player.team === winningTeam) {
        winnerRanks.push(index + 1); // 1-based rank
      }
    });
    
    // Calculate using winner ranks
    const result = this.calculate(winnerRanks, roundLevel, mode);
    
    if (result.success) {
      result.winningTeam = winningTeam;
      result.fullRanking = fullRanking;
    }
    
    return result;
  }

  /**
   * Get round level name
   */
  getRoundLevelName(level) {
    return this.roundLevels[level] || '未知';
  }

  /**
   * Validate game mode
   */
  isValidMode(mode) {
    return [4, 6, 8].includes(mode);
  }

  /**
   * Get all patterns for a mode
   */
  getPatternsForMode(mode) {
    return this.scoringRules[mode]?.winPatterns || {};
  }
}