/**
 * Player management module for handling player creation, teams, and statistics
 */

import { loadPlayers, savePlayers, loadPlayerStats, savePlayerStats } from './storage.js';

// Animal emoji pool for player avatars
const ANIMAL_EMOJIS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆',
  '🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋',
  '🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎',
  '🦖','🦕','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬',
  '🐳','🐋','🦈'
];

/**
 * Player class
 */
export class Player {
  constructor(id, name, emoji, team = null) {
    this.id = id;
    this.name = name;
    this.emoji = emoji;
    this.team = team; // 1 or 2, null if unassigned
  }
}

/**
 * Player Manager class
 */
export class PlayerManager {
  constructor() {
    this.players = [];
    this.playerStats = {};
    this.currentRanking = {};
  }
  
  /**
   * Initialize player manager with saved data
   */
  init() {
    this.loadPlayers();
    this.loadStats();
  }
  
  /**
   * Generate new players or load existing ones
   * @param {number} count - Number of players to generate
   * @param {boolean} forceNew - Force generation of new players
   * @returns {Player[]} Array of players
   */
  generatePlayers(count, forceNew = false) {
    // Load saved players if not forcing new generation
    if (!forceNew) {
      const saved = loadPlayers();
      if (saved && saved.length === count) {
        // Ensure saved players have proper structure
        this.players = saved.map((p, i) => {
          // Fix team values - convert string 'A'/'B' to numeric 1/2
          let team = p.team;
          if (team === 'A' || team === 'a') team = 1;
          if (team === 'B' || team === 'b') team = 2;
          if (team && typeof team === 'string') {
            team = parseInt(team, 10);
          }
          
          return new Player(
            p.id || `p${i + 1}`,
            p.name || `玩家${i + 1}`,
            p.emoji || ANIMAL_EMOJIS[i % ANIMAL_EMOJIS.length],
            team
          );
        });
        return this.players;
      }
    }
    
    // Generate new players
    this.players = [];
    const shuffledEmojis = this.shuffleArray([...ANIMAL_EMOJIS]);
    
    for (let i = 0; i < count; i++) {
      const player = new Player(
        `p${i + 1}`,
        `玩家${i + 1}`,
        shuffledEmojis[i % shuffledEmojis.length],
        null
      );
      this.players.push(player);
    }
    
    this.savePlayers();
    return this.players;
  }
  
  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  
  /**
   * Randomly assign players to teams
   */
  shuffleTeams() {
    // Shuffle players
    const shuffled = this.shuffleArray(this.players);
    const halfCount = Math.floor(shuffled.length / 2);
    
    // Assign to teams
    shuffled.forEach((player, i) => {
      player.team = i < halfCount ? 1 : 2;
    });
    
    this.savePlayers();
  }
  
  /**
   * Get players by team
   * @param {number} team - Team number (1 or 2)
   * @returns {Player[]} Players in the team
   */
  getTeamPlayers(team) {
    return this.players.filter(p => p.team === team);
  }
  
  /**
   * Get unassigned players
   * @returns {Player[]} Players without a team
   */
  getUnassignedPlayers() {
    return this.players.filter(p => !p.team);
  }
  
  /**
   * Assign player to team
   * @param {string} playerId - Player ID
   * @param {number} team - Team number (1 or 2)
   * @returns {boolean} Success status
   */
  assignToTeam(playerId, team) {
    const player = this.getPlayerById(playerId);
    if (!player) return false;
    
    // Check if team is full
    const teamSize = Math.floor(this.players.length / 2);
    const currentTeamPlayers = this.getTeamPlayers(team);
    
    // Don't count the player if they're already on this team
    const effectiveCount = player.team === team 
      ? currentTeamPlayers.length 
      : currentTeamPlayers.length + 1;
    
    if (effectiveCount > teamSize) {
      return false;
    }
    
    player.team = team;
    this.savePlayers();
    return true;
  }
  
  /**
   * Remove player from team
   * @param {string} playerId - Player ID
   */
  removeFromTeam(playerId) {
    const player = this.getPlayerById(playerId);
    if (player) {
      player.team = null;
      this.savePlayers();
    }
  }
  
  /**
   * Get player by ID
   * @param {string} id - Player ID
   * @returns {Player|null} Player object or null
   */
  getPlayerById(id) {
    return this.players.find(p => p.id === id) || null;
  }
  
  /**
   * Update player name
   * @param {string} playerId - Player ID
   * @param {string} name - New name
   */
  updatePlayerName(playerId, name) {
    const player = this.getPlayerById(playerId);
    if (player) {
      player.name = name;
      this.savePlayers();
    }
  }
  
  /**
   * Set current ranking
   * @param {Object} ranking - Ranking object with rank as key and playerId as value
   */
  setRanking(ranking) {
    this.currentRanking = { ...ranking };
  }
  
  /**
   * Clear current ranking
   */
  clearRanking() {
    this.currentRanking = {};
  }
  
  /**
   * Get player at rank
   * @param {number} rank - Rank position
   * @returns {Player|null} Player at rank or null
   */
  getPlayerAtRank(rank) {
    const playerId = this.currentRanking[rank];
    return playerId ? this.getPlayerById(playerId) : null;
  }
  
  /**
   * Set player rank
   * @param {string} playerId - Player ID
   * @param {number} rank - Rank position
   */
  setPlayerRank(playerId, rank) {
    // Remove player from any existing rank
    Object.keys(this.currentRanking).forEach(r => {
      if (this.currentRanking[r] === playerId) {
        delete this.currentRanking[r];
      }
    });
    
    // Set new rank
    if (rank) {
      this.currentRanking[rank] = playerId;
    }
  }
  
  /**
   * Remove player from ranking
   * @param {string} playerId - Player ID
   */
  removeFromRanking(playerId) {
    Object.keys(this.currentRanking).forEach(rank => {
      if (this.currentRanking[rank] === playerId) {
        delete this.currentRanking[rank];
      }
    });
  }
  
  /**
   * Check if all players are assigned to teams
   * @returns {boolean} True if all players have teams
   */
  allPlayersAssigned() {
    return this.players.every(p => p.team !== null);
  }
  
  /**
   * Check if all players are ranked
   * @returns {boolean} True if all players are ranked
   */
  allPlayersRanked() {
    return Object.keys(this.currentRanking).length === this.players.length;
  }
  
  /**
   * Update player statistics
   * @param {Object} roundData - Round data with player rankings
   */
  updateStats(roundData) {
    if (!roundData.playerRanking) return;
    
    Object.entries(roundData.playerRanking).forEach(([rank, playerId]) => {
      if (!this.playerStats[playerId]) {
        this.playerStats[playerId] = {
          games: 0,
          totalRank: 0,
          firstPlace: 0,
          lastPlace: 0,
          ranks: []
        };
      }
      
      const stats = this.playerStats[playerId];
      const rankNum = parseInt(rank, 10);
      
      stats.games++;
      stats.totalRank += rankNum;
      stats.ranks.push(rankNum);
      
      if (rankNum === 1) {
        stats.firstPlace++;
      }
      if (rankNum === this.players.length) {
        stats.lastPlace++;
      }
    });
    
    this.saveStats();
  }
  
  /**
   * Get player statistics
   * @param {string} playerId - Player ID
   * @returns {Object} Player statistics
   */
  getPlayerStats(playerId) {
    return this.playerStats[playerId] || {
      games: 0,
      totalRank: 0,
      firstPlace: 0,
      lastPlace: 0,
      ranks: []
    };
  }
  
  /**
   * Get team MVP (best average rank)
   * @param {number} team - Team number
   * @returns {Player|null} MVP player or null
   */
  getTeamMVP(team) {
    const teamPlayers = this.getTeamPlayers(team);
    let mvp = null;
    let bestAvg = Infinity;
    
    teamPlayers.forEach(player => {
      const stats = this.getPlayerStats(player.id);
      if (stats.games > 0) {
        const avg = stats.totalRank / stats.games;
        if (avg < bestAvg) {
          bestAvg = avg;
          mvp = player;
        }
      }
    });
    
    return mvp;
  }
  
  /**
   * Get team burden (worst average rank)
   * @param {number} team - Team number
   * @returns {Player|null} Burden player or null
   */
  getTeamBurden(team) {
    const teamPlayers = this.getTeamPlayers(team);
    let burden = null;
    let worstAvg = -Infinity;
    
    teamPlayers.forEach(player => {
      const stats = this.getPlayerStats(player.id);
      if (stats.games > 0) {
        const avg = stats.totalRank / stats.games;
        if (avg > worstAvg) {
          worstAvg = avg;
          burden = player;
        }
      }
    });
    
    return burden;
  }
  
  /**
   * Save players to storage
   */
  savePlayers() {
    savePlayers(this.players);
  }
  
  /**
   * Load players from storage
   */
  loadPlayers() {
    const saved = loadPlayers();
    if (saved && saved.length > 0) {
      this.players = saved.map(p => new Player(p.id, p.name, p.emoji, p.team));
    }
  }
  
  /**
   * Save statistics to storage
   */
  saveStats() {
    savePlayerStats(this.playerStats);
  }
  
  /**
   * Load statistics from storage
   */
  loadStats() {
    this.playerStats = loadPlayerStats();
  }
  
  /**
   * Reset all statistics
   */
  resetStats() {
    this.playerStats = {};
    this.saveStats();
  }
}