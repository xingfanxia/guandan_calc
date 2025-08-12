/**
 * UI Rendering Module
 * Handles all DOM manipulation and UI rendering
 */

export class UIRenderer {
  constructor() {
    this.elements = {};
    this.initializeElements();
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    // We'll populate this when the DOM is ready
    this.elements = {
      playersContainer: null,
      rankingContainer: null,
      resultsContainer: null,
      teamContainers: { t1: null, t2: null },
      roundLevelSelect: null,
      modeSelect: null,
      autoApplyCheckbox: null
    };
  }

  /**
   * Set DOM element references
   */
  setElements(elements) {
    Object.assign(this.elements, elements);
  }

  /**
   * Create player tile element
   */
  createPlayerTile(player, isDraggable = true) {
    const tile = document.createElement('div');
    tile.className = 'player-tile';
    tile.dataset.playerId = player.id;
    tile.dataset.playerName = player.name;
    
    if (isDraggable) {
      tile.draggable = true;
    }

    tile.innerHTML = `
      <span class="player-emoji">${player.emoji || '🎮'}</span>
      <input type="text" value="${player.name}" class="player-name-input" />
      <button class="delete-btn" aria-label="删除玩家">×</button>
    `;

    return tile;
  }

  /**
   * Create ranked player tile (in ranking slot)
   */
  createRankedTile(player) {
    const tile = document.createElement('div');
    tile.className = 'player-tile ranked';
    tile.dataset.playerId = player.id;
    
    const teamClass = player.team === 1 ? 'team1' : 'team2';
    tile.classList.add(teamClass);

    tile.innerHTML = `
      <span class="player-emoji">${player.emoji || '🎮'}</span>
      <span class="player-name">${player.name}</span>
      <button class="remove-btn" aria-label="移除排名">×</button>
    `;

    return tile;
  }

  /**
   * Create ranking slot
   */
  createRankingSlot(rank, mode) {
    const slot = document.createElement('div');
    slot.className = 'rank-slot';
    slot.dataset.rank = rank;
    
    const label = document.createElement('div');
    label.className = 'rank-label';
    label.textContent = `第${rank}名`;
    
    const box = document.createElement('div');
    box.className = 'rank-box';
    box.dataset.rank = rank;
    
    slot.appendChild(label);
    slot.appendChild(box);
    
    return slot;
  }

  /**
   * Render players pool
   */
  renderPlayersPool(players, currentRanking) {
    if (!this.elements.playersContainer) return;
    
    this.elements.playersContainer.innerHTML = '';
    
    // Only show unranked players
    const unrankedPlayers = players.filter(player => {
      return !Object.values(currentRanking).includes(player.id);
    });
    
    unrankedPlayers.forEach(player => {
      const tile = this.createPlayerTile(player);
      this.elements.playersContainer.appendChild(tile);
    });
  }

  /**
   * Render ranking slots
   */
  renderRankingSlots(mode) {
    if (!this.elements.rankingContainer) return;
    
    this.elements.rankingContainer.innerHTML = '';
    
    for (let i = 1; i <= mode; i++) {
      const slot = this.createRankingSlot(i, mode);
      this.elements.rankingContainer.appendChild(slot);
    }
  }

  /**
   * Update ranking display
   */
  updateRanking(currentRanking, players) {
    // Clear all rank boxes
    document.querySelectorAll('.rank-box').forEach(box => {
      box.innerHTML = '';
      box.classList.remove('filled');
    });
    
    // Place ranked players
    Object.entries(currentRanking).forEach(([rank, playerId]) => {
      const player = players.find(p => p.id === playerId);
      if (player) {
        const box = document.querySelector(`.rank-box[data-rank="${rank}"]`);
        if (box) {
          const tile = this.createRankedTile(player);
          box.appendChild(tile);
          box.classList.add('filled');
        }
      }
    });
  }

  /**
   * Render teams display
   */
  renderTeams(players, roundLevel, roundLevels) {
    const team1Players = players.filter(p => p.team === 1);
    const team2Players = players.filter(p => p.team === 2);
    
    if (this.elements.teamContainers.t1) {
      this.renderTeam(this.elements.teamContainers.t1, team1Players, 1, roundLevel, roundLevels);
    }
    
    if (this.elements.teamContainers.t2) {
      this.renderTeam(this.elements.teamContainers.t2, team2Players, 2, roundLevel, roundLevels);
    }
  }

  /**
   * Render single team
   */
  renderTeam(container, players, teamNumber, roundLevel, roundLevels) {
    container.innerHTML = `
      <div class="team-header">
        <h3>队伍 ${teamNumber}</h3>
        <span class="team-level">级别: ${roundLevels[roundLevel] || 'A'}</span>
      </div>
      <div class="team-players">
        ${players.map(p => `
          <div class="team-player">
            <span class="player-emoji">${p.emoji}</span>
            <span class="player-name">${p.name}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render calculation results
   */
  renderResults(result) {
    if (!result.success) {
      return `<div class="error">${result.error}</div>`;
    }
    
    const { score, label, upgrade, fullRanking, winningTeam } = result;
    
    return `
      <div class="result-container">
        <div class="result-header">
          <h2>计算结果</h2>
          <div class="winner-team">获胜队伍: 队伍 ${winningTeam}</div>
        </div>
        
        <div class="result-content">
          <div class="score-display">
            <div class="score-value">${score}分</div>
            <div class="score-label">${label}</div>
          </div>
          
          <div class="upgrade-info">
            <div class="current-level">
              当前级别: ${upgrade.currentLevelName}
            </div>
            <div class="arrow">→</div>
            <div class="new-level ${upgrade.isMaxLevel ? 'max-level' : ''}">
              新级别: ${upgrade.newLevelName}
              ${upgrade.isMaxLevel ? ' (已封顶)' : ''}
            </div>
          </div>
          
          <div class="ranking-display">
            <h3>完整排名</h3>
            <ol>
              ${fullRanking.map(name => `<li>${name}</li>`).join('')}
            </ol>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show message
   */
  showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      messageEl.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      messageEl.classList.remove('show');
      setTimeout(() => messageEl.remove(), 300);
    }, 3000);
  }

  /**
   * Update mode display
   */
  updateModeDisplay(mode) {
    if (this.elements.modeSelect) {
      this.elements.modeSelect.value = mode;
    }
    
    // Update ranking slots
    this.renderRankingSlots(mode);
  }

  /**
   * Update round level display
   */
  updateRoundLevelDisplay(level) {
    if (this.elements.roundLevelSelect) {
      this.elements.roundLevelSelect.value = level;
    }
  }

  /**
   * Update auto-apply checkbox
   */
  updateAutoApplyDisplay(enabled) {
    if (this.elements.autoApplyCheckbox) {
      this.elements.autoApplyCheckbox.checked = enabled;
    }
  }

  /**
   * Clear results display
   */
  clearResults() {
    if (this.elements.resultsContainer) {
      this.elements.resultsContainer.innerHTML = '';
      this.elements.resultsContainer.style.display = 'none';
    }
  }

  /**
   * Show results
   */
  showResults(html) {
    if (this.elements.resultsContainer) {
      this.elements.resultsContainer.innerHTML = html;
      this.elements.resultsContainer.style.display = 'block';
    }
  }
}