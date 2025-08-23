/**
 * UI rendering and management module
 */

import { $ } from './utils.js';

export class UIManager {
  constructor(playerManager, settings) {
    this.playerManager = playerManager;
    this.settings = settings;
    this.elements = this.initElements();
  }
  
  /**
   * Initialize DOM element references
   */
  initElements() {
    return {
      // Game controls
      mode: $('mode'),
      must1: $('must1'),
      ruleHint: $('ruleHint'),
      tip: $('tip'),
      
      // Result display
      headline: $('headline'),
      explain: $('explain'),
      applyBtn: $('apply'),
      applyTip: $('applyTip'),
      advanceBtn: $('advance'),
      winnerDisplay: $('winnerDisplay'),
      
      // Settings checkboxes
      autoNext: $('autoNext'),
      autoApply: $('autoApply'),
      strictA: $('strictA'),
      
      // Team status
      t1Lvl: $('t1Lvl'),
      t2Lvl: $('t2Lvl'),
      t1A: $('t1A'),
      t2A: $('t2A'),
      t1AState: $('t1AState'),
      t2AState: $('t2AState'),
      t1NameChip: $('t1NameChip'),
      t2NameChip: $('t2NameChip'),
      
      // Round display
      curRoundLvl: $('curRoundLvl'),
      nextRoundPreview: $('nextRoundPreview'),
      hT1: $('hT1'),
      hT2: $('hT2'),
      
      // Player areas
      unassignedPlayers: $('unassignedPlayers'),
      team1Zone: $('team1Zone'),
      team2Zone: $('team2Zone'),
      playerPool: $('playerPool'),
      rankingArea: $('rankingArea'),
      
      // Statistics
      playerStatsBody: $('playerStatsBody'),
      team1MVP: $('team1MVP'),
      team1Burden: $('team1Burden'),
      team2MVP: $('team2MVP'),
      team2Burden: $('team2Burden'),
      team1Label: $('team1Label'),
      team2Label: $('team2Label'),
      team1StatsTitle: $('team1StatsTitle'),
      team2StatsTitle: $('team2StatsTitle'),
      
      // History
      histBody: $('histBody'),
      exportTip: $('exportTip'),
      
      // Canvas
      longCnv: $('longCnv')
    };
  }
  
  /**
   * Update team labels and colors
   */
  updateTeamLabels() {
    const { t1, t2 } = this.settings;
    
    // Update team names
    this.elements.t1NameChip.innerHTML = `<b>${t1.name}</b>`;
    this.elements.t2NameChip.innerHTML = `<b>${t2.name}</b>`;
    this.elements.team1Label.textContent = t1.name;
    this.elements.team2Label.textContent = t2.name;
    this.elements.team1StatsTitle.textContent = t1.name;
    this.elements.team2StatsTitle.textContent = t2.name;
    this.elements.hT1.textContent = t1.name;
    this.elements.hT2.textContent = t2.name;
    
    // Update team colors
    this.elements.t1NameChip.style.color = t1.color;
    this.elements.t2NameChip.style.color = t2.color;
    this.elements.team1Label.style.color = t1.color;
    this.elements.team2Label.style.color = t2.color;
  }
  
  /**
   * Update game state display
   * @param {Object} state - Game state object
   */
  updateGameState(state) {
    // Update team levels
    this.elements.t1Lvl.textContent = state.t1.lvl;
    this.elements.t2Lvl.textContent = state.t2.lvl;
    
    // Update A-level failure counts
    this.elements.t1A.textContent = state.t1.aFail;
    this.elements.t2A.textContent = state.t2.aFail;
    
    // Update A-level states
    this.elements.t1AState.textContent = state.t1.lvl === 'A' 
      ? (state.t1.aFail > 0 ? `A${state.t1.aFail}` : 'A') 
      : '—';
    this.elements.t2AState.textContent = state.t2.lvl === 'A' 
      ? (state.t2.aFail > 0 ? `A${state.t2.aFail}` : 'A') 
      : '—';
    
    // Update current round level
    this.elements.curRoundLvl.textContent = state.roundLevel;
    
    // Update next round preview
    if (state.nextRoundBase) {
      const nextTeam = state[state.nextRoundBase].lvl === state.roundLevel 
        ? state.nextRoundBase 
        : (state.t1.lvl === state.roundLevel ? 't1' : 't2');
      const teamName = nextTeam === 't1' ? this.settings.t1.name : this.settings.t2.name;
      this.elements.nextRoundPreview.textContent = `${state.roundLevel} (${teamName})`;
    } else {
      this.elements.nextRoundPreview.textContent = '—';
    }
  }
  
  /**
   * Update rule hint based on game mode
   */
  updateRuleHint() {
    const mode = this.elements.mode.value;
    const { c4, t6, t8 } = this.settings;
    
    if (mode === '4') {
      this.elements.ruleHint.textContent = 
        `4人：固定表 (${c4['1,2']},${c4['1,3']},${c4['1,4']})`;
    } else if (mode === '6') {
      this.elements.ruleHint.textContent = 
        `6人：分差≥${t6.g3} 升3；≥${t6.g2} 升2；≥${t6.g1} 升1`;
    } else {
      this.elements.ruleHint.textContent = 
        `8人：分差≥${t8.g3} 升3；≥${t8.g2} 升2；≥${t8.g1} 升1`;
    }
  }
  
  /**
   * Display calculation result
   * @param {Object} result - Calculation result
   */
  displayResult(result) {
    if (!result.ok) {
      this.elements.headline.textContent = '—';
      this.elements.explain.textContent = result.msg || '等待输入…';
      this.elements.winnerDisplay.textContent = '—';
      return;
    }
    
    this.elements.headline.textContent = result.msg;
    this.elements.explain.textContent = result.detail || '';
    
    if (result.winner === 't1') {
      this.elements.winnerDisplay.textContent = this.settings.t1.name;
      this.elements.winnerDisplay.style.color = this.settings.t1.color;
    } else if (result.winner === 't2') {
      this.elements.winnerDisplay.textContent = this.settings.t2.name;
      this.elements.winnerDisplay.style.color = this.settings.t2.color;
    } else {
      this.elements.winnerDisplay.textContent = '—';
      this.elements.winnerDisplay.style.color = '';
    }
  }
  
  /**
   * Render player statistics table
   */
  renderPlayerStats() {
    const tbody = this.elements.playerStatsBody;
    tbody.innerHTML = '';
    
    // Collect player data with stats
    const playerData = this.playerManager.players.map(player => {
      const stats = this.playerManager.getPlayerStats(player.id);
      return {
        player,
        stats,
        avgRank: stats.games > 0 ? (stats.totalRank / stats.games).toFixed(2) : '—'
      };
    });
    
    // Sort by team first, then by average rank
    playerData.sort((a, b) => {
      if (a.player.team !== b.player.team) {
        return (a.player.team || 0) - (b.player.team || 0);
      }
      if (a.stats.games === 0) return 1;
      if (b.stats.games === 0) return -1;
      return a.stats.totalRank / a.stats.games - b.stats.totalRank / b.stats.games;
    });
    
    // Render rows
    if (playerData.length === 0 || playerData.every(d => d.stats.games === 0)) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted small">暂无数据</td></tr>';
      return;
    }
    
    playerData.forEach(({ player, stats, avgRank }) => {
      const row = document.createElement('tr');
      
      // Add team background color
      if (player.team) {
        const color = player.team === 1 ? this.settings.t1.color : this.settings.t2.color;
        row.style.backgroundColor = this.hexToRgba(color, 0.05);
      }
      
      row.innerHTML = `
        <td><span class="emoji">${player.emoji}</span> ${player.name}</td>
        <td>${player.team ? (player.team === 1 ? this.settings.t1.name : this.settings.t2.name) : '—'}</td>
        <td>${stats.games}</td>
        <td>${avgRank}</td>
        <td>${stats.firstPlace}</td>
        <td>${stats.lastPlace}</td>
      `;
      
      tbody.appendChild(row);
    });
  }
  
  /**
   * Render team MVP and burden
   */
  renderTeamMVP() {
    // Team 1 MVP and Burden
    const mvp1 = this.playerManager.getTeamMVP(1);
    const burden1 = this.playerManager.getTeamBurden(1);
    
    if (mvp1) {
      const stats = this.playerManager.getPlayerStats(mvp1.id);
      const avg = (stats.totalRank / stats.games).toFixed(2);
      this.elements.team1MVP.innerHTML = `${mvp1.emoji} ${mvp1.name} (${avg})`;
    } else {
      this.elements.team1MVP.textContent = '—';
    }
    
    if (burden1) {
      const stats = this.playerManager.getPlayerStats(burden1.id);
      const avg = (stats.totalRank / stats.games).toFixed(2);
      this.elements.team1Burden.innerHTML = `${burden1.emoji} ${burden1.name} (${avg})`;
    } else {
      this.elements.team1Burden.textContent = '—';
    }
    
    // Team 2 MVP and Burden
    const mvp2 = this.playerManager.getTeamMVP(2);
    const burden2 = this.playerManager.getTeamBurden(2);
    
    if (mvp2) {
      const stats = this.playerManager.getPlayerStats(mvp2.id);
      const avg = (stats.totalRank / stats.games).toFixed(2);
      this.elements.team2MVP.innerHTML = `${mvp2.emoji} ${mvp2.name} (${avg})`;
    } else {
      this.elements.team2MVP.textContent = '—';
    }
    
    if (burden2) {
      const stats = this.playerManager.getPlayerStats(burden2.id);
      const avg = (stats.totalRank / stats.games).toFixed(2);
      this.elements.team2Burden.innerHTML = `${burden2.emoji} ${burden2.name} (${avg})`;
    } else {
      this.elements.team2Burden.textContent = '—';
    }
  }
  
  /**
   * Show victory modal
   * @param {string} teamName - Winning team name
   * @param {string} teamColor - Winning team color
   */
  showVictoryModal(teamName, teamColor) {
    const modal = $('victoryModal');
    const teamNameEl = $('victoryTeamName');
    const modalContent = modal.querySelector('div > div');
    
    teamNameEl.textContent = teamName;
    teamNameEl.style.color = teamColor;
    modalContent.style.borderColor = teamColor;
    
    modal.style.display = 'flex';
  }
  
  /**
   * Hide victory modal
   */
  hideVictoryModal() {
    const modal = $('victoryModal');
    modal.style.display = 'none';
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
   * Clear result display
   */
  clearResult() {
    this.elements.headline.textContent = '—';
    this.elements.explain.textContent = '等待输入…';
    this.elements.winnerDisplay.textContent = '—';
    this.elements.winnerDisplay.style.color = '';
  }
  
  /**
   * Set tip message
   * @param {string} message - Tip message
   */
  setTip(message) {
    this.elements.tip.textContent = message;
  }
  
  /**
   * Set apply tip message
   * @param {string} message - Apply tip message
   */
  setApplyTip(message) {
    this.elements.applyTip.textContent = message;
  }
  
  /**
   * Set export tip message
   * @param {string} message - Export tip message
   */
  setExportTip(message) {
    this.elements.exportTip.textContent = message;
  }
}