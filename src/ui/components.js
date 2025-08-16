/**
 * UI Components Module
 * Creates and manages all UI elements
 */

import { LEVEL_RULES, CONFIG } from '../core/config.js';

export class UIComponents {
  /**
   * Create player tile element
   */
  static createPlayerTile(player, isDraggable = true) {
    const tile = document.createElement('div');
    tile.className = 'player-tile';
    tile.dataset.playerId = player.id;
    tile.dataset.playerName = player.name;
    
    if (isDraggable) {
      tile.draggable = true;
    }
    
    // Add team color border
    if (player.team) {
      tile.style.borderLeftWidth = '4px';
      tile.style.borderLeftStyle = 'solid';
      const teamColor = player.team === 1 ? CONFIG.TEAMS.t1.color : CONFIG.TEAMS.t2.color;
      tile.style.borderLeftColor = teamColor;
    }
    
    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = player.emoji || '🎮';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = player.name;
    nameInput.className = 'player-name-input';
    nameInput.dataset.playerId = player.id;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.dataset.playerId = player.id;
    deleteBtn.title = '删除玩家';
    
    tile.appendChild(emoji);
    tile.appendChild(nameInput);
    tile.appendChild(deleteBtn);
    
    return tile;
  }

  /**
   * Create ranking player tile (simplified version)
   */
  static createRankingPlayerTile(player) {
    const tile = document.createElement('div');
    tile.className = 'ranking-player-tile';
    tile.dataset.playerId = player.id;
    tile.draggable = true;
    
    // Add team color
    if (player.team) {
      const teamColor = player.team === 1 ? CONFIG.TEAMS.t1.color : CONFIG.TEAMS.t2.color;
      tile.style.borderColor = teamColor;
    }
    
    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = player.emoji || '🎮';
    
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = player.name;
    
    tile.appendChild(emoji);
    tile.appendChild(name);
    
    return tile;
  }

  /**
   * Create ranking slot
   */
  static createRankingSlot(rank) {
    const slot = document.createElement('div');
    slot.className = 'rank-slot';
    slot.dataset.rank = rank;
    
    const number = document.createElement('div');
    number.className = 'rank-number';
    number.textContent = rank;
    
    slot.appendChild(number);
    
    return slot;
  }

  /**
   * Create team drop zone
   */
  static createTeamDropZone(teamNumber, teamName, teamColor) {
    const zone = document.createElement('div');
    zone.className = 'team-drop-zone';
    zone.dataset.team = teamNumber;
    zone.style.borderColor = teamColor;
    
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = '拖拽玩家到这里分配队伍';
    
    zone.appendChild(label);
    
    return zone;
  }

  /**
   * Create winner button
   */
  static createWinnerButton(teamId, teamName, teamColor) {
    const btn = document.createElement('button');
    btn.className = 'winbtn';
    btn.dataset.team = teamId;
    btn.style.borderColor = teamColor;
    btn.textContent = teamName;
    
    return btn;
  }

  /**
   * Create history table row
   */
  static createHistoryRow(entry, index) {
    const tr = document.createElement('tr');
    
    const cells = [
      entry.round,
      entry.time,
      entry.mode,
      entry.winnerCombo,
      entry.ranking,
      entry.upgrade,
      entry.winner,
      entry.t1Level,
      entry.t2Level,
      entry.roundLevel,
      entry.aNote
    ];
    
    cells.forEach(content => {
      const td = document.createElement('td');
      td.textContent = content;
      tr.appendChild(td);
    });
    
    // Add action cell
    const actionTd = document.createElement('td');
    actionTd.className = 'actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '删除';
    deleteBtn.dataset.entryId = entry.id;
    deleteBtn.className = 'delete-history-btn';
    
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);
    
    return tr;
  }

  /**
   * Create player stats row
   */
  static createPlayerStatsRow(playerData) {
    const tr = document.createElement('tr');
    
    // Player cell with emoji and name
    const playerTd = document.createElement('td');
    playerTd.innerHTML = `<span class="emoji">${playerData.emoji}</span>${playerData.name}`;
    tr.appendChild(playerTd);
    
    // Team cell with color
    const teamTd = document.createElement('td');
    const teamColor = playerData.team === 1 ? CONFIG.TEAMS.t1.color : CONFIG.TEAMS.t2.color;
    teamTd.innerHTML = `<span style="color: ${teamColor}">队伍${playerData.team}</span>`;
    tr.appendChild(teamTd);
    
    // Stats cells
    const statsCells = [
      playerData.games,
      playerData.avgRank,
      playerData.firstPlace,
      playerData.lastPlace
    ];
    
    statsCells.forEach(content => {
      const td = document.createElement('td');
      td.textContent = content;
      tr.appendChild(td);
    });
    
    return tr;
  }

  /**
   * Create result display
   */
  static createResultDisplay(result, gameState) {
    const container = document.createElement('div');
    container.className = 'result-display';
    
    if (!result.success) {
      container.innerHTML = `
        <div class="error-message">
          ${result.error}
        </div>
      `;
      return container;
    }
    
    const winnerTeam = gameState.teams[result.winner];
    const currentLevel = LEVEL_RULES.getLevelDisplay(result.currentLevel);
    const newLevel = LEVEL_RULES.getLevelDisplay(
      LEVEL_RULES.calculateNewLevel(result.currentLevel, result.upgradeAmount)
    );
    
    container.innerHTML = `
      <div class="result-header">
        <h2>${result.label}</h2>
        <div class="score-display">
          <span class="score-value">${result.score}分</span>
          <span class="score-label">升${result.upgradeAmount}级</span>
        </div>
      </div>
      
      <div class="result-details">
        <div class="winner-info">
          <span class="label">获胜队伍:</span>
          <span class="winner-name" style="color: ${winnerTeam.color}">
            ${winnerTeam.name}
          </span>
        </div>
        
        <div class="ranking-info">
          <span class="label">获胜方排名:</span>
          <span class="ranks">${result.winnerRanks.join(', ')}</span>
        </div>
        
        <div class="level-info">
          <span class="current-level">${currentLevel}</span>
          <span class="arrow">→</span>
          <span class="new-level">${newLevel}</span>
        </div>
      </div>
    `;
    
    return container;
  }

  /**
   * Create victory modal
   */
  static createVictoryModal(teamName, teamColor) {
    const modal = document.createElement('div');
    modal.id = 'victoryModal';
    modal.className = 'victory-modal';
    
    modal.innerHTML = `
      <div class="victory-content">
        <h1>🎉 A级通关！🎉</h1>
        <h2 style="color: ${teamColor}">${teamName}</h2>
        <p>恭喜完成所有级别的挑战！</p>
        
        <div class="victory-actions">
          <button id="victoryExportTxt" class="btn-export">📄 导出 TXT</button>
          <button id="victoryExportCsv" class="btn-export">📊 导出 CSV</button>
          <button id="victoryExportPng" class="btn-export">🖼️ 导出长图</button>
          <button id="victoryReset" class="btn-reset">🔄 重置整场</button>
          <button id="victoryClose" class="btn-close">关闭</button>
        </div>
      </div>
    `;
    
    return modal;
  }

  /**
   * Create settings panel for custom rules
   */
  static createSettingsPanel(customScoring) {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    
    // 4-player settings
    const section4p = document.createElement('details');
    section4p.innerHTML = `
      <summary>4人升级表</summary>
      <div class="settings-row">
        <label>(1,2)=</label>
        <input type="number" id="c4_12" value="${customScoring.c4['1,2']}" min="0" max="5">
        <label>(1,3)=</label>
        <input type="number" id="c4_13" value="${customScoring.c4['1,3']}" min="0" max="5">
        <label>(1,4)=</label>
        <input type="number" id="c4_14" value="${customScoring.c4['1,4']}" min="0" max="5">
        <button id="save4">保存</button>
      </div>
    `;
    
    panel.appendChild(section4p);
    
    // Add 6p and 8p settings similarly...
    
    return panel;
  }

  /**
   * Show notification
   */
  static showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Create ripple effect
   */
  static createRipple(event, button) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), CONFIG.UI.RIPPLE_DURATION);
  }

  /**
   * Update team display
   */
  static updateTeamDisplay(teamId, gameState) {
    const team = gameState.teams[teamId];
    const aState = gameState.aLevelState[teamId];
    
    // Update team name chip
    const nameChip = document.getElementById(`${teamId}NameChip`);
    if (nameChip) {
      nameChip.innerHTML = `<b>${team.name}</b>`;
      nameChip.style.color = team.color;
    }
    
    // Update level
    const lvlElement = document.getElementById(`${teamId}Lvl`);
    if (lvlElement) {
      lvlElement.textContent = LEVEL_RULES.getLevelDisplay(team.level);
    }
    
    // Update A-fail count
    const aFailElement = document.getElementById(`${teamId}A`);
    if (aFailElement) {
      aFailElement.textContent = aState.failures;
    }
    
    // Update A-state
    const aStateElement = document.getElementById(`${teamId}AState`);
    if (aStateElement) {
      if (aState.wonA) {
        aStateElement.textContent = '已通关';
        aStateElement.style.color = CONFIG.COLORS.success;
      } else if (aState.inA) {
        aStateElement.textContent = '进行中';
        aStateElement.style.color = CONFIG.COLORS.warning;
      } else {
        aStateElement.textContent = '—';
        aStateElement.style.color = CONFIG.COLORS.muted;
      }
    }
  }

  /**
   * Update round level display
   */
  static updateRoundLevelDisplay(gameState) {
    const currentLevel = gameState.getCurrentRoundLevel();
    const curRoundLvl = document.getElementById('curRoundLvl');
    if (curRoundLvl) {
      curRoundLvl.textContent = LEVEL_RULES.getLevelDisplay(currentLevel);
    }
    
    // Preview next round
    const t1Level = gameState.teams.t1.level;
    const t2Level = gameState.teams.t2.level;
    const nextPreview = document.getElementById('nextRoundPreview');
    if (nextPreview) {
      if (t1Level === t2Level) {
        nextPreview.textContent = LEVEL_RULES.getLevelDisplay(t1Level);
      } else {
        nextPreview.textContent = `${LEVEL_RULES.getLevelDisplay(t1Level)} vs ${LEVEL_RULES.getLevelDisplay(t2Level)}`;
      }
    }
  }
}

export default UIComponents;