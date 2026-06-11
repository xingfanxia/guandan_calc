/**
 * Game Configuration Manager (Singleton Pattern)
 * Extracted from app.js lines 85-131
 * Manages game rules, settings, and team configurations
 */

import { load, save, KEYS } from './storage.js';
import { emit } from './events.js';
import { DEFAULT_RULES, sanitizeRulesConfig } from '../../shared/ruleConfig.js';

// Singleton instance
let instance = null;
const DEFAULT_TEAM_COLORS = {
  t1: '#3b82f6',
  t2: '#ef4444'
};
const DEFAULT_TEAM_NAMES = {
  t1: '蓝队',
  t2: '红队'
};
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PREFERENCE_KEYS = ['must1', 'autoNext', 'autoApply', 'strictA'];

function createDefaultConfig() {
  const rules = sanitizeRulesConfig();

  return {
    c4: rules.c4,
    t6: rules.t6,
    p6: rules.p6,
    t8: rules.t8,
    p8: rules.p8,
    must1: true,
    autoNext: true,
    autoApply: true,
    strictA: true,
    t1: { name: DEFAULT_TEAM_NAMES.t1, color: DEFAULT_TEAM_COLORS.t1 },
    t2: { name: DEFAULT_TEAM_NAMES.t2, color: DEFAULT_TEAM_COLORS.t2 }
  };
}

function fallbackTeamName(teamKey) {
  return DEFAULT_TEAM_NAMES[teamKey] || '';
}

function fallbackTeamColor(teamKey) {
  return DEFAULT_TEAM_COLORS[teamKey] || '#666';
}

function normalizeTeamName(name, fallback = null) {
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeTeamColor(color, fallback = null) {
  const value = String(color || '').trim().toLowerCase();
  if (!HEX_COLOR_RE.test(value)) return fallback;
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return value;
}

function parseIntegerOrDefault(value, fallback) {
  const parsed = typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizePreference(value, fallback = null) {
  return typeof value === 'boolean' ? value : fallback;
}

class GameConfig {
  constructor() {
    // Enforce singleton
    if (instance) {
      return instance;
    }

    // Initialize with defaults
    this.config = createDefaultConfig();

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
      this.sanitizeRules();
      this.sanitizeTeamConfig();
      this.sanitizePreferences();
    }

    emit('config:hydrated');
  }

  /**
   * Keep team names/colors constrained before UI templates consume them.
   */
  sanitizeTeamConfig() {
    ['t1', 't2'].forEach(teamKey => {
      this.config[teamKey].name = normalizeTeamName(this.config[teamKey]?.name, fallbackTeamName(teamKey));
      this.config[teamKey].color = normalizeTeamColor(this.config[teamKey]?.color, fallbackTeamColor(teamKey));
    });
  }

  /**
   * Keep preference fields boolean so rule branches cannot be flipped by
   * string values from localStorage, shared URLs, or room snapshots.
   */
  sanitizePreferences() {
    const defaults = createDefaultConfig();
    PREFERENCE_KEYS.forEach(key => {
      this.config[key] = normalizePreference(this.config[key], defaults[key]);
    });
  }

  /**
   * Keep custom rule tables numeric and complete. Bad persisted values fall
   * back per-cell instead of poisoning the whole table.
   */
  sanitizeRules() {
    const rules = sanitizeRulesConfig(this.config);
    this.config.c4 = rules.c4;
    this.config.t6 = rules.t6;
    this.config.p6 = rules.p6;
    this.config.t8 = rules.t8;
    this.config.p8 = rules.p8;
  }

  /**
   * Persist config to localStorage
   */
  persist() {
    this.sanitizeRules();
    this.sanitizeTeamConfig();
    this.sanitizePreferences();
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
    this.sanitizeRules();
    this.sanitizeTeamConfig();
    this.sanitizePreferences();
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Get 4-player rules
   */
  get4PlayerRules() {
    this.sanitizeRules();
    return { ...this.config.c4 };
  }

  /**
   * Get 6-player rules
   */
  get6PlayerRules() {
    this.sanitizeRules();
    return {
      thresholds: { ...this.config.t6 },
      points: { ...this.config.p6 }
    };
  }

  /**
   * Get 8-player rules
   */
  get8PlayerRules() {
    this.sanitizeRules();
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
    this.sanitizeTeamConfig();
    return { ...this.config[teamKey] };
  }

  /**
   * Get team name
   */
  getTeamName(teamKey) {
    return normalizeTeamName(this.config[teamKey]?.name, fallbackTeamName(teamKey));
  }

  /**
   * Get team color
   */
  getTeamColor(teamKey) {
    return normalizeTeamColor(this.config[teamKey]?.color, fallbackTeamColor(teamKey));
  }

  /**
   * Get game preferences
   */
  getPreferences() {
    this.sanitizePreferences();
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
    if (PREFERENCE_KEYS.includes(key)) {
      this.sanitizePreferences();
    }
    return this.config[key];
  }

  // ===========================
  // Setters
  // ===========================

  /**
   * Update 4-player rules
   */
  set4PlayerRules(rules) {
    this.config.c4 = sanitizeRulesConfig({
      c4: { ...this.config.c4, ...(rules || {}) }
    }).c4;
    this.persist();
    emit('config:4PlayerRulesChanged', { rules: this.config.c4 });
  }

  /**
   * Update 6-player rules
   */
  set6PlayerRules({ thresholds, points }) {
    const sanitized = sanitizeRulesConfig({
      t6: { ...this.config.t6, ...(thresholds || {}) },
      p6: { ...this.config.p6, ...(points || {}) }
    });

    this.config.t6 = sanitized.t6;
    this.config.p6 = sanitized.p6;
    this.persist();
    emit('config:6PlayerRulesChanged', { thresholds: this.config.t6, points: this.config.p6 });
  }

  /**
   * Update 8-player rules
   */
  set8PlayerRules({ thresholds, points }) {
    const sanitized = sanitizeRulesConfig({
      t8: { ...this.config.t8, ...(thresholds || {}) },
      p8: { ...this.config.p8, ...(points || {}) }
    });

    this.config.t8 = sanitized.t8;
    this.config.p8 = sanitized.p8;
    this.persist();
    emit('config:8PlayerRulesChanged', { thresholds: this.config.t8, points: this.config.p8 });
  }

  /**
   * Update team configuration
   */
  setTeam(teamKey, teamConfig = {}) {
    if (!['t1', 't2'].includes(teamKey)) {
      throw new Error(`Invalid team key: ${teamKey}`);
    }

    const input = teamConfig && typeof teamConfig === 'object' ? teamConfig : {};
    const { name, color } = input;

    let safeName = null;
    if (name !== undefined) {
      safeName = normalizeTeamName(name);
      if (safeName) {
        this.config[teamKey].name = safeName;
      }
    }
    let safeColor = null;
    if (color !== undefined) {
      safeColor = normalizeTeamColor(color);
      if (safeColor) {
        this.config[teamKey].color = safeColor;
      }
    }

    this.persist();
    emit('config:teamChanged', { team: teamKey, name: safeName, color: safeColor });
  }

  /**
   * Update preference
   */
  setPreference(key, value) {
    if (!PREFERENCE_KEYS.includes(key)) {
      throw new Error(`Invalid preference key: ${key}`);
    }

    const normalized = normalizePreference(value);
    if (normalized === null) return;

    this.config[key] = normalized;
    this.persist();
    emit('config:preferenceChanged', { key, value: normalized });
  }

  /**
   * Update multiple preferences at once
   */
  setPreferences(preferences) {
    Object.keys(preferences).forEach(key => {
      if (PREFERENCE_KEYS.includes(key)) {
        const normalized = normalizePreference(preferences[key]);
        if (normalized !== null) {
          this.config[key] = normalized;
        }
      }
    });

    this.persist();
    emit('config:preferencesChanged', { preferences: this.getPreferences() });
  }

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    this.config = createDefaultConfig();

    this.persist();
    emit('config:reset');
  }

  /**
   * Reset specific mode rules to defaults
   * @param {string|number} mode - Game mode ('4', '6', or '8')
   */
  resetModeToDefaults(mode) {
    const modeKey = String(mode);

    if (modeKey === '4') {
      this.config.c4 = { ...DEFAULT_RULES.c4 };
    } else if (modeKey === '6') {
      this.config.t6 = { ...DEFAULT_RULES.t6 };
      this.config.p6 = { ...DEFAULT_RULES.p6 };
    } else if (modeKey === '8') {
      this.config.t8 = { ...DEFAULT_RULES.t8 };
      this.config.p8 = { ...DEFAULT_RULES.p8 };
    }

    this.persist();
    emit('config:rulesReset', { mode: modeKey });

    // Update DOM inputs to show defaults
    this.updateDOMInputsFromConfig(modeKey);
  }

  /**
   * Update DOM inputs from current config
   * @param {string|number} mode - Game mode ('4', '6', or '8')
   */
  updateDOMInputsFromConfig(mode) {
    if (typeof document === 'undefined') return;

    const modeKey = String(mode);

    if (modeKey === '4') {
      const c4_12 = document.getElementById('c4_12');
      const c4_13 = document.getElementById('c4_13');
      const c4_14 = document.getElementById('c4_14');

      if (c4_12) c4_12.value = this.config.c4['1,2'];
      if (c4_13) c4_13.value = this.config.c4['1,3'];
      if (c4_14) c4_14.value = this.config.c4['1,4'];
    } else if (modeKey === '6') {
      const t6_3 = document.getElementById('t6_3');
      const t6_2 = document.getElementById('t6_2');
      const t6_1 = document.getElementById('t6_1');

      if (t6_3) t6_3.value = this.config.t6.g3;
      if (t6_2) t6_2.value = this.config.t6.g2;
      if (t6_1) t6_1.value = this.config.t6.g1;

      for (let i = 1; i <= 6; i++) {
        const input = document.getElementById(`p6_${i}`);
        if (input) input.value = this.config.p6[i];
      }
    } else if (modeKey === '8') {
      const t8_3 = document.getElementById('t8_3');
      const t8_2 = document.getElementById('t8_2');
      const t8_1 = document.getElementById('t8_1');

      if (t8_3) t8_3.value = this.config.t8.g3;
      if (t8_2) t8_2.value = this.config.t8.g2;
      if (t8_1) t8_1.value = this.config.t8.g1;

      for (let i = 1; i <= 8; i++) {
        const input = document.getElementById(`p8_${i}`);
        if (input) input.value = this.config.p8[i];
      }
    }
  }

  /**
   * Collect and save custom rules from DOM inputs
   * @param {string|number} mode - Game mode ('4', '6', or '8')
   */
  collectAndSaveRulesFromDOM(mode) {
    const modeKey = String(mode);

    if (modeKey === '4') {
      // Collect 4-player rules from inputs
      const c4_12 = document.getElementById('c4_12');
      const c4_13 = document.getElementById('c4_13');
      const c4_14 = document.getElementById('c4_14');

      if (c4_12 && c4_13 && c4_14) {
        this.config.c4 = {
          '1,2': parseIntegerOrDefault(c4_12.value, DEFAULT_RULES.c4['1,2']),
          '1,3': parseIntegerOrDefault(c4_13.value, DEFAULT_RULES.c4['1,3']),
          '1,4': parseIntegerOrDefault(c4_14.value, DEFAULT_RULES.c4['1,4'])
        };
      }
    } else if (modeKey === '6') {
      // Collect 6-player thresholds
      const t6_3 = document.getElementById('t6_3');
      const t6_2 = document.getElementById('t6_2');
      const t6_1 = document.getElementById('t6_1');

      if (t6_3 && t6_2 && t6_1) {
        this.config.t6 = {
          g3: parseIntegerOrDefault(t6_3.value, DEFAULT_RULES.t6.g3),
          g2: parseIntegerOrDefault(t6_2.value, DEFAULT_RULES.t6.g2),
          g1: parseIntegerOrDefault(t6_1.value, DEFAULT_RULES.t6.g1)
        };
      }

      // Collect 6-player points
      const points = {};
      for (let i = 1; i <= 6; i++) {
        const input = document.getElementById(`p6_${i}`);
        if (input) {
          points[i] = parseIntegerOrDefault(input.value, DEFAULT_RULES.p6[i] || 0);
        }
      }
      this.config.p6 = points;
    } else if (modeKey === '8') {
      // Collect 8-player thresholds
      const t8_3 = document.getElementById('t8_3');
      const t8_2 = document.getElementById('t8_2');
      const t8_1 = document.getElementById('t8_1');

      if (t8_3 && t8_2 && t8_1) {
        this.config.t8 = {
          g3: parseIntegerOrDefault(t8_3.value, DEFAULT_RULES.t8.g3),
          g2: parseIntegerOrDefault(t8_2.value, DEFAULT_RULES.t8.g2),
          g1: parseIntegerOrDefault(t8_1.value, DEFAULT_RULES.t8.g1)
        };
      }

      // Collect 8-player points
      const points = {};
      for (let i = 1; i <= 8; i++) {
        const input = document.getElementById(`p8_${i}`);
        if (input) {
          points[i] = parseIntegerOrDefault(input.value, DEFAULT_RULES.p8[i] || 0);
        }
      }
      this.config.p8 = points;
    }

    this.persist();
    emit('config:rulesUpdated', { mode: modeKey });
  }
}

// Create and export singleton instance
const gameConfig = new GameConfig();
export default gameConfig;
