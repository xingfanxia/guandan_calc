/**
 * Game State Manager (Singleton Pattern)
 * Extracted from app.js lines 133-159
 * Single source of truth for all game state
 */

import { load, save, KEYS } from './storage.js';
import { emit } from './events.js';

// Singleton instance
let instance = null;

class GameState {
  constructor() {
    // Enforce singleton
    if (instance) {
      return instance;
    }

    // Initialize state
    this.teams = {
      t1: { lvl: '2', aFail: 0 },
      t2: { lvl: '2', aFail: 0 }
    };

    this.roundLevel = '2';
    this.roundOwner = null;
    this.nextRoundBase = null;
    this.history = [];
    this.winner = 't1';

    // Players state (managed separately but stored together)
    this.players = [];
    this.playerStats = {};
    this.currentRanking = {};
    
    // Session timing
    this.sessionStartTime = null;

    instance = this;
  }

  /**
   * Hydrate state from localStorage
   */
  hydrate() {
    const savedState = load(KEYS.STATE, null);

    if (savedState) {
      this.teams = savedState.teams || this.teams;
      this.roundLevel = savedState.roundLevel || '2';
      this.roundOwner = savedState.roundOwner || null;
      this.nextRoundBase = savedState.nextRoundBase || null;
      this.history = savedState.history || [];
      this.winner = savedState.winner || 't1';
    }

    // Load players separately
    this.players = load(KEYS.PLAYERS, []);
    this.playerStats = load(KEYS.STATS, {});

    emit('state:hydrated');
  }

  /**
   * Persist state to localStorage
   */
  persist() {
    const stateData = {
      teams: this.teams,
      roundLevel: this.roundLevel,
      roundOwner: this.roundOwner,
      nextRoundBase: this.nextRoundBase,
      history: this.history,
      winner: this.winner
    };

    save(KEYS.STATE, stateData);

    // Save players and stats separately
    save(KEYS.PLAYERS, this.players);
    save(KEYS.STATS, this.playerStats);

    emit('state:persisted');
  }

  // ===========================
  // Team Getters
  // ===========================

  getTeam(teamKey) {
    return this.teams[teamKey];
  }

  getTeamLevel(teamKey) {
    return this.teams[teamKey]?.lvl || '2';
  }

  getTeamAFail(teamKey) {
    return this.teams[teamKey]?.aFail || 0;
  }

  getWinner() {
    return this.winner;
  }

  // ===========================
  // Team Setters
  // ===========================

  setTeamLevel(teamKey, level) {
    if (!['t1', 't2'].includes(teamKey)) {
      throw new Error(`Invalid team key: ${teamKey}`);
    }

    this.teams[teamKey].lvl = level;
    this.persist();
    emit('state:teamLevelChanged', { team: teamKey, level });
  }

  setTeamAFail(teamKey, count) {
    if (!['t1', 't2'].includes(teamKey)) {
      throw new Error(`Invalid team key: ${teamKey}`);
    }

    this.teams[teamKey].aFail = count;
    this.persist();
    emit('state:teamAFailChanged', { team: teamKey, count });
  }

  setWinner(teamKey) {
    if (!['t1', 't2'].includes(teamKey)) {
      throw new Error(`Invalid team key: ${teamKey}`);
    }

    this.winner = teamKey;
    emit('state:winnerChanged', { winner: teamKey });
  }

  // ===========================
  // Round Management
  // ===========================

  getRoundLevel() {
    return this.roundLevel;
  }

  setRoundLevel(level) {
    this.roundLevel = level;
    this.persist();
    emit('state:roundLevelChanged', { level });
  }

  getRoundOwner() {
    return this.roundOwner;
  }

  setRoundOwner(teamKey) {
    this.roundOwner = teamKey;
    this.persist();
    emit('state:roundOwnerChanged', { owner: teamKey });
  }

  getNextRoundBase() {
    return this.nextRoundBase;
  }

  setNextRoundBase(level) {
    this.nextRoundBase = level;
    this.persist();
    emit('state:nextRoundBaseChanged', { level });
  }

  // ===========================
  // History Management
  // ===========================

  getHistory() {
    return [...this.history]; // Return copy
  }

  addHistoryEntry(entry) {
    this.history.push(entry);
    this.persist();
    emit('state:historyAdded', { entry });
  }

  rollbackToIndex(index) {
    if (index < 0 || index >= this.history.length) {
      throw new Error(`Invalid history index: ${index}`);
    }

    this.history = this.history.slice(0, index);
    this.persist();
    emit('state:historyRolledBack', { index });
  }

  clearHistory() {
    this.history = [];
    this.persist();
    emit('state:historyCleared');
  }

  /**
   * Set entire history array (for room sync)
   * @param {Array} historyArray - Complete history array
   */
  setHistory(historyArray) {
    this.history = historyArray || [];
    this.persist();
    emit('state:historySet', { historyArray });
  }

  // ===========================
  // Players Management
  // ===========================

  getPlayers() {
    return [...this.players]; // Return copy
  }

  setPlayers(players) {
    this.players = players;
    this.persist();
    emit('state:playersChanged', { players });
  }

  getPlayerStats() {
    return { ...this.playerStats }; // Return copy
  }

  setPlayerStats(stats) {
    this.playerStats = stats;
    this.persist();
    emit('state:playerStatsChanged', { stats });
  }

  getCurrentRanking() {
    return { ...this.currentRanking }; // Return copy
  }

  setCurrentRanking(ranking) {
    this.currentRanking = ranking;
    // Note: Don't persist ranking (temporary state)
    emit('state:currentRankingChanged', { ranking });
  }

  // ===========================
  // Session Timing
  // ===========================

  getSessionStartTime() {
    return this.sessionStartTime;
  }

  setSessionStartTime(timestamp) {
    this.sessionStartTime = timestamp;
    // Don't persist - session timing is per-session only
  }

  getSessionDuration() {
    if (!this.sessionStartTime) return 0;
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);  // seconds
  }

  // ===========================
  // Reset Functions
  // ===========================

  resetGame() {
    this.teams = {
      t1: { lvl: '2', aFail: 0 },
      t2: { lvl: '2', aFail: 0 }
    };
    this.roundLevel = '2';
    this.roundOwner = null;
    this.nextRoundBase = null;
    this.history = [];
    this.winner = 't1';
    this.currentRanking = {};

    this.persist();
    emit('state:gameReset');
  }

  resetAll() {
    this.resetGame();
    this.players = [];
    this.playerStats = {};

    this.persist();
    emit('state:allReset');
  }
}

// Create and export singleton instance
const gameState = new GameState();
export default gameState;
