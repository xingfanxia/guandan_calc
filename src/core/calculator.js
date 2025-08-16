/**
 * Calculator Module
 * Handles all scoring calculations and game logic
 */

import { CONFIG, PATTERNS_8P, LEVEL_RULES, VALIDATION } from './config.js';

export class Calculator {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /**
   * Main calculation entry point
   */
  calculate() {
    if (!this.gameState.isRankingComplete()) {
      return {
        success: false,
        error: '请完成所有玩家的排名'
      };
    }

    // Determine winner from ranking
    const winner = this.gameState.determineWinnerFromRanking();
    if (!winner) {
      return {
        success: false,
        error: '无法确定获胜队伍'
      };
    }

    this.gameState.setWinner(winner);

    // Get winner's team ranks
    const winnerRanks = this.getWinnerRanks(winner);
    
    // Calculate score based on mode
    let result;
    switch (this.gameState.mode) {
      case 4:
        result = this.calculate4Player(winnerRanks);
        break;
      case 6:
        result = this.calculate6Player(winnerRanks);
        break;
      case 8:
        result = this.calculate8Player(winnerRanks);
        break;
      default:
        return {
          success: false,
          error: '不支持的游戏模式'
        };
    }

    // Add common result data
    result.winner = winner;
    result.winnerTeam = this.gameState.teams[winner];
    result.loserTeam = this.gameState.teams[winner === 't1' ? 't2' : 't1'];
    result.ranking = this.gameState.getRankingArray();
    result.mode = this.gameState.mode;
    result.currentLevel = this.gameState.getCurrentRoundLevel();

    return result;
  }

  /**
   * Get ranks of winning team members
   */
  getWinnerRanks(winnerTeamId) {
    const winningTeam = winnerTeamId === 't1' ? 1 : 2;
    const ranks = [];

    for (let rank = 1; rank <= this.gameState.mode; rank++) {
      const playerId = this.gameState.currentRanking[rank];
      const player = this.gameState.getPlayer(playerId);
      if (player && player.team === winningTeam) {
        ranks.push(rank);
      }
    }

    return ranks.sort((a, b) => a - b);
  }

  /**
   * Calculate 4-player mode
   */
  calculate4Player(winnerRanks) {
    const customScoring = this.gameState.customScoring.c4;
    const rankKey = winnerRanks.join(',');
    
    // Check if must have rank 1
    if (this.gameState.settings.must1 && !winnerRanks.includes(1)) {
      return {
        success: false,
        error: '获胜方必须有第1名'
      };
    }

    // Get score from custom rules
    const score = customScoring[rankKey] || 0;
    
    if (score === 0) {
      return {
        success: false,
        error: '无效的排名组合'
      };
    }

    const upgradeAmount = score;
    const label = this.get4PlayerLabel(rankKey);

    return {
      success: true,
      score,
      upgradeAmount,
      label,
      winnerRanks,
      pattern: rankKey
    };
  }

  /**
   * Calculate 6-player mode
   */
  calculate6Player(winnerRanks) {
    const thresholds = this.gameState.customScoring.t6;
    const points = this.gameState.customScoring.p6;
    
    // Check if must have rank 1
    if (this.gameState.settings.must1 && !winnerRanks.includes(1)) {
      return {
        success: false,
        error: '获胜方必须有第1名'
      };
    }

    // Calculate total points
    let totalScore = 0;
    for (const rank of winnerRanks) {
      totalScore += points[rank] || 0;
    }

    // Determine upgrade amount based on thresholds
    let upgradeAmount = 0;
    let label = '未升级';
    
    if (totalScore >= thresholds.g3) {
      upgradeAmount = 3;
      label = '升3级';
    } else if (totalScore >= thresholds.g2) {
      upgradeAmount = 2;
      label = '升2级';
    } else if (totalScore >= thresholds.g1) {
      upgradeAmount = 1;
      label = '升1级';
    }

    return {
      success: true,
      score: totalScore,
      upgradeAmount,
      label,
      winnerRanks,
      pattern: winnerRanks.join(' ')
    };
  }

  /**
   * Calculate 8-player mode
   */
  calculate8Player(winnerRanks) {
    const thresholds = this.gameState.customScoring.t8;
    const points = this.gameState.customScoring.p8;
    
    // Check if must have rank 1
    if (this.gameState.settings.must1 && !winnerRanks.includes(1)) {
      return {
        success: false,
        error: '获胜方必须有第1名'
      };
    }

    // First check for special patterns
    const pattern = winnerRanks.join(' ');
    const specialPattern = CONFIG.PATTERNS_8P[pattern];
    
    if (specialPattern) {
      return {
        success: true,
        score: specialPattern.score,
        upgradeAmount: this.getUpgradeFromScore8P(specialPattern.score),
        label: specialPattern.label,
        winnerRanks,
        pattern
      };
    }

    // Calculate using point system
    let totalScore = 0;
    for (const rank of winnerRanks) {
      totalScore += points[rank] || 0;
    }

    // Determine upgrade amount based on thresholds
    let upgradeAmount = 0;
    let label = '未升级';
    
    if (totalScore >= thresholds.g3) {
      upgradeAmount = 3;
      label = '升3级';
    } else if (totalScore >= thresholds.g2) {
      upgradeAmount = 2;
      label = '升2级';
    } else if (totalScore >= thresholds.g1) {
      upgradeAmount = 1;
      label = '升1级';
    }

    return {
      success: true,
      score: totalScore,
      upgradeAmount,
      label,
      winnerRanks,
      pattern
    };
  }

  /**
   * Get upgrade amount from score for 8-player special patterns
   */
  getUpgradeFromScore8P(score) {
    if (score >= 5) return 3;
    if (score >= 3) return 2;
    if (score >= 1) return 1;
    return 0;
  }

  /**
   * Get label for 4-player pattern
   */
  get4PlayerLabel(pattern) {
    const labels = {
      '1,2': '双下',
      '1,3': '单下',
      '1,4': '过牌',
      '2,3': '小胜'
    };
    return labels[pattern] || '赢';
  }

  /**
   * Apply calculation result to game state
   */
  applyResult(result) {
    if (!result.success) {
      return false;
    }

    const winnerTeamId = result.winner;
    const loserTeamId = winnerTeamId === 't1' ? 't2' : 't1';
    
    // Get current levels
    const winnerLevel = this.gameState.teams[winnerTeamId].level;
    const loserLevel = this.gameState.teams[loserTeamId].level;
    
    // Calculate new level for winner
    const newWinnerLevel = LEVEL_RULES.calculateNewLevel(winnerLevel, result.upgradeAmount);
    
    // Check for A-level special rules
    let aLevelNote = '';
    
    if (LEVEL_RULES.isALevel(winnerLevel)) {
      // Winner is at A-level
      if (this.gameState.settings.strictA) {
        // Strict mode: must be own A to pass
        if (winnerLevel <= loserLevel) {
          // It's winner's own A level, can pass
          this.gameState.updateTeamLevel(winnerTeamId, newWinnerLevel);
          this.gameState.aLevelState[winnerTeamId].wonA = true;
          aLevelNote = '通过A级';
        } else {
          // Not winner's own A, cannot pass
          aLevelNote = 'A级未通过（非自己的A）';
        }
      } else {
        // Loose mode: any A win counts
        this.gameState.updateTeamLevel(winnerTeamId, newWinnerLevel);
        this.gameState.aLevelState[winnerTeamId].wonA = true;
        aLevelNote = '通过A级';
      }
    } else {
      // Normal level upgrade
      this.gameState.updateTeamLevel(winnerTeamId, newWinnerLevel);
    }
    
    // Handle loser's A-level failure if applicable
    let a3Penalty = false;
    if (LEVEL_RULES.isALevel(loserLevel)) {
      a3Penalty = this.gameState.handleALevelFailure(loserTeamId);
      if (a3Penalty) {
        aLevelNote += ' | 失败方A3降级';
      }
    }
    
    // Update round number
    this.gameState.roundNumber++;
    
    // Clear ranking for next round
    if (this.gameState.settings.autoNext) {
      this.gameState.clearRanking();
    }
    
    // Check for victory
    const victory = this.checkVictory();
    
    return {
      applied: true,
      winnerTeamId,
      loserTeamId,
      newWinnerLevel,
      loserLevel,
      aLevelNote,
      a3Penalty,
      victory
    };
  }

  /**
   * Check if any team has achieved victory
   */
  checkVictory() {
    // Victory condition: Pass A-level (go from 2 to something higher)
    for (const teamId of ['t1', 't2']) {
      const team = this.gameState.teams[teamId];
      const aState = this.gameState.aLevelState[teamId];
      
      if (aState.wonA && team.level > LEVEL_RULES.A_LEVEL) {
        return {
          winner: teamId,
          teamName: team.name,
          finalLevel: team.level
        };
      }
    }
    
    return null;
  }

  /**
   * Get next round preview
   */
  getNextRoundPreview() {
    const t1Level = this.gameState.teams.t1.level;
    const t2Level = this.gameState.teams.t2.level;
    
    if (t1Level === t2Level) {
      return LEVEL_RULES.getLevelDisplay(t1Level);
    }
    
    // Show both levels if different
    return `${LEVEL_RULES.getLevelDisplay(t1Level)} vs ${LEVEL_RULES.getLevelDisplay(t2Level)}`;
  }
}

export default Calculator;