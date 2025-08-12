/**
 * Game State Management Module
 * Handles all game state including players, teams, rankings, and round levels
 */

export class GameState {
  constructor() {
    this.players = [];
    this.currentRanking = {};
    this.roundLevel = 2; // Default to 'A' (2)
    this.winner = null;
    this.playerIdCounter = 1;
    this.mode = 8; // Default to 8 players
    this.autoApply = false;
    this.playerStats = {};
  }

  /**
   * Initialize with default players
   */
  initDefault() {
    this.players = [];
    for (let i = 1; i <= 8; i++) {
      this.addPlayer(`玩家${i}`);
    }
    this.assignTeams();
  }

  /**
   * Add a new player
   */
  addPlayer(name, id = null) {
    const playerId = id || this.playerIdCounter++;
    const player = {
      id: playerId,
      name: name,
      team: null,
      emoji: this.getRandomEmoji()
    };
    this.players.push(player);
    return player;
  }

  /**
   * Remove a player
   */
  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    // Remove from ranking if present
    for (const rank in this.currentRanking) {
      if (this.currentRanking[rank] === playerId) {
        delete this.currentRanking[rank];
      }
    }
  }

  /**
   * Update player name
   */
  updatePlayerName(playerId, newName) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.name = newName;
    }
  }

  /**
   * Assign teams automatically
   */
  assignTeams() {
    // Assign teams: odd indices to team 1, even to team 2
    this.players.forEach((player, index) => {
      player.team = (index % 2 === 0) ? 1 : 2;
    });
  }

  /**
   * Set player team
   */
  setPlayerTeam(playerId, team) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.team = team;
    }
  }

  /**
   * Set player rank
   */
  setPlayerRank(playerId, rank) {
    // Remove player from any existing rank
    for (const r in this.currentRanking) {
      if (this.currentRanking[r] === playerId) {
        delete this.currentRanking[r];
      }
    }
    // Set new rank
    this.currentRanking[rank] = playerId;
  }

  /**
   * Remove player from ranking
   */
  removePlayerRank(playerId) {
    for (const rank in this.currentRanking) {
      if (this.currentRanking[rank] === playerId) {
        delete this.currentRanking[rank];
      }
    }
  }

  /**
   * Get player by ID
   */
  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  /**
   * Get players by team
   */
  getTeamPlayers(team) {
    return this.players.filter(p => p.team === team);
  }

  /**
   * Check if all players are ranked
   */
  isRankingComplete() {
    for (let i = 1; i <= this.mode; i++) {
      if (!this.currentRanking[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get ranking as array of player IDs in order
   */
  getRankingArray() {
    const ranking = [];
    for (let i = 1; i <= this.mode; i++) {
      if (this.currentRanking[i]) {
        ranking.push(this.currentRanking[i]);
      }
    }
    return ranking;
  }

  /**
   * Set round level
   */
  setRoundLevel(level) {
    this.roundLevel = level;
  }

  /**
   * Set winner
   */
  setWinner(winner) {
    this.winner = winner; // 't1' or 't2'
  }

  /**
   * Set game mode (number of players)
   */
  setMode(mode) {
    this.mode = mode;
    // Clear rankings if mode changes
    this.currentRanking = {};
  }

  /**
   * Toggle auto-apply
   */
  toggleAutoApply() {
    this.autoApply = !this.autoApply;
    return this.autoApply;
  }

  /**
   * Update player stats after a round
   */
  updatePlayerStats(playerId, rank) {
    if (!this.playerStats[playerId]) {
      this.playerStats[playerId] = {
        games: 0,
        totalRank: 0,
        firstPlaceCount: 0,
        lastPlaceCount: 0,
        rankings: []
      };
    }
    
    const stats = this.playerStats[playerId];
    stats.games++;
    stats.totalRank += rank;
    stats.rankings.push(rank);
    
    if (rank === 1) {
      stats.firstPlaceCount++;
    }
    if (rank === this.mode) {
      stats.lastPlaceCount++;
    }
  }

  /**
   * Reset game state
   */
  reset() {
    this.players = [];
    this.currentRanking = {};
    this.roundLevel = 2;
    this.winner = null;
    this.playerIdCounter = 1;
  }

  /**
   * Get random emoji for player
   */
  getRandomEmoji() {
    const emojis = ['🐺', '🦊', '🐳', '🐟', '🐠', '🦇', '🦆', '🦀', '🦅', '🦉', '🦩', '🦜'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  /**
   * Export state for persistence
   */
  export() {
    return {
      players: this.players,
      currentRanking: this.currentRanking,
      roundLevel: this.roundLevel,
      winner: this.winner,
      mode: this.mode,
      autoApply: this.autoApply,
      playerStats: this.playerStats
    };
  }

  /**
   * Import state from persistence
   */
  import(state) {
    if (state.players) this.players = state.players;
    if (state.currentRanking) this.currentRanking = state.currentRanking;
    if (state.roundLevel) this.roundLevel = state.roundLevel;
    if (state.winner) this.winner = state.winner;
    if (state.mode) this.mode = state.mode;
    if (state.autoApply !== undefined) this.autoApply = state.autoApply;
    if (state.playerStats) this.playerStats = state.playerStats;
    
    // Update playerIdCounter
    if (this.players.length > 0) {
      const maxId = Math.max(...this.players.map(p => p.id));
      this.playerIdCounter = maxId + 1;
    }
  }
}