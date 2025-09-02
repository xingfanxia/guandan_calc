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
      
      this.displayVotingStats(); // Use local stats instead of API
      
      // Start real-time voting updates for hosts
      if (this.roomManager.isHost) {
        this.startVotingPolling();
      }
    }
  }

  /**
   * Start polling for voting updates (host only)
   */
  startVotingPolling() {
    // Poll for voting updates every 1 second for real-time feel
    this.votingPollInterval = setInterval(() => {
      this.loadVotingResults();
    }, 1000);
  }

  /**
   * Stop voting polling
   */
  stopVotingPolling() {
    if (this.votingPollInterval) {
      clearInterval(this.votingPollInterval);
      this.votingPollInterval = null;
    }
  }

  /**
   * Show voting interface for viewers
   */
  showViewerVoting() {
    const voterInterface = $('voterInterface');
    const hostInterface = $('hostVotingInterface');
    
    // Check if current round is already confirmed
    const gameRoundNumber = this.roomManager.gameState.state.hist.length;
    const roundId = `round_${gameRoundNumber}`;
    
    if (gameRoundNumber === 0) {
      // No rounds completed yet
      if (voterInterface) {
        voterInterface.innerHTML = `
          <div style="text-align:center; padding:40px;">
            <h3 style="color:#999;">⏳ 等待第一局游戏完成</h3>
            <p style="color:#666;">游戏开始后即可投票</p>
          </div>
        `;
        voterInterface.style.display = 'block';
      }
      if (hostInterface) hostInterface.style.display = 'none';
      return;
    }
    
    if (this.confirmedRounds && this.confirmedRounds.includes(roundId)) {
      // This round already confirmed
      if (voterInterface) {
        voterInterface.innerHTML = `
          <div style="text-align:center; padding:40px;">
            <h3 style="color:#22c55e;">✅ 第${gameRoundNumber}局投票已结束</h3>
            <p style="color:#999;">等待下一局游戏开始新的投票</p>
          </div>
        `;
        voterInterface.style.display = 'block';
      }
      if (hostInterface) hostInterface.style.display = 'none';
      return;
    }
    
    // Active voting for current round
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
      // Vote for the most recently completed round (not the next round)
      const gameRoundNumber = this.roomManager.gameState.state.hist.length;
      const roundId = `round_${gameRoundNumber}`;
      
      // Don't allow voting if no rounds completed yet
      if (gameRoundNumber === 0) {
        alert('还没有完成的比赛局数可供投票');
        return;
      }
      
      const response = await fetch(`/api/rooms/vote/${this.roomManager.currentRoomCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mvpPlayerId: this.selectedMvp,
          burdenPlayerId: this.selectedBurden,
          roundId: roundId,
          gameRoundNumber: gameRoundNumber
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
      // First try to get from room data if available
      if (this.roomManager.votingData && this.roomManager.votingData.currentRound) {
        this.displayVotingResults(this.roomManager.votingData.currentRound.results);
      }
      
      // Also fetch latest from API
      const response = await fetch(`/api/rooms/vote/${this.roomManager.currentRoomCode}`);
      const result = await response.json();
      
      if (result.success) {
        // Update local voting data
        this.roomManager.votingData = result.voting;
        
        if (result.voting.currentRound) {
          this.displayVotingResults(result.voting.currentRound.results);
        }
      }
    } catch (error) {
      console.error('Failed to load voting results:', error);
      // Fallback to local data if available
      if (this.roomManager.votingData && this.roomManager.votingData.currentRound) {
        this.displayVotingResults(this.roomManager.votingData.currentRound.results);
      }
    }
  }

  /**
   * Display voting results for host with selection interface
   * @param {Object} results - Voting results
   */
  displayVotingResults(results) {
    const resultsDiv = $('votingResults');
    if (!resultsDiv) return;
    
    // Store results for later use in click handlers
    this.lastVotingResults = results;
    
    // Remember current selections before re-rendering
    const previousMvpSelection = this.hostSelectedMvp;
    const previousBurdenSelection = this.hostSelectedBurden;
    
    let resultsHTML = '<div class="grid" style="grid-template-columns: 1fr 1fr; gap:20px;">';
    
    // MVP selection with voting results
    resultsHTML += '<div><h5 style="color:#22c55e;">选择最C (参考观众投票)</h5>';
    resultsHTML += '<div id="hostMvpSelection" style="margin-bottom:10px;">';
    
    this.roomManager.gameState.players.forEach(player => {
      if (player.team) {
        const votes = results.mvp?.[player.id] || 0;
        const isTopVoted = this.isTopVoted(player.id, results.mvp);
        resultsHTML += `
          <div class="host-vote-option" data-player-id="${player.id}" data-type="mvp" 
               style="padding:8px 12px; margin:4px; background:${isTopVoted ? '#22c55e20' : '#2a2b2c'}; 
                      border-radius:6px; cursor:pointer; border:2px solid ${isTopVoted ? '#22c55e' : 'transparent'};
                      display:flex; justify-content:space-between; align-items:center;">
            <span>${player.emoji} ${player.name}</span>
            <span style="color:#22c55e; font-weight:bold;">${votes} 票 ${isTopVoted ? '🔥' : ''}</span>
          </div>
        `;
      }
    });
    resultsHTML += '</div></div>';
    
    // Burden selection with voting results
    resultsHTML += '<div><h5 style="color:#ef4444;">选择最闹 (参考观众投票)</h5>';
    resultsHTML += '<div id="hostBurdenSelection" style="margin-bottom:10px;">';
    
    this.roomManager.gameState.players.forEach(player => {
      if (player.team) {
        const votes = results.burden?.[player.id] || 0;
        const isTopVoted = this.isTopVoted(player.id, results.burden);
        resultsHTML += `
          <div class="host-vote-option" data-player-id="${player.id}" data-type="burden"
               style="padding:8px 12px; margin:4px; background:${isTopVoted ? '#ef444420' : '#2a2b2c'}; 
                      border-radius:6px; cursor:pointer; border:2px solid ${isTopVoted ? '#ef4444' : 'transparent'};
                      display:flex; justify-content:space-between; align-items:center;">
            <span>${player.emoji} ${player.name}</span>
            <span style="color:#ef4444; font-weight:bold;">${votes} 票 ${isTopVoted ? '🔥' : ''}</span>
          </div>
        `;
      }
    });
    resultsHTML += '</div></div>';
    resultsHTML += '</div>';
    
    resultsDiv.innerHTML = resultsHTML;
    
    // Add click handlers for host selection
    this.setupHostSelectionHandlers();
    
    // Restore previous selections if they existed
    if (previousMvpSelection) {
      const mvpElement = document.querySelector(`.host-vote-option[data-player-id="${previousMvpSelection}"][data-type="mvp"]`);
      if (mvpElement) {
        this.highlightHostSelection(mvpElement, 'mvp');
        this.hostSelectedMvp = previousMvpSelection;
      }
    }
    
    if (previousBurdenSelection) {
      const burdenElement = document.querySelector(`.host-vote-option[data-player-id="${previousBurdenSelection}"][data-type="burden"]`);
      if (burdenElement) {
        this.highlightHostSelection(burdenElement, 'burden');
        this.hostSelectedBurden = previousBurdenSelection;
      }
    }
    
    // Update confirm button state
    this.updateHostConfirmButton();
  }

  /**
   * Check if player has top votes in category
   * @param {number} playerId - Player ID
   * @param {Object} votes - Vote counts
   * @returns {boolean} Is top voted
   */
  isTopVoted(playerId, votes) {
    if (!votes || Object.keys(votes).length === 0) return false;
    
    const maxVotes = Math.max(...Object.values(votes));
    return votes[playerId] === maxVotes && maxVotes > 0;
  }

  /**
   * Setup host selection click handlers
   */
  setupHostSelectionHandlers() {
    document.querySelectorAll('.host-vote-option').forEach(option => {
      option.onclick = () => {
        const playerId = parseInt(option.dataset.playerId);
        const type = option.dataset.type;
        
        // Get current results for this displayVotingResults call
        const currentResults = this.lastVotingResults || { mvp: {}, burden: {} };
        
        // Clear previous selections of same type
        document.querySelectorAll(`.host-vote-option[data-type="${type}"]`).forEach(opt => {
          // Reset to original appearance
          const votes = currentResults[type === 'mvp' ? 'mvp' : 'burden'];
          const isTopVoted = this.isTopVoted(opt.dataset.playerId, votes);
          
          if (isTopVoted) {
            // Keep top-voted appearance
            opt.style.borderColor = type === 'mvp' ? '#22c55e' : '#ef4444';
            opt.style.borderWidth = '2px';
            opt.style.background = type === 'mvp' ? '#22c55e20' : '#ef444420';
          } else {
            // Reset to normal
            opt.style.borderColor = 'transparent';
            opt.style.borderWidth = '2px';
            opt.style.background = '#2a2b2c';
          }
        });
        
        // Highlight host selection with strong visual indicator
        this.highlightHostSelection(option, type);
        
        // Store selection
        if (type === 'mvp') {
          this.hostSelectedMvp = playerId;
        } else {
          this.hostSelectedBurden = playerId;
        }
        
        this.updateHostConfirmButton();
      };
    });
  }

  /**
   * Apply host selection highlighting
   * @param {HTMLElement} element - Element to highlight
   * @param {string} type - 'mvp' or 'burden'
   */
  highlightHostSelection(element, type) {
    element.style.borderColor = type === 'mvp' ? '#22c55e' : '#ef4444';
    element.style.borderWidth = '4px';
    element.style.background = type === 'mvp' ? '#22c55e40' : '#ef444440';
    element.style.boxShadow = `0 0 10px ${type === 'mvp' ? '#22c55e' : '#ef4444'}80`;
  }

  /**
   * Update host confirm button state
   */
  updateHostConfirmButton() {
    const confirmBtn = $('confirmHostSelection');
    if (confirmBtn) {
      if (this.hostSelectedMvp && this.hostSelectedBurden && this.hostSelectedMvp !== this.hostSelectedBurden) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.textContent = '✅ 确认选择';
      } else {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.textContent = this.hostSelectedMvp === this.hostSelectedBurden ? 
          '❌ 最C和最闹不能是同一人' : '⏳ 请选择最C和最闹';
      }
    }
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
   * Display voting statistics using local player stats
   */
  displayVotingStats() {
    const mvpTable = $('mvpStatsTable');
    const burdenTable = $('burdenStatsTable');
    
    if (!mvpTable || !burdenTable) return;
    
    // Get community vote stats from player stats
    const mvpStats = [];
    const burdenStats = [];
    
    this.roomManager.gameState.players.forEach(player => {
      const stats = this.roomManager.gameState.playerStats[player.id] || {};
      const communityMvpCount = stats.communityMvpCount || 0;
      const communityBurdenCount = stats.communityBurdenCount || 0;
      
      if (communityMvpCount > 0) {
        mvpStats.push({ player, votes: communityMvpCount });
      }
      if (communityBurdenCount > 0) {
        burdenStats.push({ player, votes: communityBurdenCount });
      }
    });
    
    // Sort by votes
    mvpStats.sort((a, b) => b.votes - a.votes);
    burdenStats.sort((a, b) => b.votes - a.votes);
    
    // Display MVP stats
    mvpTable.innerHTML = mvpStats.length > 0 ? 
      mvpStats.map(stat => 
        `<div style="display:flex; justify-content:space-between; padding:4px;">
          <span>${stat.player.emoji} ${stat.player.name}</span>
          <span style="color:#22c55e;">${stat.votes}次</span>
        </div>`
      ).join('') : '<div style="color:#888; padding:8px;">暂无数据</div>';
    
    // Display burden stats  
    burdenTable.innerHTML = burdenStats.length > 0 ?
      burdenStats.map(stat => 
        `<div style="display:flex; justify-content:space-between; padding:4px;">
          <span>${stat.player.emoji} ${stat.player.name}</span>
          <span style="color:#ef4444;">${stat.votes}次</span>
        </div>`
      ).join('') : '<div style="color:#888; padding:8px;">暂无数据</div>';
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
    if (!this.hostSelectedMvp || !this.hostSelectedBurden || this.hostSelectedMvp === this.hostSelectedBurden) {
      alert('请先选择最C和最闹');
      return;
    }

    // Check if this round has already been confirmed (using persistent storage)
    const gameRoundNumber = this.roomManager.gameState.state.hist.length;
    const roundId = `round_${gameRoundNumber}`;
    
    // Check in voting data (persistent) instead of local confirmedRounds
    const votingData = this.roomManager.votingData || {};
    console.log('Full voting data structure:', votingData);
    console.log('Voting data rounds:', votingData.rounds);
    console.log('Voting data allRounds:', votingData.allRounds);
    console.log('Looking for round ID:', roundId);
    
    // Try both possible data structures
    const roundData = votingData.rounds?.[roundId] || votingData.allRounds?.[roundId];
    
    console.log('Checking confirmation for round:', roundId);
    console.log('Round data:', roundData);
    console.log('Already confirmed?', roundData?.confirmed);
    
    if (roundData && roundData.confirmed) {
      alert(`第${gameRoundNumber}局的最C和最闹已经确认过了`);
      return;
    }

    try {
      const mvpPlayer = this.roomManager.gameState.players.find(p => p.id === this.hostSelectedMvp);
      const burdenPlayer = this.roomManager.gameState.players.find(p => p.id === this.hostSelectedBurden);
      
      if (confirm(`确认第${gameRoundNumber}局最终结果？\n\n最C: ${mvpPlayer.emoji} ${mvpPlayer.name}\n最闹: ${burdenPlayer.emoji} ${burdenPlayer.name}\n\n(将记录到玩家统计，此局投票将结束)`)) {
        // Record community vote
        await this.recordCommunityVote(this.hostSelectedMvp, this.hostSelectedBurden);
        
        // Mark this round as confirmed in persistent data (handle both data structures)
        if (!this.roomManager.votingData.rounds && !this.roomManager.votingData.allRounds) {
          this.roomManager.votingData.rounds = {};
        }
        
        // Use allRounds if that's the structure, otherwise use rounds
        const roundsObject = this.roomManager.votingData.allRounds || this.roomManager.votingData.rounds;
        
        if (!roundsObject[roundId]) {
          roundsObject[roundId] = { votes: {}, results: { mvp: {}, burden: {} } };
        }
        
        roundsObject[roundId].confirmed = true;
        roundsObject[roundId].confirmedAt = new Date().toISOString();
        roundsObject[roundId].finalMvp = this.hostSelectedMvp;
        roundsObject[roundId].finalBurden = this.hostSelectedBurden;
        
        console.log('Marked round as confirmed:', roundId, roundsObject[roundId]);
        
        // Sync confirmation to server immediately (CRITICAL)
        if (this.roomManager.isHost) {
          console.log('Syncing confirmation to server...');
          this.roomManager.forcingSync = true; // Prevent data fetch during confirmation sync
          const syncResult = await this.roomManager.syncNow(); 
          this.roomManager.forcingSync = false;
          console.log('Sync result:', syncResult);
          
          // Verify sync worked by re-fetching room data
          setTimeout(async () => {
            const verifyResponse = await fetch(`/api/rooms/${this.roomManager.currentRoomCode}`);
            const verifyResult = await verifyResponse.json();
            if (verifyResult.success) {
              const confirmedInServer = verifyResult.data.voting?.rounds?.[roundId]?.confirmed || 
                                      verifyResult.data.voting?.allRounds?.[roundId]?.confirmed;
              console.log('Server confirmation verification:', confirmedInServer);
            }
          }, 1000);
        }
        
        // Reset voting for next round
        await this.resetCurrentVoting();
        
        alert(`✅ 第${gameRoundNumber}局最C和最闹已确认并记录`);
        
        // Show voting completed message
        this.showVotingCompleted(gameRoundNumber, mvpPlayer, burdenPlayer);
      }
    } catch (error) {
      console.error('Confirm selection failed:', error);
      alert('确认失败：' + error.message);
    }
  }

  /**
   * Show voting completed interface
   * @param {number} roundNumber - Round number
   * @param {Object} mvpPlayer - MVP player
   * @param {Object} burdenPlayer - Burden player
   */
  showVotingCompleted(roundNumber, mvpPlayer, burdenPlayer) {
    const hostInterface = document.getElementById('hostVotingInterface');
    if (hostInterface) {
      hostInterface.innerHTML = `
        <div style="text-align:center; padding:40px;">
          <h3 style="color:#22c55e;">✅ 第${roundNumber}局投票已确认</h3>
          <div style="margin:20px 0;">
            <div style="color:#22c55e; margin:8px 0;">最C: ${mvpPlayer.emoji} ${mvpPlayer.name}</div>
            <div style="color:#ef4444; margin:8px 0;">最闹: ${burdenPlayer.emoji} ${burdenPlayer.name}</div>
          </div>
          <p style="color:#999;">等待下一局游戏开始新的投票</p>
        </div>
      `;
    }
  }

  /**
   * Get top voted player
   * @param {Object} votes - Vote counts by player ID
   * @returns {Object|null} Top voted player info
   */
  getTopVoted(votes) {
    const entries = Object.entries(votes || {});
    if (entries.length === 0) return null;
    
    entries.sort((a, b) => b[1] - a[1]); // Sort by vote count descending
    return {
      playerId: entries[0][0],
      votes: entries[0][1]
    };
  }

  /**
   * Record community vote in player statistics
   * @param {number} mvpPlayerId - MVP player ID  
   * @param {number} burdenPlayerId - Burden player ID
   */
  async recordCommunityVote(mvpPlayerId, burdenPlayerId) {
    // Update local player stats
    const playerStats = this.roomManager.gameState.playerStats;
    
    // Initialize community vote stats if needed
    if (!playerStats[mvpPlayerId]) playerStats[mvpPlayerId] = {};
    if (!playerStats[burdenPlayerId]) playerStats[burdenPlayerId] = {};
    
    // Record community MVP and burden votes
    playerStats[mvpPlayerId].communityMvpCount = (playerStats[mvpPlayerId].communityMvpCount || 0) + 1;
    playerStats[burdenPlayerId].communityBurdenCount = (playerStats[burdenPlayerId].communityBurdenCount || 0) + 1;
    
    // Save to local storage and sync to room
    this.roomManager.gameState.savePlayerStats();
    
    // Update voting stats display immediately
    this.loadVotingStats();
    
    if (this.roomManager.isHost) {
      await this.roomManager.syncNow();
    }
  }

  /**
   * Reset current voting session
   */
  async resetCurrentVoting() {
    try {
      // Call API to reset voting for new round
      const response = await fetch(`/api/rooms/reset-vote/${this.roomManager.currentRoomCode}`, {
        method: 'POST'
      });

      if (response.ok) {
        // Clear local voting state
        this.hasVoted = false;
        this.selectedMvp = null;
        this.selectedBurden = null;
        this.hostSelectedMvp = null;
        this.hostSelectedBurden = null;
        
        // Refresh voting interface
        if (this.roomManager.isViewer) {
          this.showViewerVoting();
        } else {
          this.showHostVoting();
        }
      } else {
        console.error('Failed to reset voting via API');
      }
    } catch (error) {
      console.error('Failed to reset voting:', error);
    }
  }
}

export default VotingManager;