/**
 * Game Configuration Manager (Singleton Pattern)
 * Extracted from app.js lines 85-131
 * Manages game rules, settings, and team configurations
 */

import { load, save, KEYS } from './storage.js';
import { emit } from './events.js';

// Singleton instance
let instance = null;

class GameConfig {
  constructor() {
    // Enforce singleton
    if (instance) {
      return instance;
    }

    // Initialize with defaults
    this.config = {
      // 4-player mode rules
      c4: {
        '1,2': 3,  // Positions 1,2 = upgrade 3 levels
        '1,3': 2,  // Positions 1,3 = upgrade 2 levels
        '1,4': 1   // Positions 1,4 = upgrade 1 level
      },

      // 6-player mode thresholds and points
      t6: {
        g3: 7,  // Score difference ≥7 = upgrade 3 levels
        g2: 4,  // Score difference ≥4 = upgrade 2 levels
        g1: 1   // Score difference ≥1 = upgrade 1 level
      },
      p6: {
        1: 5, 2: 4, 3: 3, 4: 3, 5: 1, 6: 0
      },

      // 8-player mode thresholds and points
      t8: {
        g3: 11,  // Score difference ≥11 = upgrade 3 levels
        g2: 6,   // Score difference ≥6 = upgrade 2 levels
        g1: 1    // Score difference ≥1 = upgrade 1 level
      },
      p8: {
        1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0
      },

      // Game preferences
      must1: true,       // Require position 1 for upgrades
      autoNext: true,    // Auto-advance to next round
      autoApply: true,   // Auto-apply calculation results
      strictA: true,     // Strict A-level rules (must win at own A-level)

      // Team settings
      t1: {
        name: '蓝队',
        color: '#3b82f6'
      },
      t2: {
        name: '红队',
        color: '#ef4444'
      }
    };

    instance = this;
  }

  /**
   * Hydrate config from localStorage
   */
  hydrate() {
    const savedConfig = load(KEYS.CONFIG, null);

    if (savedConfig) {
      // Merge saved config with defaults (in case new settings added)
      this.config = {
        ...this.config,
        ...savedConfig,
        // Ensure nested objects are properly merged
        c4: { ...this.config.c4, ...(savedConfig.c4 || {}) },
        t6: { ...this.config.t6, ...(savedConfig.t6 || {}) },
        p6: { ...this.config.p6, ...(savedConfig.p6 || {}) },
        t8: { ...this.config.t8, ...(savedConfig.t8 || {}) },
        p8: { ...this.config.p8, ...(savedConfig.p8 || {}) },
        t1: { ...this.config.t1, ...(savedConfig.t1 || {}) },
        t2: { ...this.config.t2, ...(savedConfig.t2 || {}) }
      };
    }

    emit('config:hydrated');
  }

  /**
   * Persist config to localStorage
   */
  persist() {
    save(KEYS.CONFIG, this.config);
    emit('config:persisted');
  }

  // ===========================
  // Getters
  // ===========================

  /**
   * Get entire config object (returns copy)
   */
  getAll() {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Get 4-player rules
   */
  get4PlayerRules() {
    return { ...this.config.c4 };
  }

  /**
   * Get 6-player rules
   */
  get6PlayerRules() {
    return {
      thresholds: { ...this.config.t6 },
      points: { ...this.config.p6 }
    };
  }

  /**
   * Get 8-player rules
   */
  get8PlayerRules() {
    return {
      thresholds: { ...this.config.t8 },
      points: { ...this.config.p8 }
    };
  }

  /**
   * Get team configuration
   */
  getTeam(teamKey) {
    if (!['t1', 't2'].includes(teamKey)) {
      throw new Error(`Invalid team key: ${teamKey}`);
    }
    return { ...this.config[teamKey] };
  }

  /**
   * Get team name
   */
  getTeamName(teamKey) {
    return this.config[teamKey]?.name || '';
  }

  /**
   * Get team color
   */
  getTeamColor(teamKey) {
    return this.config[teamKey]?.color || '#666';
  }

  /**
   * Get game preferences
   */
  getPreferences() {
    return {
      must1: this.config.must1,
      autoNext: this.config.autoNext,
      autoApply: this.config.autoApply,
      strictA: this.config.strictA
    };
  }

  /**
   * Get specific preference
   */
  getPreference(key) {
    return this.config[key];
  }

  // ===========================
  // Setters
  // ===========================

  /**
   * Update 4-player rules
   */
  set4PlayerRules(rules) {
    this.config.c4 = { ...this.config.c4, ...rules };
    this.persist();
    emit('config:4PlayerRulesChanged', { rules: this.config.c4 });
  }

  /**
   * Update 6-player rules
   */
  set6PlayerRules({ thresholds, points }) {
    if (thresholds) {
      this.config.t6 = { ...this.config.t6, ...thresholds };
    }
    if (points) {
      this.config.p6 = { ...this.config.p6, ...points };
    }
    this.persist();
    emit('config:6PlayerRulesChanged', { thresholds: this.config.t6, points: this.config.p6 });
  }

  /**
   * Update 8-player rules
   */
  set8PlayerRules({ thresholds, points }) {
    if (thresholds) {
      this.config.t8 = { ...this.config.t8, ...thresholds };
    }
    if (points) {
      this.config.p8 = { ...this.config.p8, ...points };
    }
    this.persist();
    emit('config:8PlayerRulesChanged', { thresholds: this.config.t8, points: this.config.p8 });
  }

  /**
   * Update team configuration
   */
  setTeam(teamKey, { name, color }) {
    if (!['t1', 't2'].includes(teamKey)) {
      throw new Error(`Invalid team key: ${teamKey}`);
    }

    if (name !== undefined) {
      this.config[teamKey].name = name;
    }
    if (color !== undefined) {
      this.config[teamKey].color = color;
    }

    this.persist();
    emit('config:teamChanged', { team: teamKey, name, color });
  }

  /**
   * Update preference
   */
  setPreference(key, value) {
    if (!['must1', 'autoNext', 'autoApply', 'strictA'].includes(key)) {
      throw new Error(`Invalid preference key: ${key}`);
    }

    this.config[key] = value;
    this.persist();
    emit('config:preferenceChanged', { key, value });
  }

  /**
   * Update multiple preferences at once
   */
  setPreferences(preferences) {
    Object.keys(preferences).forEach(key => {
      if (['must1', 'autoNext', 'autoApply', 'strictA'].includes(key)) {
        this.config[key] = preferences[key];
      }
    });

    this.persist();
    emit('config:preferencesChanged', { preferences });
  }

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    this.config = {
      c4: { '1,2': 3, '1,3': 2, '1,4': 1 },
      t6: { g3: 7, g2: 4, g1: 1 },
      p6: { 1: 5, 2: 4, 3: 3, 4: 3, 5: 1, 6: 0 },
      t8: { g3: 11, g2: 6, g1: 1 },
      p8: { 1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0 },
      must1: true,
      autoNext: true,
      autoApply: true,
      strictA: true,
      t1: { name: '蓝队', color: '#3b82f6' },
      t2: { name: '红队', color: '#ef4444' }
    };

    this.persist();
    emit('config:reset');
  }
}

// Create and export singleton instance
const gameConfig = new GameConfig();
export default gameConfig;
