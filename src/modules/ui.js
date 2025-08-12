/**
 * UI rendering and display module
 */

import { $ } from '../utils/dom.js';

export class UIRenderer {
  constructor(playerManager, gameLogic) {
    this.playerManager = playerManager;
    this.gameLogic = gameLogic;
    this.initElements();
  }

  initElements() {
    this.elements = {
      // Team displays
      t1Name: $('t1Name'),
      t2Name: $('t2Name'),
      t1Lvl: $('t1Lvl'),
      t2Lvl: $('t2Lvl'),
      t1AState: $('t1AState'),
      t2AState: $('t2AState'),
      
      // Round info
      curRoundLvl: $('curRoundLvl'),
      nextRoundPreview: $('nextRoundPreview'),
      
      // Result displays
      headline: $('headline'),
      explain: $('explain'),
      winnerDisplay: $('winnerDisplay'),
      
      // History
      history: $('history'),
      
      // Statistics
      statsContainer: $('statsContainer'),
      
      // Messages
      applyTip: $('applyTip'),
      
      // Controls
      modeSel: $('modeSel'),
      autoNext: $('autoNext'),
      autoApply: $('autoApply'),
      strictA: $('strictA'),
      must1: $('must1')
    };
  }

  renderTeams() {
    const state = this.gameLogic.state;
    const levels = state.teamLevels;
    
    // Update team levels
    if (this.elements.t1Lvl) this.elements.t1Lvl.textContent = levels.A;
    if (this.elements.t2Lvl) this.elements.t2Lvl.textContent = levels.B;
    
    // Update A-level states
    const aStateA = levels.A === 'A' ? `A${state.aFails?.A || 0}/3` : '—';
    const aStateB = levels.B === 'A' ? `A${state.aFails?.B || 0}/3` : '—';
    
    if (this.elements.t1AState) this.elements.t1AState.textContent = aStateA;
    if (this.elements.t2AState) this.elements.t2AState.textContent = aStateB;
    
    // Update round level
    if (this.elements.curRoundLvl) {
      let roundTeamName = '';
      if (state.roundLevel === levels.A && state.roundLevel !== levels.B) {
        roundTeamName = ' (A队)';
      } else if (state.roundLevel === levels.B && state.roundLevel !== levels.A) {
        roundTeamName = ' (B队)';
      }
      this.elements.curRoundLvl.textContent = state.roundLevel + roundTeamName;
    }
    
    // Update next round preview
    if (this.elements.nextRoundPreview) {
      const nextRound = state.nextRoundBase || state.roundLevel || '-';
      this.elements.nextRoundPreview.textContent = nextRound;
    }
  }

  renderHistory() {
    if (!this.elements.history) return;
    
    const history = this.gameLogic.getHistory();
    const tbody = this.elements.history.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    history.forEach((entry, index) => {
      const row = document.createElement('tr');
      const winnerTeam = entry.winner;
      const bgColor = winnerTeam === 'A' ? '#ffcccc' : '#ccccff';
      
      row.style.backgroundColor = bgColor;
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${this.formatRanks(entry.ranks)}</td>
        <td>↑${entry.levelUp}</td>
        <td>${winnerTeam === 'A' ? 'A队' : 'B队'}</td>
        <td>A队:${entry.newLevels.A} B队:${entry.newLevels.B}</td>
        <td>${entry.roundLevel}</td>
        <td>
          <button onclick="window.guandanApp.rollback(${index})">回滚</button>
        </td>
      `;
      
      tbody.appendChild(row);
    });
  }

  renderStatistics() {
    if (!this.elements.statsContainer) return;
    
    const stats = this.calculateStatistics();
    
    this.elements.statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-item">
          <h4>玩家统计</h4>
          ${this.renderPlayerStats(stats.playerStats)}
        </div>
        <div class="stat-item">
          <h4>队伍统计</h4>
          ${this.renderTeamStats(stats.teamStats)}
        </div>
      </div>
    `;
  }

  calculateStatistics() {
    const history = this.gameLogic.getHistory();
    const playerStats = {};
    const teamStats = { A: { wins: 0, totalUp: 0 }, B: { wins: 0, totalUp: 0 } };
    
    // Initialize player stats
    this.playerManager.getPlayers().forEach(player => {
      playerStats[player.id] = {
        name: player.name,
        emoji: player.emoji,
        team: player.team,
        ranks: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
        avgRank: 0,
        winRate: 0
      };
    });
    
    // Process history
    history.forEach(entry => {
      teamStats[entry.winner].wins++;
      teamStats[entry.winner].totalUp += entry.levelUp;
      
      if (entry.playerRankings) {
        Object.entries(entry.playerRankings).forEach(([rank, playerData]) => {
          const playerId = playerData.id;
          if (playerStats[playerId]) {
            playerStats[playerId].ranks[rank]++;
          }
        });
      }
    });
    
    // Calculate averages
    const totalRounds = history.length;
    Object.values(playerStats).forEach(stat => {
      let totalRank = 0;
      let count = 0;
      Object.entries(stat.ranks).forEach(([rank, times]) => {
        totalRank += parseInt(rank) * times;
        count += times;
      });
      stat.avgRank = count > 0 ? (totalRank / count).toFixed(2) : '-';
      stat.winRate = totalRounds > 0 ? 
        ((teamStats[stat.team].wins / totalRounds) * 100).toFixed(1) : '0';
    });
    
    return { playerStats, teamStats };
  }

  renderPlayerStats(stats) {
    const rows = Object.values(stats).map(stat => `
      <tr>
        <td>${stat.emoji} ${stat.name}</td>
        <td>${stat.team}队</td>
        <td>${stat.avgRank}</td>
        <td>${stat.winRate}%</td>
      </tr>
    `).join('');
    
    return `
      <table class="stats-table">
        <thead>
          <tr>
            <th>玩家</th>
            <th>队伍</th>
            <th>平均排名</th>
            <th>胜率</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  renderTeamStats(stats) {
    const totalRounds = stats.A.wins + stats.B.wins;
    
    return `
      <table class="stats-table">
        <thead>
          <tr>
            <th>队伍</th>
            <th>胜场</th>
            <th>总升级</th>
            <th>胜率</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>A队</td>
            <td>${stats.A.wins}</td>
            <td>${stats.A.totalUp}</td>
            <td>${totalRounds > 0 ? ((stats.A.wins/totalRounds)*100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td>B队</td>
            <td>${stats.B.wins}</td>
            <td>${stats.B.totalUp}</td>
            <td>${totalRounds > 0 ? ((stats.B.wins/totalRounds)*100).toFixed(1) : 0}%</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  formatRanks(ranks) {
    return `(${ranks.join(',')})`;
  }

  showMessage(message, type = 'info') {
    if (this.elements.applyTip) {
      this.elements.applyTip.textContent = message;
      this.elements.applyTip.className = `message message-${type}`;
    }
  }

  updateResultDisplay(result) {
    if (this.elements.headline) {
      this.elements.headline.textContent = result.headline || '等待排名';
    }
    if (this.elements.explain) {
      this.elements.explain.textContent = result.explain || '';
    }
    if (this.elements.winnerDisplay) {
      this.elements.winnerDisplay.textContent = result.winner || '—';
    }
  }

  clear() {
    this.renderTeams();
    this.renderHistory();
    this.renderStatistics();
    this.updateResultDisplay({});
  }
}