/**
 * Storage Utility
 * Handles localStorage operations with versioning and migration
 */

import { CONFIG } from '../core/config.js';

export class Storage {
  constructor() {
    this.version = '8.0.0';
    this.keys = CONFIG.STORAGE_KEYS;
  }

  /**
   * Save data to localStorage
   */
  save(key, data) {
    try {
      const wrapper = {
        version: this.version,
        timestamp: Date.now(),
        data: data
      };
      localStorage.setItem(key, JSON.stringify(wrapper));
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      
      // Handle quota exceeded
      if (e.name === 'QuotaExceededError') {
        this.clearOldData();
        try {
          localStorage.setItem(key, JSON.stringify(data));
          return true;
        } catch (e2) {
          console.error('Storage still full after cleanup:', e2);
        }
      }
      return false;
    }
  }

  /**
   * Load data from localStorage
   */
  load(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      
      const wrapper = JSON.parse(item);
      
      // Check version and migrate if needed
      if (wrapper.version !== this.version) {
        const migrated = this.migrate(wrapper.data, wrapper.version);
        if (migrated) {
          this.save(key, migrated);
          return migrated;
        }
      }
      
      return wrapper.data || defaultValue;
    } catch (e) {
      console.error('Storage load error:', e);
      return defaultValue;
    }
  }

  /**
   * Delete from localStorage
   */
  delete(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Storage delete error:', e);
      return false;
    }
  }

  /**
   * Clear all app data
   */
  clearAll() {
    Object.values(this.keys).forEach(key => {
      this.delete(key);
    });
  }

  /**
   * Save game state
   */
  saveGameState(gameState) {
    const state = gameState.exportState();
    return this.save(this.keys.STATE, state);
  }

  /**
   * Load game state
   */
  loadGameState() {
    return this.load(this.keys.STATE, null);
  }

  /**
   * Save settings
   */
  saveSettings(settings) {
    return this.save(this.keys.SETTINGS, settings);
  }

  /**
   * Load settings
   */
  loadSettings() {
    const defaults = {
      must1: true,
      autoNext: true,
      autoApply: true,
      strictA: true,
      teams: {
        t1: { name: '蓝队', color: '#3b82f6' },
        t2: { name: '红队', color: '#ef4444' }
      },
      customScoring: null
    };
    
    return this.load(this.keys.SETTINGS, defaults);
  }

  /**
   * Save player stats
   */
  savePlayerStats(stats) {
    return this.save(this.keys.STATS, stats);
  }

  /**
   * Load player stats
   */
  loadPlayerStats() {
    return this.load(this.keys.STATS, {});
  }

  /**
   * Save game history
   */
  saveHistory(history) {
    return this.save(this.keys.HISTORY, history);
  }

  /**
   * Load game history
   */
  loadHistory() {
    return this.load(this.keys.HISTORY, []);
  }

  /**
   * Migrate data from old versions
   */
  migrate(data, fromVersion) {
    console.log(`Migrating from version ${fromVersion} to ${this.version}`);
    
    // Handle specific version migrations
    if (fromVersion.startsWith('7.')) {
      // Migrate from v7 to v8
      return this.migrateV7ToV8(data);
    }
    
    // Return data as-is if no migration needed
    return data;
  }

  /**
   * Migrate from v7 to v8
   */
  migrateV7ToV8(data) {
    // Convert old format to new format
    const migrated = { ...data };
    
    // Update team structure if needed
    if (data.t1 && !data.teams) {
      migrated.teams = {
        t1: {
          name: data.t1.name || '蓝队',
          color: data.t1.color || '#3b82f6',
          level: data.t1.lvl || 2
        },
        t2: {
          name: data.t2.name || '红队',
          color: data.t2.color || '#ef4444',
          level: data.t2.lvl || 2
        }
      };
      delete migrated.t1;
      delete migrated.t2;
    }
    
    // Update history format if needed
    if (data.hist && !data.gameHistory) {
      migrated.gameHistory = data.hist;
      delete migrated.hist;
    }
    
    return migrated;
  }

  /**
   * Clear old data to free up space
   */
  clearOldData() {
    try {
      // Get all keys
      const keys = Object.keys(localStorage);
      
      // Find and remove old version data
      keys.forEach(key => {
        if (key.includes('gd_v') && !key.includes('v8')) {
          localStorage.removeItem(key);
        }
      });
      
      // Trim history if too large
      const history = this.loadHistory();
      if (history && history.length > CONFIG.UI.MAX_HISTORY) {
        const trimmed = history.slice(-CONFIG.UI.MAX_HISTORY);
        this.saveHistory(trimmed);
      }
    } catch (e) {
      console.error('Error clearing old data:', e);
    }
  }

  /**
   * Get storage size info
   */
  getStorageInfo() {
    let totalSize = 0;
    const details = {};
    
    Object.entries(this.keys).forEach(([name, key]) => {
      const item = localStorage.getItem(key);
      if (item) {
        const size = item.length;
        totalSize += size;
        details[name] = {
          size: size,
          sizeKB: (size / 1024).toFixed(2)
        };
      }
    });
    
    return {
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      details,
      // Estimate available (5MB typical limit)
      estimatedAvailable: 5 * 1024 * 1024 - totalSize,
      percentUsed: ((totalSize / (5 * 1024 * 1024)) * 100).toFixed(1)
    };
  }

  /**
   * Export all data for backup
   */
  exportAllData() {
    const data = {
      version: this.version,
      exportDate: new Date().toISOString(),
      state: this.loadGameState(),
      settings: this.loadSettings(),
      stats: this.loadPlayerStats(),
      history: this.loadHistory()
    };
    
    return data;
  }

  /**
   * Import all data from backup
   */
  importAllData(data) {
    if (!data || !data.version) {
      throw new Error('Invalid backup data');
    }
    
    // Clear existing data
    this.clearAll();
    
    // Import each component
    if (data.state) this.saveGameState({ exportState: () => data.state });
    if (data.settings) this.saveSettings(data.settings);
    if (data.stats) this.savePlayerStats(data.stats);
    if (data.history) this.saveHistory(data.history);
    
    return true;
  }
}

// Singleton instance
const storage = new Storage();
export default storage;