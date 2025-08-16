/**
 * Game State Management
 * Central state store for all game data
 */

import { CONFIG, DEFAULT_PLAYERS, LEVEL_RULES, VALIDATION } from './config.js';

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    // Players
    this.players = [];
    this.playerIdCounter = 1;
    
    // Teams
    this.teams = {
      t1: { ...CONFIG.TEAMS.t1 },
      t2: { ...CONFIG.TEAMS.t2 }
    };
    
    // Game state
    this.mode = CONFIG.MODES.EIGHT;
    this.currentRanking = {}; // { rank: playerId }
    this.currentRoundLevel = CONFIG.TEAMS.t1.defaultLevel; // Level for current round
    this.winner = null; // 't1' or 't2' for current round
    
    // Settings
    this.settings = { ...CONFIG.SETTINGS };
    
    // Statistics
    this.playerStats = {}; // { playerId: stats }
    this.gameHistory = [];
    this.roundNumber = 0;
    
    // A-level tracking
    this.aLevelState = {
      t1: { inA: false, failures: 0, wonA: false },
      t2: { inA: false, failures: 0, wonA: false }
    };
    
    // Custom scoring rules
    this.customScoring = {
      c4: { ...CONFIG.SCORING_4P },
      t6: { ...CONFIG.SCORING_6P.thresholds },
      p6: { ...CONFIG.SCORING_6P.points },
      t8: { ...CONFIG.SCORING_8P.thresholds },
      p8: { ...CONFIG.SCORING_8P.points }
    };
  }

  // ============= Player Management =============

  generatePlayers(mode = this.mode) {
    this.players = [];
    this.playerIdCounter = 1;
    const names = DEFAULT_PLAYERS[mode];
    
    for (let i = 0; i < mode; i++) {
      this.addPlayer(names[i]);
    }
    
    this.assignTeamsEvenly();
    return this.players;
  }

  addPlayer(name, emoji = null) {
    if (this.players.length >= CONFIG.UI.MAX_PLAYERS) {
      throw new Error(`最多支持${CONFIG.UI.MAX_PLAYERS}个玩家`);
    }
    
    const player = {
      id: this.playerIdCounter++,
      name: name || `玩家${this.playerIdCounter}`,
      emoji: emoji || this.getRandomEmoji(),
      team: null
    };
    
    this.players.push(player);
    return player;
  }

  removePlayer(playerId) {
    if (this.players.length <= CONFIG.UI.MIN_PLAYERS) {
      throw new Error(`至少需要${CONFIG.UI.MIN_PLAYERS}个玩家`);
    }
    
    this.players = this.players.filter(p => p.id !== playerId);
    delete this.currentRanking[this.getRankByPlayerId(playerId)];
    delete this.playerStats[playerId];
  }

  updatePlayerName(playerId, name) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.name = name;
    }
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  getRandomEmoji() {
    const available = CONFIG.EMOJIS.filter(emoji => 
      !this.players.some(p => p.emoji === emoji)
    );
    return available[Math.floor(Math.random() * available.length)] || '🎮';
  }

  // ============= Team Management =============

  assignPlayerToTeam(playerId, teamNumber) {
    const player = this.getPlayer(playerId);
    if (player && VALIDATION.isValidTeam(teamNumber)) {
      player.team = teamNumber;
    }
  }

  removePlayerFromTeam(playerId) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.team = null;
    }
  }

  assignTeamsEvenly() {
    // Shuffle players first
    const shuffled = [...this.players].sort(() => Math.random() - 0.5);
    
    // Assign alternating teams
    shuffled.forEach((player, index) => {
      player.team = (index % 2) + 1;
    });
  }

  shuffleTeams() {
    this.assignTeamsEvenly();
  }

  getTeamPlayers(teamNumber) {
    return this.players.filter(p => p.team === teamNumber);
  }

  setTeamName(teamId, name) {
    if (this.teams[teamId]) {
      this.teams[teamId].name = name;
    }
  }

  setTeamColor(teamId, color) {
    if (this.teams[teamId]) {
      this.teams[teamId].color = color;
    }
  }

  // ============= Ranking Management =============

  setPlayerRank(playerId, rank) {
    if (!VALIDATION.isValidRank(rank, this.mode)) {
      throw new Error('无效的排名');
    }
    
    // Remove player from any existing rank
    this.removePlayerFromRanking(playerId);
    
    // Set new rank
    this.currentRanking[rank] = playerId;
  }

  removePlayerFromRanking(playerId) {
    for (const rank in this.currentRanking) {
      if (this.currentRanking[rank] === playerId) {
        delete this.currentRanking[rank];
        break;
      }
    }
  }

  getRankByPlayerId(playerId) {
    for (const rank in this.currentRanking) {
      if (this.currentRanking[rank] === playerId) {
        return parseInt(rank);
      }
    }
    return null;
  }

  clearRanking() {
    this.currentRanking = {};
  }

  isRankingComplete() {
    // Check if all positions are filled
    for (let i = 1; i <= this.mode; i++) {
      if (!this.currentRanking[i]) {
        return false;
      }
    }
    return true;
  }

  generateRandomRanking() {
    this.clearRanking();
    const playerIds = this.players.map(p => p.id);
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    
    shuffled.forEach((playerId, index) => {
      this.currentRanking[index + 1] = playerId;
    });
  }

  getRankingArray() {
    const ranking = [];
    for (let i = 1; i <= this.mode; i++) {
      const playerId = this.currentRanking[i];
      if (playerId) {
        const player = this.getPlayer(playerId);
        if (player) {
          ranking.push({
            rank: i,
            player: player
          });
        }
      }
    }
    return ranking;
  }

  // ============= Level Management =============

  getCurrentRoundLevel() {
    // Determine which team's level to use for current round
    if (this.teams.t1.level === this.teams.t2.level) {
      return this.teams.t1.level;
    }
    // Use the lower level (team that's behind)
    return Math.min(this.teams.t1.level, this.teams.t2.level);
  }

  updateTeamLevel(teamId, newLevel) {
    if (!this.teams[teamId]) return;
    
    const oldLevel = this.teams[teamId].level;
    this.teams[teamId].level = Math.min(newLevel, LEVEL_RULES.MAX_LEVEL);
    
    // Check for A-level state changes
    this.updateALevelState(teamId, oldLevel, newLevel);
  }

  updateALevelState(teamId, oldLevel, newLevel) {
    const aState = this.aLevelState[teamId];
    
    // Entering A-level
    if (LEVEL_RULES.isALevel(newLevel) && !LEVEL_RULES.isALevel(oldLevel)) {
      aState.inA = true;
      aState.wonA = false;
    }
    
    // Leaving A-level successfully
    if (!LEVEL_RULES.isALevel(newLevel) && LEVEL_RULES.isALevel(oldLevel)) {
      aState.inA = false;
      if (newLevel > oldLevel) {
        aState.wonA = true;
        aState.failures = 0;
      }
    }
  }

  handleALevelFailure(losingTeamId) {
    const aState = this.aLevelState[losingTeamId];
    const team = this.teams[losingTeamId];
    
    if (LEVEL_RULES.isALevel(team.level)) {
      aState.failures++;
      
      // Check for A3 penalty
      if (aState.failures >= CONFIG.SETTINGS.maxAFails) {
        // Reset to level 2
        this.updateTeamLevel(losingTeamId, LEVEL_RULES.RESET_LEVEL);
        aState.failures = 0;
        aState.inA = true;
        return true; // Indicates A3 penalty applied
      }
    }
    return false;
  }

  // ============= Winner Management =============

  setWinner(teamId) {
    this.winner = teamId;
  }

  determineWinnerFromRanking() {
    // Winner is determined by which team has rank 1
    const firstPlacePlayerId = this.currentRanking[1];
    if (!firstPlacePlayerId) return null;
    
    const firstPlacePlayer = this.getPlayer(firstPlacePlayerId);
    if (!firstPlacePlayer) return null;
    
    return firstPlacePlayer.team === 1 ? 't1' : 't2';
  }

  // ============= Settings Management =============

  updateSetting(key, value) {
    if (this.settings.hasOwnProperty(key)) {
      this.settings[key] = value;
    }
  }

  toggleSetting(key) {
    if (this.settings.hasOwnProperty(key)) {
      this.settings[key] = !this.settings[key];
      return this.settings[key];
    }
    return null;
  }

  // ============= Custom Scoring =============

  updateCustomScoring(category, key, value) {
    if (this.customScoring[category]) {
      this.customScoring[category][key] = value;
    }
  }

  getCustomScoring() {
    return this.customScoring;
  }

  // ============= State Export/Import =============

  exportState() {
    return {
      players: this.players,
      teams: this.teams,
      mode: this.mode,
      currentRanking: this.currentRanking,
      currentRoundLevel: this.currentRoundLevel,
      winner: this.winner,
      settings: this.settings,
      playerStats: this.playerStats,
      gameHistory: this.gameHistory,
      roundNumber: this.roundNumber,
      aLevelState: this.aLevelState,
      customScoring: this.customScoring
    };
  }

  importState(state) {
    if (state.players) this.players = state.players;
    if (state.teams) this.teams = state.teams;
    if (state.mode) this.mode = state.mode;
    if (state.currentRanking) this.currentRanking = state.currentRanking;
    if (state.currentRoundLevel) this.currentRoundLevel = state.currentRoundLevel;
    if (state.winner) this.winner = state.winner;
    if (state.settings) this.settings = { ...this.settings, ...state.settings };
    if (state.playerStats) this.playerStats = state.playerStats;
    if (state.gameHistory) this.gameHistory = state.gameHistory;
    if (state.roundNumber) this.roundNumber = state.roundNumber;
    if (state.aLevelState) this.aLevelState = state.aLevelState;
    if (state.customScoring) this.customScoring = state.customScoring;
    
    // Update player ID counter
    if (this.players.length > 0) {
      const maxId = Math.max(...this.players.map(p => p.id));
      this.playerIdCounter = maxId + 1;
    }
  }

  // ============= Validation =============

  validateState() {
    const errors = [];
    
    // Check mode
    if (!VALIDATION.isValidMode(this.mode)) {
      errors.push('无效的游戏模式');
    }
    
    // Check player count
    if (this.players.length !== this.mode) {
      errors.push('玩家数量与游戏模式不匹配');
    }
    
    // Check teams
    const team1Count = this.getTeamPlayers(1).length;
    const team2Count = this.getTeamPlayers(2).length;
    if (team1Count !== team2Count) {
      errors.push('两队人数不相等');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default GameState;