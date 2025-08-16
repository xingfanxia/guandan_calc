/**
 * Export Utility Module
 * Handles all export formats: TXT, CSV, PNG, JSON
 */

import { LEVEL_RULES, CONFIG } from '../core/config.js';

export class ExportManager {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /**
   * Export to TXT format
   */
  exportTXT() {
    const lines = [];
    
    // Header
    lines.push('=' .repeat(80));
    lines.push('掼蛋积分系统 - 比赛记录');
    lines.push('=' .repeat(80));
    lines.push('');
    
    // Match info
    lines.push(`比赛模式: ${this.gameState.mode}人`);
    lines.push(`总回合数: ${this.gameState.roundNumber}`);
    lines.push(`导出时间: ${new Date().toLocaleString()}`);
    lines.push('');
    
    // Teams info
    lines.push('【队伍信息】');
    lines.push(`${this.gameState.teams.t1.name}: ${LEVEL_RULES.getLevelDisplay(this.gameState.teams.t1.level)}级`);
    lines.push(`  A级状态: ${this.getALevelStatusText('t1')}`);
    lines.push(`${this.gameState.teams.t2.name}: ${LEVEL_RULES.getLevelDisplay(this.gameState.teams.t2.level)}级`);
    lines.push(`  A级状态: ${this.getALevelStatusText('t2')}`);
    lines.push('');
    
    // Players
    lines.push('【玩家分组】');
    const t1Players = this.gameState.getTeamPlayers(1);
    const t2Players = this.gameState.getTeamPlayers(2);
    
    lines.push(`${this.gameState.teams.t1.name}:`);
    t1Players.forEach(p => lines.push(`  ${p.emoji} ${p.name}`));
    
    lines.push(`${this.gameState.teams.t2.name}:`);
    t2Players.forEach(p => lines.push(`  ${p.emoji} ${p.name}`));
    lines.push('');
    
    // Game history
    if (this.gameState.gameHistory.length > 0) {
      lines.push('【比赛历史】');
      lines.push('-'.repeat(80));
      
      this.gameState.gameHistory.forEach((entry, index) => {
        lines.push(`回合 ${entry.roundNumber}: ${entry.timeString}`);
        lines.push(`  获胜: ${entry.winnerTeam.name} (${entry.winnerRanks.join(',')})`);
        lines.push(`  升级: ${entry.label} (+${entry.upgradeAmount}级)`);
        lines.push(`  排名: ${entry.ranking.map(r => r.player.name).join(' > ')}`);
        
        if (entry.aLevelNote) {
          lines.push(`  A级: ${entry.aLevelNote}`);
        }
        
        lines.push(`  级别: ${LEVEL_RULES.getLevelDisplay(entry.teamLevels.after.t1)} vs ${LEVEL_RULES.getLevelDisplay(entry.teamLevels.after.t2)}`);
        lines.push('-'.repeat(80));
      });
      lines.push('');
    }
    
    // Player statistics
    lines.push('【玩家统计】');
    lines.push('-'.repeat(80));
    
    const stats = this.gameState.statistics.getAllPlayerStats();
    stats.forEach(({ player, stats }) => {
      if (stats.games > 0) {
        lines.push(`${player.emoji} ${player.name}:`);
        lines.push(`  场次: ${stats.games}, 胜/负: ${stats.wins}/${stats.losses}`);
        lines.push(`  平均排名: ${stats.avgRank.toFixed(2)}`);
        lines.push(`  第一名: ${stats.firstPlaceCount}次, 末名: ${stats.lastPlaceCount}次`);
        
        const rating = this.gameState.statistics.calculatePerformanceRating(player.id);
        lines.push(`  表现评分: ${rating}`);
        lines.push('');
      }
    });
    
    // Team summary
    lines.push('【队伍总结】');
    const t1Stats = this.gameState.statistics.getTeamStats(1);
    const t2Stats = this.gameState.statistics.getTeamStats(2);
    
    lines.push(`${this.gameState.teams.t1.name}:`);
    if (t1Stats.mvp) lines.push(`  MVP: ${t1Stats.mvp.emoji} ${t1Stats.mvp.name}`);
    if (t1Stats.burden) lines.push(`  需努力: ${t1Stats.burden.emoji} ${t1Stats.burden.name}`);
    
    lines.push(`${this.gameState.teams.t2.name}:`);
    if (t2Stats.mvp) lines.push(`  MVP: ${t2Stats.mvp.emoji} ${t2Stats.mvp.name}`);
    if (t2Stats.burden) lines.push(`  需努力: ${t2Stats.burden.emoji} ${t2Stats.burden.name}`);
    
    lines.push('');
    lines.push('=' .repeat(80));
    
    return lines.join('\n');
  }

  /**
   * Export to CSV format
   */
  exportCSV() {
    const rows = [];
    
    // Headers
    rows.push([
      '回合',
      '时间',
      '模式',
      '获胜队伍',
      '获胜组合',
      '升级类型',
      '升级数',
      '排名',
      '队1级别',
      '队2级别',
      '本轮级别',
      'A级备注'
    ]);
    
    // Data rows
    this.gameState.gameHistory.forEach(entry => {
      rows.push([
        entry.roundNumber,
        entry.timeString,
        entry.mode + '人',
        entry.winnerTeam.name,
        entry.winnerRanks.join(','),
        entry.label,
        entry.upgradeAmount,
        entry.ranking.map(r => r.player.name).join(' > '),
        LEVEL_RULES.getLevelDisplay(entry.teamLevels.after.t1),
        LEVEL_RULES.getLevelDisplay(entry.teamLevels.after.t2),
        LEVEL_RULES.getLevelDisplay(entry.currentRoundLevel),
        entry.aLevelNote || ''
      ]);
    });
    
    // Convert to CSV string
    return rows.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma or newline
        const str = String(cell);
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ).join('\n');
  }

  /**
   * Export to JSON format
   */
  exportJSON() {
    return {
      version: '8.0.0',
      exportDate: new Date().toISOString(),
      match: {
        mode: this.gameState.mode,
        rounds: this.gameState.roundNumber,
        settings: {
          must1: this.gameState.settings.must1,
          autoNext: this.gameState.settings.autoNext,
          autoApply: this.gameState.settings.autoApply,
          strictA: this.gameState.settings.strictA
        }
      },
      teams: {
        t1: {
          ...this.gameState.teams.t1,
          players: this.gameState.getTeamPlayers(1).map(p => ({
            id: p.id,
            name: p.name,
            emoji: p.emoji
          })),
          aLevelState: this.gameState.aLevelState.t1
        },
        t2: {
          ...this.gameState.teams.t2,
          players: this.gameState.getTeamPlayers(2).map(p => ({
            id: p.id,
            name: p.name,
            emoji: p.emoji
          })),
          aLevelState: this.gameState.aLevelState.t2
        }
      },
      history: this.gameState.gameHistory,
      statistics: this.gameState.statistics.exportStatsForDisplay(),
      customScoring: this.gameState.customScoring
    };
  }

  /**
   * Export to PNG (screenshot)
   * Requires html2canvas library
   */
  async exportPNG(elementId = 'app', longFormat = false) {
    // Check if html2canvas is available
    if (typeof html2canvas === 'undefined') {
      throw new Error('html2canvas library not loaded');
    }
    
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found`);
    }
    
    // Prepare for screenshot
    const originalDisplay = {};
    
    if (longFormat) {
      // Show all history for long format
      const historyRows = element.querySelectorAll('#histTable tbody tr');
      historyRows.forEach(row => {
        originalDisplay[row] = row.style.display;
        row.style.display = '';
      });
      
      // Expand collapsed sections
      const details = element.querySelectorAll('details');
      details.forEach(detail => {
        originalDisplay[detail] = detail.open;
        detail.open = true;
      });
    }
    
    try {
      // Capture screenshot
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      // Convert to blob
      return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create image blob'));
          }
        }, 'image/png');
      });
    } finally {
      // Restore original display
      if (longFormat) {
        Object.entries(originalDisplay).forEach(([elem, value]) => {
          if (elem.style) {
            elem.style.display = value;
          } else if (elem.open !== undefined) {
            elem.open = value;
          }
        });
      }
    }
  }

  /**
   * Download file helper
   */
  downloadFile(content, filename, mimeType) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export with download
   */
  async exportAndDownload(format = 'txt') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const baseFilename = `guandan_${timestamp}`;
    
    try {
      switch (format.toLowerCase()) {
        case 'txt': {
          const content = this.exportTXT();
          this.downloadFile(content, `${baseFilename}.txt`, 'text/plain;charset=utf-8');
          break;
        }
        
        case 'csv': {
          const content = this.exportCSV();
          // Add BOM for Excel UTF-8 recognition
          const bom = '\ufeff';
          this.downloadFile(bom + content, `${baseFilename}.csv`, 'text/csv;charset=utf-8');
          break;
        }
        
        case 'json': {
          const content = JSON.stringify(this.exportJSON(), null, 2);
          this.downloadFile(content, `${baseFilename}.json`, 'application/json;charset=utf-8');
          break;
        }
        
        case 'png': {
          const blob = await this.exportPNG('app', false);
          this.downloadFile(blob, `${baseFilename}.png`, 'image/png');
          break;
        }
        
        case 'longpng': {
          const blob = await this.exportPNG('app', true);
          this.downloadFile(blob, `${baseFilename}_full.png`, 'image/png');
          break;
        }
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Export error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get A-level status text
   */
  getALevelStatusText(teamId) {
    const aState = this.gameState.aLevelState[teamId];
    
    if (aState.wonA) {
      return '已通关';
    } else if (aState.inA) {
      return `进行中 (失败${aState.failures}次)`;
    } else {
      return '未到达';
    }
  }

  /**
   * Import data from JSON
   */
  importJSON(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      if (!data.version || !data.teams || !data.history) {
        throw new Error('Invalid import data format');
      }
      
      // Import teams
      if (data.teams) {
        this.gameState.teams = {
          t1: {
            name: data.teams.t1.name,
            color: data.teams.t1.color,
            level: data.teams.t1.level
          },
          t2: {
            name: data.teams.t2.name,
            color: data.teams.t2.color,
            level: data.teams.t2.level
          }
        };
        
        // Import A-level state
        if (data.teams.t1.aLevelState) {
          this.gameState.aLevelState.t1 = data.teams.t1.aLevelState;
        }
        if (data.teams.t2.aLevelState) {
          this.gameState.aLevelState.t2 = data.teams.t2.aLevelState;
        }
      }
      
      // Import players
      if (data.teams.t1.players && data.teams.t2.players) {
        this.gameState.players = [];
        
        data.teams.t1.players.forEach(p => {
          this.gameState.players.push({
            ...p,
            team: 1
          });
        });
        
        data.teams.t2.players.forEach(p => {
          this.gameState.players.push({
            ...p,
            team: 2
          });
        });
      }
      
      // Import history
      this.gameState.gameHistory = data.history || [];
      this.gameState.roundNumber = data.match?.rounds || this.gameState.gameHistory.length;
      
      // Import settings
      if (data.match?.settings) {
        Object.assign(this.gameState.settings, data.match.settings);
      }
      
      // Import custom scoring
      if (data.customScoring) {
        this.gameState.customScoring = data.customScoring;
      }
      
      // Recalculate statistics
      this.gameState.history.recalculateStats();
      
      return { 
        success: true,
        imported: {
          rounds: this.gameState.gameHistory.length,
          players: this.gameState.players.length
        }
      };
    } catch (error) {
      console.error('Import error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

export default ExportManager;