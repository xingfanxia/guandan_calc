// Export functionality module (TXT, CSV, PNG)
// UTF-8 encoding for Chinese characters

import { $, now } from '../utils/dom.js';

class ExportManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.longCnv = null;
    this.lctx = null;
    this.initializeCanvas();
  }

  /**
   * Initialize canvas for PNG export
   */
  initializeCanvas() {
    this.longCnv = $('longCnv');
    if (this.longCnv) {
      this.lctx = this.longCnv.getContext('2d');
    }
  }

  /**
   * Export game history as TXT file
   */
  exportTXT() {
    const lines = [
      '掼蛋战绩导出（v8.0）',
      '================',
      '当前本局级牌：' + this.gameState.state.roundLevel,
      '下局预览：' + (this.gameState.state.nextRoundBase || '—'),
      (this.gameState.settings.t1.name || '队1') + '级牌：' + this.gameState.state.t1.lvl + '｜A' + (this.gameState.state.t1.aFail || 0) + '/3',
      (this.gameState.settings.t2.name || '队2') + '级牌：' + this.gameState.state.t2.lvl + '｜A' + (this.gameState.state.t2.aFail || 0) + '/3',
      'A级规则：' + (this.gameState.settings.strictA ? '严格模式' : '宽松模式'),
      '',
      '#  时间 | 人数 | 胜方组合 | 玩家排名 | 升级情况 | 胜队 | ' + 
      this.gameState.settings.t1.name + '级 | ' + 
      this.gameState.settings.t2.name + '级 | 本局级 | A说明'
    ];
    
    for (let i = 0; i < this.gameState.state.hist.length; i++) {
      const h = this.gameState.state.hist[i];
      
      // Build player ranking string
      let playerRankStr = '';
      if (h.playerRankings) {
        const rankParts = [];
        for (let r = 1; r <= parseInt(h.mode); r++) {
          if (h.playerRankings[r]) {
            const p = h.playerRankings[r];
            rankParts.push(p.emoji + p.name);
          }
        }
        playerRankStr = rankParts.join(' ');
      }
      
      const upgradeStr = h.up ? (h.win + ' 升' + h.up + '级') : '不升级';
      
      lines.push([
        i + 1,
        h.ts,
        h.mode,
        h.combo,
        playerRankStr,
        upgradeStr,
        h.win,
        h.t1,
        h.t2,
        h.round,
        h.aNote
      ].join(' | '));
    }
    
    const blob = new Blob([lines.join('\n')], {type: 'text/plain;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '掼蛋战绩_v8.txt';
    a.click();
    
    this.showExportTip('已导出 TXT');
  }

  /**
   * Escape CSV values properly
   * @param {*} value - Value to escape
   * @returns {string} Escaped CSV value
   */
  csvEscape(value) {
    const s = String(value).replace(/"/g, '""');
    if (s.search(/[",\n]/) >= 0) {
      return '"' + s + '"';
    }
    return s;
  }

  /**
   * Export game history as CSV file
   */
  exportCSV() {
    const rows = [[
      '#',
      '时间',
      '人数',
      '胜方组合',
      '玩家排名',
      '升级情况',
      '胜队',
      this.gameState.settings.t1.name + '级',
      this.gameState.settings.t2.name + '级',
      '本局级',
      'A说明',
      'A级规则'
    ]];
    
    for (let i = 0; i < this.gameState.state.hist.length; i++) {
      const h = this.gameState.state.hist[i];
      
      // Build player ranking string
      let playerRankStr = '';
      if (h.playerRankings) {
        const rankParts = [];
        for (let r = 1; r <= parseInt(h.mode); r++) {
          if (h.playerRankings[r]) {
            const p = h.playerRankings[r];
            rankParts.push(p.emoji + p.name);
          }
        }
        playerRankStr = rankParts.join(' ');
      }
      
      const upgradeStr = h.up ? (h.win + ' 升' + h.up + '级') : '不升级';
      
      rows.push([
        i + 1,
        h.ts,
        h.mode,
        h.combo,
        playerRankStr,
        upgradeStr,
        h.win,
        h.t1,
        h.t2,
        h.round,
        h.aNote,
        this.gameState.settings.strictA ? '严格' : '宽松'
      ]);
    }
    
    const lines = rows.map(r => r.map(cell => this.csvEscape(cell)).join(',')).join('\n');
    const blob = new Blob([lines], {type: 'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '掼蛋战绩_v8.csv';
    a.click();
    
    this.showExportTip('已导出 CSV');
  }

  /**
   * Export game history as long PNG image
   */
  exportLongPNG() {
    if (!this.longCnv || !this.lctx) {
      console.error('Canvas not available for PNG export');
      return;
    }
    
    const W = 2200;
    const headH = 220;
    const rowH = 40;
    const n = this.gameState.state.hist.length;
    const H = headH + (n + 1) * rowH + 80;
    
    this.longCnv.width = W;
    this.longCnv.height = H;
    
    // Background
    this.lctx.fillStyle = '#0b0b0c';
    this.lctx.fillRect(0, 0, W, H);
    
    // Title
    this.lctx.fillStyle = '#f5f6f8';
    this.lctx.font = 'bold 48px Arial';
    this.lctx.fillText('掼蛋战绩总览 v8.0', 40, 70);
    
    // Subtitle information
    this.lctx.font = '20px Arial';
    this.lctx.fillStyle = '#b4b8bf';
    this.lctx.fillText(
      '当前本局级牌：' + this.gameState.state.roundLevel + 
      '｜下局预览：' + (this.gameState.state.nextRoundBase || '—') + 
      '｜A级规则：' + (this.gameState.settings.strictA ? '严格模式' : '宽松模式'),
      40, 110
    );
    
    this.lctx.fillText(
      '队伍：' + this.gameState.settings.t1.name + 
      '（' + this.gameState.state.t1.lvl + '，A' + (this.gameState.state.t1.aFail || 0) + '/3） | ' +
      this.gameState.settings.t2.name + 
      '（' + this.gameState.state.t2.lvl + '，A' + (this.gameState.state.t2.aFail || 0) + '/3）',
      40, 140
    );
    
    this.lctx.fillText('生成时间：' + now(), 40, 170);
    
    // Table headers
    const cols = [
      '#', '时间', '人数', '胜方组合', '玩家排名', '升级', '胜队',
      this.gameState.settings.t1.name + '级',
      this.gameState.settings.t2.name + '级',
      '本局级', 'A说明'
    ];
    const xs = [40, 80, 240, 300, 440, 700, 800, 900, 1000, 1100, 1200];
    
    this.lctx.font = 'bold 20px Arial';
    this.lctx.fillStyle = '#e6b800';
    for (let c = 0; c < cols.length; c++) {
      this.lctx.fillText(cols[c], xs[c], headH);
    }
    
    // Table rows
    this.lctx.font = '14px Arial';
    for (let i = 0; i < n; i++) {
      const h = this.gameState.state.hist[i];
      const y = headH + (i + 1) * rowH;
      
      // Add row background color based on winning team
      const winColor = h.winKey === 't1' ? 
        this.gameState.settings.t1.color : 
        this.gameState.settings.t2.color;
      this.lctx.fillStyle = winColor + '10'; // Very light background
      this.lctx.fillRect(0, y - rowH + 10, W, rowH);
      
      // Build player ranking string with emoji and names
      let playerRankStr = '';
      if (h.playerRankings) {
        const rankParts = [];
        for (let r = 1; r <= 8; r++) {
          if (h.playerRankings[r]) {
            const p = h.playerRankings[r];
            rankParts.push(p.emoji + p.name);
          }
        }
        playerRankStr = rankParts.join(' ');
      }
      
      const upgradeStr = h.up ? (h.win + ' 升' + h.up) : '不升';
      const vals = [
        i + 1,
        h.ts.substring(0, 16),
        h.mode,
        h.combo,
        playerRankStr,
        upgradeStr,
        h.win,
        h.t1,
        h.t2,
        h.round,
        h.aNote || ''
      ];
      
      // Set text color
      this.lctx.fillStyle = '#f5f6f8';
      
      for (let j = 0; j < vals.length; j++) {
        const text = String(vals[j]);
        // Wrap long A notes
        if (j === 10 && text.length > 50) {
          const maxWidth = 800;
          const words = text.split(' ');
          let line = '';
          let lineY = y;
          for (let w = 0; w < words.length; w++) {
            const testLine = line + words[w] + ' ';
            const metrics = this.lctx.measureText(testLine);
            if (metrics.width > maxWidth && w > 0) {
              this.lctx.fillText(line, xs[j], lineY);
              line = words[w] + ' ';
              lineY += 15;
            } else {
              line = testLine;
            }
          }
          this.lctx.fillText(line, xs[j], lineY);
        } else {
          this.lctx.fillText(text, xs[j], y);
        }
      }
    }
    
    // Download the image
    const a = document.createElement('a');
    a.href = this.longCnv.toDataURL('image/png');
    a.download = '掼蛋战绩_v8.png';
    a.click();
    
    this.showExportTip('已导出 PNG');
  }

  /**
   * Show export completion tip
   * @param {string} message - Export message
   */
  showExportTip(message) {
    const exportTip = $('exportTip');
    if (exportTip) {
      exportTip.textContent = message;
      setTimeout(() => {
        exportTip.textContent = '';
      }, 1200);
    }
  }
}

export default ExportManager;