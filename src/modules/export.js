/**
 * Export Module
 * Handles exporting game results to various formats
 */

import html2canvas from 'html2canvas';

export class ExportHandler {
  constructor() {
    this.dateFormatter = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Export results as PNG image
   */
  async exportAsPNG(element) {
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true
      });
      
      // Convert to blob
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `guandan-result-${this.getTimestamp()}.png`;
        link.click();
        
        // Cleanup
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }, 'image/png');
      
      return { success: true };
    } catch (error) {
      console.error('Export PNG failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export results as CSV
   */
  exportAsCSV(result) {
    try {
      const csvContent = this.generateCSV(result);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `guandan-result-${this.getTimestamp()}.csv`;
      link.click();
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      return { success: true };
    } catch (error) {
      console.error('Export CSV failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export game state as JSON
   */
  exportAsJSON(gameState, result) {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        gameState: gameState,
        result: result,
        version: '2.0.0'
      };
      
      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `guandan-game-${this.getTimestamp()}.json`;
      link.click();
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      return { success: true };
    } catch (error) {
      console.error('Export JSON failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import game state from JSON
   */
  importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          // Validate data structure
          if (!data.gameState || !data.version) {
            throw new Error('Invalid game file format');
          }
          
          resolve({
            success: true,
            data: data
          });
        } catch (error) {
          reject({
            success: false,
            error: error.message
          });
        }
      };
      
      reader.onerror = () => {
        reject({
          success: false,
          error: 'Failed to read file'
        });
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Generate CSV content
   */
  generateCSV(result) {
    const lines = [];
    
    // Header
    lines.push('掼蛋计分结果');
    lines.push(`时间,${this.dateFormatter.format(new Date())}`);
    lines.push('');
    
    // Game info
    lines.push(`游戏模式,${result.mode}人`);
    lines.push(`当前级别,${result.upgrade.currentLevelName}`);
    lines.push(`新级别,${result.upgrade.newLevelName}`);
    lines.push(`升级分数,${result.score}`);
    lines.push(`结果类型,${result.label}`);
    lines.push('');
    
    // Ranking
    lines.push('完整排名');
    result.fullRanking.forEach((name, index) => {
      lines.push(`第${index + 1}名,${name}`);
    });
    lines.push('');
    
    // Winner team ranks
    lines.push('获胜队伍排名');
    lines.push(result.winnerRanks.join(','));
    
    return lines.join('\n');
  }

  /**
   * Copy results to clipboard
   */
  async copyToClipboard(result) {
    try {
      const text = this.generateClipboardText(result);
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return { success: true };
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return { success: true };
      }
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate clipboard text
   */
  generateClipboardText(result) {
    const lines = [];
    
    lines.push('【掼蛋计分结果】');
    lines.push(`时间: ${this.dateFormatter.format(new Date())}`);
    lines.push(`模式: ${result.mode}人`);
    lines.push(`得分: ${result.score}分 (${result.label})`);
    lines.push(`级别: ${result.upgrade.currentLevelName} → ${result.upgrade.newLevelName}`);
    lines.push('');
    lines.push('排名:');
    result.fullRanking.forEach((name, index) => {
      lines.push(`  ${index + 1}. ${name}`);
    });
    
    return lines.join('\n');
  }

  /**
   * Get timestamp for filename
   */
  getTimestamp() {
    const now = new Date();
    return now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      '-' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
  }

  /**
   * Share results (Web Share API)
   */
  async shareResults(result) {
    if (!navigator.share) {
      return { success: false, error: 'Sharing not supported' };
    }
    
    try {
      const text = this.generateClipboardText(result);
      
      await navigator.share({
        title: '掼蛋计分结果',
        text: text
      });
      
      return { success: true };
    } catch (error) {
      // User cancelled or error occurred
      return { success: false, error: error.message };
    }
  }
}