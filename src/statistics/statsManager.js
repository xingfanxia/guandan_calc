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
   * Render team MVP and burden displays + special honors
   */
  renderTeamMVPBurden() {
    const team1Players = this.gameState.players.filter(p => p.team === 1);
    const team2Players = this.gameState.players.filter(p => p.team === 2);
    
    const team1Result = this.findMVPAndBurden(team1Players);
    const team2Result = this.findMVPAndBurden(team2Players);
    
    // Update team honors
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
    
    // Update special honors
    const specialHonors = this.findSpecialHonors();
    
    const honorElements = {
      lyubu: $('lyubu'),
      adou: $('adou'), 
      shifo: $('shifo'),
      bodongwang: $('bodongwang'),
      fendouwang: $('fendouwang'),
      fuzhuwang: $('fuzhuwang')
    };
    
    Object.keys(honorElements).forEach(honorKey => {
      const element = honorElements[honorKey];
      const honorData = specialHonors[honorKey];
      
      if (element) {
        if (honorData && honorData.player) {
          const winner = honorData.player;
          element.innerHTML = '<span class="emoji">' + winner.emoji + '</span>' + winner.name;
          
          // Add click event to show explanation
          element.style.cursor = 'pointer';
          element.onclick = () => {
            alert(`${this.getHonorTitle(honorKey)}\n\n${winner.emoji} ${winner.name}\n\n${honorData.explanation}\n\n点击荣誉称号可查看详细说明`);
          };
        } else {
          element.innerHTML = '—';
          element.style.cursor = 'default';
          element.onclick = null;
        }
      }
    });
  }

  /**
   * Calculate variance for a player's rankings
   * @param {Array} rankings - Array of ranking positions
   * @returns {number} Variance value
   */
  calculateVariance(rankings) {
    if (rankings.length < 2) return 0;
    
    const mean = rankings.reduce((sum, rank) => sum + rank, 0) / rankings.length;
    const squaredDiffs = rankings.map(rank => Math.pow(rank - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / rankings.length;
  }

  /**
   * Calculate improvement trend for a player
   * @param {Array} rankings - Array of ranking positions in chronological order
   * @returns {number} Improvement score (positive = improving)
   */
  calculateImprovement(rankings) {
    if (rankings.length < 4) return 0;
    
    // Compare first half vs second half average rankings
    const mid = Math.floor(rankings.length / 2);
    const firstHalf = rankings.slice(0, mid);
    const secondHalf = rankings.slice(mid);
    
    const firstAvg = firstHalf.reduce((sum, rank) => sum + rank, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, rank) => sum + rank, 0) / secondHalf.length;
    
    // Lower rank number = better, so firstAvg - secondAvg = improvement
    return firstAvg - secondAvg;
  }

  /**
   * Count team wins where player finished in bottom half (support play)
   * @param {Object} player - Player object
   * @returns {number} Support score based on team wins with low personal ranking
   */
  countSupportWins(player) {
    if (!this.gameState.state.hist || this.gameState.state.hist.length === 0) {
      return 0;
    }
    
    let supportScore = 0;
    const mode = parseInt(document.getElementById('mode')?.value || 8);
    const bottomHalfThreshold = Math.ceil(mode / 2); // Bottom half threshold (e.g., 5+ for 8-player)
    
    this.gameState.state.hist.forEach(game => {
      if (game.playerRankings && game.winKey) {
        // Check if this player's team won
        const playerTeam = player.team;
        const gameWinnerTeam = game.winKey; // 't1' or 't2'
        const winnerTeamNumber = gameWinnerTeam === 't1' ? 1 : 2;
        
        if (playerTeam === winnerTeamNumber) {
          // Team won, check player's ranking
          for (const rank in game.playerRankings) {
            const rankedPlayer = game.playerRankings[rank];
            if (rankedPlayer.id === player.id) {
              const playerRank = parseInt(rank);
              
              // Score support play: higher score for worse ranking during team wins
              if (playerRank >= bottomHalfThreshold) {
                // Bottom half gets points, with more points for worse ranking
                const supportPoints = playerRank - bottomHalfThreshold + 1;
                supportScore += supportPoints;
              }
              break;
            }
          }
        }
      }
    });
    
    return supportScore;
  }

  /**
   * Calculate first place ratio for quality assessment
   * @param {Object} player - Player object  
   * @returns {number} First place ratio (0-1)
   */
  calculateFirstPlaceRatio(player) {
    const stats = this.gameState.playerStats[player.id];
    if (!stats || stats.games === 0) return 0;
    return (stats.firstPlaceCount || 0) / stats.games;
  }

  /**
   * Calculate excellence consistency score (stable + good performance)
   * @param {Object} player - Player object
   * @returns {number} Excellence consistency score (lower = better)
   */
  calculateExcellenceConsistency(player) {
    const stats = this.gameState.playerStats[player.id];
    if (!stats || !stats.rankings || stats.rankings.length < 3) return 999;
    
    const avgRank = stats.totalRank / stats.games;
    const variance = this.calculateVariance(stats.rankings);
    
    // 石佛需要：优秀的平均排名 + 低方差
    // 惩罚平均排名差的玩家，即使他们很稳定
    const excellencePenalty = Math.max(0, avgRank - 3) * 2; // 平均排名超过3名会有惩罚
    const gameWeight = Math.min(stats.games / 10, 1); // More games = more reliable
    
    return (variance + excellencePenalty) / gameWeight; // Lower score = excellent stability
  }

  /**
   * Find special honors across all players with improved algorithms
   * @returns {Object} Special honor winners with explanations
   */
  findSpecialHonors() {
    const honors = {
      lyubu: { player: null, score: 0, explanation: '' },
      adou: { player: null, score: 0, explanation: '' },
      shifo: { player: null, score: 0, explanation: '' },
      bodongwang: { player: null, score: 0, explanation: '' },
      fendouwang: { player: null, score: 0, explanation: '' },
      fuzhuwang: { player: null, score: 0, explanation: '' }
    };
    
    let bestFirstRatio = 0;
    let worstLastRatio = 0;
    let bestConsistency = 999;
    let worstConsistency = 0;
    let bestImprovement = -999;
    let bestSupport = 0;
    
    this.gameState.players.forEach((player) => {
      const stats = this.gameState.playerStats[player.id];
      if (stats && stats.games >= 3) { // 至少3局才参与评选
        
        // 吕布 - 改进：第一名比率 (质量 vs 数量)
        const firstRatio = this.calculateFirstPlaceRatio(player);
        if (firstRatio > bestFirstRatio && stats.games >= 5) { // 至少5局确保可靠性
          bestFirstRatio = firstRatio;
          honors.lyubu = {
            player: player,
            score: firstRatio,
            explanation: `${stats.games}场比赛中拿${stats.firstPlaceCount}次第一名，胜率${(firstRatio*100).toFixed(1)}%`
          };
        }
        
        // 阿斗 - 改进：垫底比率 + 连续垫底惩罚
        const lastRatio = (stats.lastPlaceCount || 0) / stats.games;
        const consecutivePenalty = this.calculateConsecutiveLastPenalty(stats.rankings);
        const adouScore = lastRatio + consecutivePenalty;
        if (adouScore > worstLastRatio) {
          worstLastRatio = adouScore;
          honors.adou = {
            player: player,
            score: adouScore,
            explanation: `${stats.games}场比赛垫底${stats.lastPlaceCount}次，垫底率${(lastRatio*100).toFixed(1)}%`
          };
        }
        
        // 石佛 - 改进：优秀的稳定性（好排名 + 低波动）
        const excellenceScore = this.calculateExcellenceConsistency(player);
        const avgRank = stats.totalRank / stats.games;
        
        // 只有平均排名前3名的玩家才能成为石佛
        if (excellenceScore < bestConsistency && avgRank <= 3.5) {
          bestConsistency = excellenceScore;
          honors.shifo = {
            player: player,
            score: excellenceScore,
            explanation: `${stats.games}场比赛优秀且稳定，平均${avgRank.toFixed(2)}名，始终保持前列`
          };
        }
        
        // 波动率的王 - 改进：方差 + 极值惩罚
        if (stats.rankings && stats.rankings.length >= 3) {
          const variance = this.calculateVariance(stats.rankings);
          const extremeBonus = this.calculateExtremeRankingBonus(stats.rankings);
          const volatilityScore = variance + extremeBonus;
          
          if (volatilityScore > worstConsistency) {
            worstConsistency = volatilityScore;
            honors.bodongwang = {
              player: player,
              score: volatilityScore,
              explanation: `排名变化极大，从第${Math.min(...stats.rankings)}名到第${Math.max(...stats.rankings)}名`
            };
          }
          
          // 奋斗之王 - 改进：多阶段进步检测
          const improvement = this.calculateProgressiveTrend(stats.rankings);
          if (improvement > bestImprovement && stats.games >= 5) {
            bestImprovement = improvement;
            honors.fendouwang = {
              player: player,
              score: improvement,
              explanation: `${stats.games}场比赛中排名显著提升，进步${improvement.toFixed(2)}名位`
            };
          }
        }
        
        // 辅助之王 - 已改进的算法
        const supportScore = this.countSupportWins(player);
        if (supportScore > bestSupport) {
          bestSupport = supportScore;
          honors.fuzhuwang = {
            player: player,
            score: supportScore,
            explanation: `团队胜利时经常排名靠后，辅助分数${supportScore}分`
          };
        }
      }
    });
    
    return honors;
  }

  /**
   * Calculate consecutive last place penalty
   * @param {Array} rankings - Player rankings
   * @returns {number} Penalty score for consecutive last places
   */
  calculateConsecutiveLastPenalty(rankings) {
    const mode = parseInt(document.getElementById('mode')?.value || 8);
    const lastPlace = mode;
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    
    rankings.forEach(rank => {
      if (rank === lastPlace) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    });
    
    return maxConsecutive * 0.1; // Penalty for consecutive last places
  }

  /**
   * Calculate bonus for extreme ranking variations
   * @param {Array} rankings - Player rankings
   * @returns {number} Bonus score for extreme variations
   */
  calculateExtremeRankingBonus(rankings) {
    const min = Math.min(...rankings);
    const max = Math.max(...rankings);
    const range = max - min;
    
    // Bonus for having both very high and very low rankings
    return range > 4 ? range * 0.5 : 0;
  }

  /**
   * Calculate progressive trend improvement
   * @param {Array} rankings - Player rankings
   * @returns {number} Progressive improvement score
   */
  calculateProgressiveTrend(rankings) {
    if (rankings.length < 6) return 0;
    
    // Compare multiple segments to detect sustained improvement
    const segmentSize = Math.floor(rankings.length / 3);
    const firstSegment = rankings.slice(0, segmentSize);
    const middleSegment = rankings.slice(segmentSize, segmentSize * 2);
    const lastSegment = rankings.slice(-segmentSize);
    
    const firstAvg = firstSegment.reduce((sum, rank) => sum + rank, 0) / firstSegment.length;
    const middleAvg = middleSegment.reduce((sum, rank) => sum + rank, 0) / middleSegment.length;
    const lastAvg = lastSegment.reduce((sum, rank) => sum + rank, 0) / lastSegment.length;
    
    // Progressive improvement: first > middle > last (lower numbers are better)
    const trend1 = firstAvg - middleAvg;
    const trend2 = middleAvg - lastAvg;
    
    return (trend1 + trend2) / 2; // Average improvement across segments
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
   * Get honor title in Chinese
   * @param {string} honorKey - Honor key
   * @returns {string} Chinese title
   */
  getHonorTitle(honorKey) {
    const titles = {
      lyubu: '🥇 吕布 (最强战力)',
      adou: '😅 阿斗 (最弱表现)',
      shifo: '🗿 石佛 (最稳定)',
      bodongwang: '🌊 波动率的王 (最不稳定)',
      fendouwang: '📈 奋斗之王 (最大进步)',
      fuzhuwang: '🛡️ 辅助之王 (团队奉献)'
    };
    return titles[honorKey] || honorKey;
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