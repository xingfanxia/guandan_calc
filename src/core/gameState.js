// Game state management module
// UTF-8 encoding for Chinese characters

import { load, save } from '../utils/storage.js';
import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_STATE } from '../utils/constants.js';

class GameState {
  constructor() {
    this.settings = null;
    this.state = null;
    this.winner = 't1';
    this.selected = [];
    this.currentRanking = {};
    this.players = [];
    this.playerStats = {};
    
    // Initialize state
    this.loadSettings();
    this.loadState();
    this.loadPlayers();
    this.loadPlayerStats();
  }

  /**
   * Load settings from localStorage or initialize with defaults
   */
  loadSettings() {
    this.settings = load(STORAGE_KEYS.SETTINGS, {});
    
    // Initialize missing settings with defaults
    if (!this.settings.c4) {
      this.settings.c4 = DEFAULT_SETTINGS.c4;
    }
    if (!this.settings.t6) {
      this.settings.t6 = DEFAULT_SETTINGS.t6;
    }
    if (!this.settings.p6) {
      this.settings.p6 = DEFAULT_SETTINGS.p6;
    }
    if (!this.settings.t8) {
      this.settings.t8 = DEFAULT_SETTINGS.t8;
    }
    if (!this.settings.p8) {
      this.settings.p8 = DEFAULT_SETTINGS.p8;
    }
    
    // Game preferences
    if (typeof this.settings.must1 === 'undefined') {
      this.settings.must1 = DEFAULT_SETTINGS.must1;
    }
    if (typeof this.settings.autoNext === 'undefined') {
      this.settings.autoNext = DEFAULT_SETTINGS.autoNext;
    }
    if (typeof this.settings.autoApply === 'undefined') {
      this.settings.autoApply = DEFAULT_SETTINGS.autoApply;
    }
    if (typeof this.settings.strictA === 'undefined') {
      this.settings.strictA = DEFAULT_SETTINGS.strictA;
    }
    
    // Team settings
    if (!this.settings.t1) {
      this.settings.t1 = DEFAULT_SETTINGS.t1;
    }
    if (!this.settings.t2) {
      this.settings.t2 = DEFAULT_SETTINGS.t2;
    }
    
    this.saveSettings();
  }

  /**
   * Load game state from localStorage or initialize with defaults
   */
  loadState() {
    this.state = load(STORAGE_KEYS.STATE, {});
    
    // Initialize missing state with defaults
    if (!this.state.t1) {
      this.state.t1 = {...DEFAULT_STATE.t1};
    }
    if (!this.state.t2) {
      this.state.t2 = {...DEFAULT_STATE.t2};
    }
    if (!this.state.hist) {
      this.state.hist = [];
    }
    if (!this.state.roundLevel) {
      this.state.roundLevel = DEFAULT_STATE.roundLevel;
    }
    if (!this.state.nextRoundBase) {
      this.state.nextRoundBase = DEFAULT_STATE.nextRoundBase;
    }
    if (!this.state.roundOwner) {
      this.state.roundOwner = DEFAULT_STATE.roundOwner;
    }
    
    this.saveState();
  }

  /**
   * Load players from localStorage
   */
  loadPlayers() {
    this.players = load(STORAGE_KEYS.PLAYERS, []);
  }

  /**
   * Load player statistics from localStorage
   */
  loadPlayerStats() {
    this.playerStats = load(STORAGE_KEYS.PLAYER_STATS, {});
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    save(STORAGE_KEYS.SETTINGS, this.settings);
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    save(STORAGE_KEYS.STATE, this.state);
  }

  /**
   * Save players to localStorage
   */
  savePlayers() {
    save(STORAGE_KEYS.PLAYERS, this.players);
  }

  /**
   * Save player statistics to localStorage
   */
  savePlayerStats() {
    save(STORAGE_KEYS.PLAYER_STATS, this.playerStats);
  }

  /**
   * Set the winner team
   * @param {string} winner - 't1' or 't2'
   */
  setWinner(winner) {
    this.winner = winner;
  }

  /**
   * Get current winner
   * @returns {string} Winner team ID
   */
  getWinner() {
    return this.winner;
  }

  /**
   * Get winner name
   * @returns {string} Winner team name
   */
  getWinnerName() {
    return this.winner === 't1' ? this.settings.t1.name : this.settings.t2.name;
  }

  /**
   * Get winner color
   * @returns {string} Winner team color
   */
  getWinnerColor() {
    return this.winner === 't1' ? this.settings.t1.color : this.settings.t2.color;
  }

  /**
   * Reset game state (preserve player names and team assignments)
   */
  resetAll() {
    // Reset only game progression data, preserve player setup
    this.state = {
      t1: {lvl: '2', aFail: 0},
      t2: {lvl: '2', aFail: 0},
      hist: [],
      roundLevel: '2',
      nextRoundBase: null,
      roundOwner: null
    };
    this.selected = [];
    this.playerStats = {}; // Clear statistics
    this.currentRanking = {}; // Clear current ranking
    
    // Save state and stats, but preserve players (names and teams)
    this.saveState();
    this.savePlayerStats();
    // Note: deliberately NOT calling this.players = [] or resetting player data
  }

  /**
   * Rollback to specific history index
   * @param {number} index - History index
   */
  rollbackTo(index) {
    if (index < 0 || index >= this.state.hist.length) return;
    
    const h = this.state.hist[index];
    this.state.t1.lvl = h.prevT1Lvl;
    this.state.t1.aFail = h.prevT1A || 0;
    this.state.t2.lvl = h.prevT2Lvl;
    this.state.t2.aFail = h.prevT2A || 0;
    this.state.roundLevel = h.prevRound || '2';
    
    // Restore round owner from previous history
    if (index > 0) {
      this.state.roundOwner = this.state.hist[index - 1].winKey;
    } else {
      this.state.roundOwner = null; // First round has no owner
    }
    
    this.state.nextRoundBase = null;
    this.state.hist = this.state.hist.slice(0, index);
    this.saveState();
  }
}

// Create singleton instance
export const gameState = new GameState();
export default gameState;