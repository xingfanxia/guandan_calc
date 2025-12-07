/**
 * Export Handlers - TXT/CSV/PNG Export Functions
 * Extracted from app.js lines 1752-1894
 * Handles exporting game history in multiple formats
 */

import { $, now } from '../core/utils.js';
import state from '../core/state.js';
import config from '../core/config.js';

/**
 * CSV escape helper
 */
function csvEscape(value) {
  let s = String(value).replace(/"/g, '""');
  if (s.search(/[",\n]/) >= 0) {
    s = `"${s}"`;
  }
  return s;
}

/**
 * Export game history as TXT
 */
export function exportTXT() {
  const history = state.getHistory();
  const t1Name = config.getTeamName('t1');
  const t2Name = config.getTeamName('t2');
  const roundLevel = state.getRoundLevel();
  const nextRoundBase = state.getNextRoundBase();
  const t1Level = state.getTeamLevel('t1');
  const t2Level = state.getTeamLevel('t2');
  const t1AFail = state.getTeamAFail('t1');
  const t2AFail = state.getTeamAFail('t2');
  const strictA = config.getPreference('strictA');

  const lines = [
    '掼蛋战绩导出（v9.0）',
    '================',
    `当前本局级牌：${roundLevel}`,
    `下局预览：${nextRoundBase || '—'}`,
    `${t1Name}级牌：${t1Level}｜A${t1AFail}/3`,
    `${t2Name}级牌：${t2Level}｜A${t2AFail}/3`,
    `A级规则：${strictA ? '严格模式' : '宽松模式'}`,
    '',
    `#  时间 | 人数 | 胜方组合 | 玩家排名 | 升级情况 | 胜队 | ${t1Name}级 | ${t2Name}级 | 本局级 | A说明`
  ];

  history.forEach((h, i) => {
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

    const upgradeStr = h.up ? `${h.win} 升${h.up}级` : '不升级';
    lines.push([i + 1, h.ts, h.mode, h.combo, playerRankStr, upgradeStr, h.win, h.t1, h.t2, h.round, h.aNote].join(' | '));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '掼蛋战绩_v9.txt';
  a.click();

  showExportMessage('已导出 TXT');
}

/**
 * Export game history as CSV
 */
export function exportCSV() {
  const history = state.getHistory();
  const t1Name = config.getTeamName('t1');
  const t2Name = config.getTeamName('t2');
  const strictA = config.getPreference('strictA');

  const rows = [
    ['#', '时间', '人数', '胜方组合', '玩家排名', '升级情况', '胜队', `${t1Name}级`, `${t2Name}级`, '本局级', 'A说明', 'A级规则']
  ];

  history.forEach((h, i) => {
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

    const upgradeStr = h.up ? `${h.win} 升${h.up}级` : '不升级';
    rows.push([i + 1, h.ts, h.mode, h.combo, playerRankStr, upgradeStr, h.win, h.t1, h.t2, h.round, h.aNote, strictA ? '严格' : '宽松']);
  });

  const lines = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '掼蛋战绩_v9.csv';
  a.click();

  showExportMessage('已导出 CSV');
}

/**
 * Export game history as PNG long image
 */
export function exportLongPNG() {
  const longCnv = $('longCnv');
  if (!longCnv) {
    console.error('Canvas element not found');
    return;
  }

  const ctx = longCnv.getContext('2d');
  const history = state.getHistory();
  const t1Name = config.getTeamName('t1');
  const t2Name = config.getTeamName('t2');
  const t1Color = config.getTeamColor('t1');
  const t2Color = config.getTeamColor('t2');

  // Canvas dimensions
  const W = 2200;
  const headH = 220;
  const rowH = 40;
  const n = history.length;
  const H = headH + (n + 1) * rowH + 80;

  longCnv.width = W;
  longCnv.height = H;

  // Background
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = '#f5f6f8';
  ctx.font = 'bold 48px Arial';
  ctx.fillText('掼蛋战绩总览 v9.0', 40, 70);

  ctx.font = '20px Arial';
  ctx.fillStyle = '#b4b8bf';
  ctx.fillText(`当前本局级牌：${state.getRoundLevel()}｜下局预览：${state.getNextRoundBase() || '—'}｜A级规则：${config.getPreference('strictA') ? '严格模式' : '宽松模式'}`, 40, 110);
  ctx.fillText(`队伍：${t1Name}（${state.getTeamLevel('t1')}，A${state.getTeamAFail('t1')}/3） | ${t2Name}（${state.getTeamLevel('t2')}，A${state.getTeamAFail('t2')}/3）`, 40, 140);
  ctx.fillText(`生成时间：${now()}`, 40, 170);

  // Table header
  const cols = ['#', '时间', '人数', '胜方组合', '玩家排名', '升级', '胜队', `${t1Name}级`, `${t2Name}级`, '本局级', 'A说明'];
  const xs = [40, 80, 240, 300, 440, 700, 800, 900, 1000, 1100, 1200];
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#e6b800';
  for (let c = 0; c < cols.length; c++) {
    ctx.fillText(cols[c], xs[c], headH);
  }

  // Table rows
  ctx.font = '14px Arial';
  history.forEach((h, i) => {
    const y = headH + (i + 1) * rowH;

    // Row background
    const winColor = h.winKey === 't1' ? t1Color : t2Color;
    ctx.fillStyle = winColor + '10';
    ctx.fillRect(0, y - rowH + 10, W, rowH);

    // Player ranking string
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

    const upgradeStr = h.up ? `${h.win} 升${h.up}` : '不升';
    const vals = [i + 1, h.ts.substring(0, 16), h.mode, h.combo, playerRankStr, upgradeStr, h.win, h.t1, h.t2, h.round, h.aNote || ''];

    // Draw text
    ctx.fillStyle = '#f5f6f8';
    for (let j = 0; j < vals.length; j++) {
      ctx.fillText(String(vals[j]), xs[j], y);
    }
  });

  // Download
  const a = document.createElement('a');
  a.href = longCnv.toDataURL('image/png');
  a.download = '掼蛋战绩_v9.png';
  a.click();

  showExportMessage('已导出 PNG');
}

/**
 * Show export success message
 */
function showExportMessage(message) {
  const exportTip = $('exportTip');
  if (exportTip) {
    exportTip.textContent = message;
    setTimeout(() => {
      exportTip.textContent = '';
    }, 1200);
  }
}

// Import mobile export statically to avoid dynamic import issues
import { exportMobilePNG as exportMobilePNGImpl } from './exportMobile.js';

/**
 * Export mobile PNG - NOW IMPLEMENTED!
 */
export function exportMobilePNG() {
  exportMobilePNGImpl();
}

/**
 * Share game (not yet implemented - placeholder)
 */
export function shareGame() {
  alert('分享功能开发中');
}

// Make exports globally accessible for HTML onclick and victory modal
if (typeof window !== 'undefined') {
  window.exportTXT = exportTXT;
  window.exportCSV = exportCSV;
  window.exportLongPNG = exportLongPNG;
  window.exportMobilePNG = exportMobilePNG;
  window.shareGame = shareGame;
  window.resetAll = () => {
    // This will be set by main.js
    console.warn('resetAll not yet initialized');
  };
}
