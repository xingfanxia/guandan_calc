// Voting system management for room viewers and hosts
// UTF-8 encoding for Chinese characters

import { $, now } from '../utils/dom.js';

class VotingManager {
  constructor(roomManager) {
    this.roomManager = roomManager;
    this.currentRoundId = null;
    this.hasVoted = false;
    this.selectedMvp = null;
    this.selectedBurden = null;
  }

  /**
   * Show voting section for room mode
   */
  showVotingSection() {
    const votingSection = $('votingSection');
    if (votingSection) {
      votingSection.style.display = 'block';
      
      if (this.roomManager.isViewer) {
        this.showViewerVoting();
      } else if (this.roomManager.isHost) {
        this.showHostVoting();
      }
      
      this.loadVotingStats();
    }
  }

  /**
   * Show voting interface for viewers
   */
  showViewerVoting() {
    const voterInterface = $('voterInterface');
    const hostInterface = $('hostVotingInterface');
    
    if (voterInterface) voterInterface.style.display = 'block';
    if (hostInterface) hostInterface.style.display = 'none';
    
    this.generateVotingOptions();
    this.setupVotingEvents();
  }

  /**
   * Show voting results interface for hosts
   */
  showHostVoting() {
    const voterInterface = $('voterInterface');
    const hostInterface = $('hostVotingInterface');
    
    if (voterInterface) voterInterface.style.display = 'none';
    if (hostInterface) hostInterface.style.display = 'block';
    
    this.loadVotingResults();
    this.setupHostVotingEvents();
  }

  /**
   * Generate voting options for current players
   */
  generateVotingOptions() {
    const mvpOptions = $('mvpVotingOptions');
    const burdenOptions = $('burdenVotingOptions');
    
    if (!mvpOptions || !burdenOptions) return;
    
    // Clear existing options
    mvpOptions.innerHTML = '';
    burdenOptions.innerHTML = '';
    
    // Generate options for each player
    this.roomManager.gameState.players.forEach(player => {
      if (player.team) { // Only include assigned players
        // MVP option
        const mvpOption = document.createElement('div');
        mvpOption.className = 'vote-option';
        mvpOption.style.cssText = `
          padding: 8px 12px; margin: 4px; background: #2a2b2c; 
          border-radius: 6px; cursor: pointer; border: 2px solid transparent;
          display: flex; align-items: center; gap: 8px;
        `;
        mvpOption.innerHTML = `<span class="emoji">${player.emoji}</span>${player.name}`;
        mvpOption.onclick = () => this.selectMvp(player.id, mvpOption);
        mvpOptions.appendChild(mvpOption);
        
        // Burden option  
        const burdenOption = document.createElement('div');
        burdenOption.className = 'vote-option';
        burdenOption.style.cssText = mvpOption.style.cssText;
        burdenOption.innerHTML = `<span class="emoji">${player.emoji}</span>${player.name}`;
        burdenOption.onclick = () => this.selectBurden(player.id, burdenOption);
        burdenOptions.appendChild(burdenOption);
      }
    });
  }

  /**
   * Select MVP vote
   * @param {number} playerId - Player ID
   * @param {HTMLElement} element - Clicked element
   */
  selectMvp(playerId, element) {
    // Clear previous selection
    document.querySelectorAll('#mvpVotingOptions .vote-option').forEach(opt => {
      opt.style.borderColor = 'transparent';
    });
    
    // Highlight selection
    element.style.borderColor = '#22c55e';
    this.selectedMvp = playerId;
    
    this.updateSubmitButton();
  }

  /**
   * Select burden vote
   * @param {number} playerId - Player ID
   * @param {HTMLElement} element - Clicked element
   */
  selectBurden(playerId, element) {
    // Clear previous selection
    document.querySelectorAll('#burdenVotingOptions .vote-option').forEach(opt => {
      opt.style.borderColor = 'transparent';
    });
    
    // Highlight selection
    element.style.borderColor = '#ef4444';
    this.selectedBurden = playerId;
    
    this.updateSubmitButton();
  }

  /**
   * Update submit button state
   */
  updateSubmitButton() {
    const submitBtn = $('submitVote');
    if (submitBtn) {
      if (this.selectedMvp && this.selectedBurden && this.selectedMvp !== this.selectedBurden) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.textContent = '🗳️ 提交投票';
      } else {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.textContent = this.selectedMvp === this.selectedBurden ? 
          '❌ 最C和最闹不能是同一人' : '⏳ 请选择最C和最闹';
      }
    }
  }

  /**
   * Submit vote to server
   */
  async submitVote() {
    if (!this.selectedMvp || !this.selectedBurden || this.selectedMvp === this.selectedBurden) {
      return;
    }

    try {
      const roundId = `round_${Date.now()}`;
      
      const response = await fetch(`/api/rooms/vote/${this.roomManager.currentRoomCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mvpPlayerId: this.selectedMvp,
          burdenPlayerId: this.selectedBurden,
          roundId: roundId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        this.hasVoted = true;
        this.showVoteSuccess();
      } else {
        alert('投票失败：' + result.error);
      }
    } catch (error) {
      console.error('Vote submission failed:', error);
      alert('投票失败：网络错误');
    }
  }

  /**
   * Show vote success message
   */
  showVoteSuccess() {
    const voterInterface = $('voterInterface');
    if (voterInterface) {
      voterInterface.innerHTML = `
        <div style="text-align:center; padding:40px;">
          <h3 style="color:#22c55e;">✅ 投票成功！</h3>
          <p style="color:#999;">感谢您的参与，等待房主确认结果</p>
        </div>
      `;
    }
  }

  /**
   * Load and display voting results for host
   */
  async loadVotingResults() {
    try {
      const response = await fetch(`/api/rooms/vote/${this.roomManager.currentRoomCode}`);
      const result = await response.json();
      
      if (result.success && result.voting.currentRound) {
        this.displayVotingResults(result.voting.currentRound.results);
      }
    } catch (error) {
      console.error('Failed to load voting results:', error);
    }
  }

  /**
   * Display voting results for host
   * @param {Object} results - Voting results
   */
  displayVotingResults(results) {
    const resultsDiv = $('votingResults');
    if (!resultsDiv) return;
    
    let resultsHTML = '<div class="grid" style="grid-template-columns: 1fr 1fr; gap:20px;">';
    
    // MVP votes
    resultsHTML += '<div><h5 style="color:#22c55e;">最C投票结果</h5>';
    const mvpVotes = Object.entries(results.mvp || {}).sort((a, b) => b[1] - a[1]);
    mvpVotes.forEach(([playerId, votes]) => {
      const player = this.roomManager.gameState.players.find(p => p.id === parseInt(playerId));
      if (player) {
        resultsHTML += `<div style="padding:8px; background:#2a2b2c; border-radius:4px; margin:4px;">
          ${player.emoji} ${player.name}: ${votes} 票</div>`;
      }
    });
    resultsHTML += '</div>';
    
    // Burden votes
    resultsHTML += '<div><h5 style="color:#ef4444;">最闹投票结果</h5>';
    const burdenVotes = Object.entries(results.burden || {}).sort((a, b) => b[1] - a[1]);
    burdenVotes.forEach(([playerId, votes]) => {
      const player = this.roomManager.gameState.players.find(p => p.id === parseInt(playerId));
      if (player) {
        resultsHTML += `<div style="padding:8px; background:#2a2b2c; border-radius:4px; margin:4px;">
          ${player.emoji} ${player.name}: ${votes} 票</div>`;
      }
    });
    resultsHTML += '</div></div>';
    
    resultsDiv.innerHTML = resultsHTML;
  }

  /**
   * Load voting statistics
   */
  async loadVotingStats() {
    try {
      const response = await fetch(`/api/rooms/vote/${this.roomManager.currentRoomCode}`);
      const result = await response.json();
      
      if (result.success && result.voting.playerStats) {
        this.displayVotingStats(result.voting.playerStats);
      }
    } catch (error) {
      console.error('Failed to load voting stats:', error);
    }
  }

  /**
   * Display voting statistics
   * @param {Object} playerStats - Player voting statistics
   */
  displayVotingStats(playerStats) {
    const mvpTable = $('mvpStatsTable');
    const burdenTable = $('burdenStatsTable');
    
    if (!mvpTable || !burdenTable) return;
    
    // MVP stats
    const mvpStats = [];
    const burdenStats = [];
    
    Object.entries(playerStats).forEach(([playerId, stats]) => {
      const player = this.roomManager.gameState.players.find(p => p.id === parseInt(playerId));
      if (player) {
        mvpStats.push({ player, votes: stats.mvpVotes || 0 });
        burdenStats.push({ player, votes: stats.burdenVotes || 0 });
      }
    });
    
    // Sort and display MVP stats
    mvpStats.sort((a, b) => b.votes - a.votes);
    mvpTable.innerHTML = mvpStats.map(stat => 
      `<div style="display:flex; justify-content:space-between; padding:4px;">
        <span>${stat.player.emoji} ${stat.player.name}</span>
        <span style="color:#22c55e;">${stat.votes}次</span>
      </div>`
    ).join('');
    
    // Sort and display burden stats
    burdenStats.sort((a, b) => b.votes - a.votes);
    burdenTable.innerHTML = burdenStats.map(stat => 
      `<div style="display:flex; justify-content:space-between; padding:4px;">
        <span>${stat.player.emoji} ${stat.player.name}</span>
        <span style="color:#ef4444;">${stat.votes}次</span>
      </div>`
    ).join('');
  }

  /**
   * Setup voting event listeners
   */
  setupVotingEvents() {
    const submitBtn = $('submitVote');
    if (submitBtn) {
      submitBtn.onclick = () => this.submitVote();
    }
  }

  /**
   * Setup host voting event listeners
   */
  setupHostVotingEvents() {
    const confirmBtn = $('confirmHostSelection');
    if (confirmBtn) {
      confirmBtn.onclick = () => this.confirmHostSelection();
    }
  }

  /**
   * Host confirms voting selection
   */
  async confirmHostSelection() {
    // Implementation for host selection confirmation
    alert('房主确认功能开发中...');
  }
}

export default VotingManager;