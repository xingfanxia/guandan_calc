/**
 * Export functionality module for game history
 */

import { csvEscape } from './utils.js';

export class ExportManager {
  constructor(settings, state, playerManager) {
    this.settings = settings;
    this.state = state;
    this.playerManager = playerManager;
  }
  
  /**
   * Export history as text
   * @returns {string} Text representation of history
   */
  exportText() {
    let txt = '掼蛋升级计算器 - 历史记录\n';
    txt += '导出时间: ' + new Date().toLocaleString() + '\n\n';
    txt += `${this.settings.t1.name} vs ${this.settings.t2.name}\n`;
    txt += `当前级别: ${this.settings.t1.name} ${this.state.t1.lvl} | `;
    txt += `${this.settings.t2.name} ${this.state.t2.lvl}\n\n`;
    
    if (this.state.hist.length === 0) {
      txt += '暂无历史记录\n';
      return txt;
    }
    
    txt += '历史战绩:\n';
    txt += '─'.repeat(60) + '\n';
    
    this.state.hist.forEach((h, i) => {
      txt += `\n第 ${i + 1} 局 | ${h.time}\n`;
      txt += `人数: ${h.mode} | 胜方: ${h.winner === 't1' ? this.settings.t1.name : this.settings.t2.name}\n`;
      
      // Build player ranking string
      if (h.playerRanking) {
        const rankStr = Object.entries(h.playerRanking)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([rank, playerId]) => {
            const player = this.playerManager.getPlayerById(playerId);
            if (player) {
              return `${rank}.${player.emoji}${player.name}`;
            }
            return `${rank}.玩家${playerId}`;
          })
          .join(' ');
        txt += `排名: ${rankStr}\n`;
      } else {
        txt += `排名: ${h.input}\n`;
      }
      
      txt += `升级: ${h.upgrade}\n`;
      txt += `级牌变化: ${this.settings.t1.name} ${h.t1Before}→${h.t1After} | `;
      txt += `${this.settings.t2.name} ${h.t2Before}→${h.t2After}\n`;
      
      if (h.aNote) {
        txt += `A级说明: ${h.aNote}\n`;
      }
      
      txt += '─'.repeat(60) + '\n';
    });
    
    // Add player statistics
    txt += '\n\n玩家统计:\n';
    txt += '─'.repeat(60) + '\n';
    
    const playerData = this.playerManager.players.map(player => {
      const stats = this.playerManager.getPlayerStats(player.id);
      return {
        player,
        stats,
        avgRank: stats.games > 0 ? (stats.totalRank / stats.games).toFixed(2) : '—'
      };
    });
    
    playerData.sort((a, b) => {
      if (a.player.team !== b.player.team) {
        return (a.player.team || 0) - (b.player.team || 0);
      }
      if (a.stats.games === 0) return 1;
      if (b.stats.games === 0) return -1;
      return a.stats.totalRank / a.stats.games - b.stats.totalRank / b.stats.games;
    });
    
    playerData.forEach(({ player, stats, avgRank }) => {
      const teamName = player.team 
        ? (player.team === 1 ? this.settings.t1.name : this.settings.t2.name)
        : '未分配';
      txt += `${player.emoji} ${player.name} (${teamName}): `;
      txt += `场次${stats.games} | 平均排名${avgRank} | `;
      txt += `拿1次数${stats.firstPlace} | 垫底${stats.lastPlace}\n`;
    });
    
    return txt;
  }
  
  /**
   * Export history as CSV
   * @returns {string} CSV representation of history
   */
  exportCSV() {
    let csv = '局数,时间,人数,胜方,玩家排名,升级情况,';
    csv += `${csvEscape(this.settings.t1.name)}级牌前,`;
    csv += `${csvEscape(this.settings.t1.name)}级牌后,`;
    csv += `${csvEscape(this.settings.t2.name)}级牌前,`;
    csv += `${csvEscape(this.settings.t2.name)}级牌后,`;
    csv += '本局级牌,A说明\n';
    
    this.state.hist.forEach((h, i) => {
      csv += (i + 1) + ',';
      csv += csvEscape(h.time) + ',';
      csv += h.mode + '人,';
      csv += csvEscape(h.winner === 't1' ? this.settings.t1.name : this.settings.t2.name) + ',';
      
      // Build player ranking string
      if (h.playerRanking) {
        const rankStr = Object.entries(h.playerRanking)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([rank, playerId]) => {
            const player = this.playerManager.getPlayerById(playerId);
            if (player) {
              return `${rank}.${player.name}`;
            }
            return `${rank}.玩家${playerId}`;
          })
          .join(' ');
        csv += csvEscape(rankStr) + ',';
      } else {
        csv += csvEscape(h.input) + ',';
      }
      
      csv += csvEscape(h.upgrade) + ',';
      csv += h.t1Before + ',';
      csv += h.t1After + ',';
      csv += h.t2Before + ',';
      csv += h.t2After + ',';
      csv += h.roundLevel + ',';
      csv += csvEscape(h.aNote || '') + '\n';
    });
    
    return csv;
  }
  
  /**
   * Export as PNG image
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Function} callback - Callback with blob URL
   */
  exportPNG(canvas, callback) {
    const ctx = canvas.getContext('2d');
    const histBody = document.getElementById('histBody');
    
    // Calculate dimensions
    const rowHeight = 40;
    const headerHeight = 200;
    const tableHeight = Math.max(600, histBody.children.length * rowHeight + 100);
    const totalHeight = headerHeight + tableHeight;
    
    canvas.width = 1200;
    canvas.height = totalHeight;
    
    // Clear canvas
    ctx.fillStyle = '#0b0b0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw header
    ctx.fillStyle = '#f5f6f8';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('掼蛋升级计算器 - 历史记录', 50, 50);
    
    ctx.font = '20px sans-serif';
    ctx.fillText(`导出时间: ${new Date().toLocaleString()}`, 50, 90);
    
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = this.settings.t1.color;
    ctx.fillText(this.settings.t1.name, 50, 130);
    ctx.fillStyle = '#f5f6f8';
    ctx.fillText(' vs ', 150, 130);
    ctx.fillStyle = this.settings.t2.color;
    ctx.fillText(this.settings.t2.name, 220, 130);
    
    ctx.fillStyle = '#f5f6f8';
    ctx.font = '18px sans-serif';
    ctx.fillText(`当前级别: ${this.settings.t1.name} ${this.state.t1.lvl} | ${this.settings.t2.name} ${this.state.t2.lvl}`, 50, 170);
    
    // Draw table header
    ctx.fillStyle = '#24262c';
    ctx.fillRect(40, headerHeight, canvas.width - 80, 40);
    
    ctx.fillStyle = '#f5f6f8';
    ctx.font = 'bold 16px sans-serif';
    const headers = ['局', '时间', '人数', '胜方', '排名', '升级', '级牌变化', 'A说明'];
    const xPositions = [60, 120, 280, 350, 450, 600, 700, 900];
    
    headers.forEach((header, i) => {
      ctx.fillText(header, xPositions[i], headerHeight + 25);
    });
    
    // Draw table rows
    ctx.font = '14px sans-serif';
    let y = headerHeight + 40;
    
    this.state.hist.forEach((h, i) => {
      // Alternate row backgrounds
      if (i % 2 === 0) {
        ctx.fillStyle = '#16171b';
        ctx.fillRect(40, y, canvas.width - 80, rowHeight);
      }
      
      // Add row background color based on winning team
      if (h.winner === 't1') {
        ctx.fillStyle = this.hexToRgba(this.settings.t1.color, 0.1);
      } else {
        ctx.fillStyle = this.hexToRgba(this.settings.t2.color, 0.1);
      }
      ctx.fillRect(40, y, canvas.width - 80, rowHeight);
      
      // Draw text
      ctx.fillStyle = '#f5f6f8';
      ctx.fillText(String(i + 1), xPositions[0], y + 25);
      ctx.fillText(h.time, xPositions[1], y + 25);
      ctx.fillText(h.mode + '人', xPositions[2], y + 25);
      
      // Winner with color
      ctx.fillStyle = h.winner === 't1' ? this.settings.t1.color : this.settings.t2.color;
      ctx.fillText(h.winner === 't1' ? this.settings.t1.name : this.settings.t2.name, xPositions[3], y + 25);
      
      // Build player ranking string with emoji and names
      ctx.fillStyle = '#f5f6f8';
      if (h.playerRanking) {
        const rankStr = Object.entries(h.playerRanking)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([rank, playerId]) => {
            const player = this.playerManager.getPlayerById(playerId);
            if (player) {
              return `${rank}.${player.emoji}`;
            }
            return `${rank}.P${playerId}`;
          })
          .join(' ');
        ctx.fillText(rankStr.substring(0, 20), xPositions[4], y + 25);
      } else {
        ctx.fillText(h.input.substring(0, 10), xPositions[4], y + 25);
      }
      
      ctx.fillText(h.upgrade, xPositions[5], y + 25);
      
      const levelChange = `${h.t1Before}→${h.t1After} | ${h.t2Before}→${h.t2After}`;
      ctx.fillText(levelChange, xPositions[6], y + 25);
      
      if (h.aNote) {
        // Wrap long A notes
        const maxWidth = 250;
        const words = h.aNote.split(' ');
        let line = '';
        let lineY = y + 25;
        
        words.forEach(word => {
          const testLine = line + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line.length > 0) {
            ctx.fillText(line, xPositions[7], lineY);
            line = word + ' ';
            lineY += 15;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line, xPositions[7], lineY);
      }
      
      y += rowHeight;
    });
    
    // Convert to blob
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      callback(url);
    });
  }
  
  /**
   * Helper: Convert hex to RGBA
   * @param {string} hex - Hex color
   * @param {number} alpha - Alpha value
   * @returns {string} RGBA string
   */
  hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16);
    const g = parseInt(h.substr(2, 2), 16);
    const b = parseInt(h.substr(4, 2), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  
  /**
   * Download file
   * @param {string} content - File content
   * @param {string} filename - File name
   * @param {string} type - MIME type
   */
  download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  /**
   * Download blob
   * @param {string} url - Blob URL
   * @param {string} filename - File name
   */
  downloadBlob(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
}