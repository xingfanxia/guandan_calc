// Player system management
// UTF-8 encoding for Chinese characters

import { ANIMAL_EMOJIS } from '../utils/constants.js';
import { $ } from '../utils/dom.js';

class PlayerSystem {
  constructor(gameState) {
    this.gameState = gameState;
    this.draggedPlayer = null;
    this.touchHandlers = null;
  }
  
  /**
   * Set touch handlers instance
   * @param {TouchHandlers} touchHandlers - Touch handlers instance
   */
  setTouchHandlers(touchHandlers) {
    this.touchHandlers = touchHandlers;
  }

  /**
   * Generate players for the current mode
   * @param {string} mode - Game mode ('4', '6', '8')
   * @param {boolean} forceNew - Force new generation
   */
  generatePlayers(mode, forceNew = false) {
    const num = parseInt(mode);
    
    if (!num || isNaN(num)) {
      console.log('Invalid player count:', mode);
      return;
    }
    
    // Try to load saved players first (unless forcing new generation)
    if (!forceNew && this.gameState.players && this.gameState.players.length === num) {
      // Ensure saved players have proper IDs and teams
      this.gameState.players.forEach((player, index) => {
        if (!player.id || typeof player.id === 'string') {
          player.id = index + 1;
        }
        // Fix team values - convert string 'A'/'B' to numeric 1/2
        if (player.team === 'A') {
          player.team = 1;
        } else if (player.team === 'B') {
          player.team = 2;
        } else if (!player.team) {
          player.team = null; // Start unassigned
        }
      });
    } else {
      // Generate new players
      this.gameState.players = [];
      
      // Shuffle emojis
      const shuffledEmojis = ANIMAL_EMOJIS.slice().sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < num; i++) {
        const player = {
          id: i + 1, // Numeric ID matching player number
          name: '玩家' + (i + 1),
          emoji: shuffledEmojis[i % shuffledEmojis.length],
          team: null // Start with no team assigned
        };
        this.gameState.players.push(player);
      }
    }
    
    // Save the newly generated or loaded players
    this.gameState.savePlayers();
    
    // Clear current ranking when changing player count
    this.gameState.currentRanking = {};
  }

  /**
   * Shuffle teams randomly
   * @param {string} mode - Game mode
   */
  shuffleTeams(mode) {
    const num = parseInt(mode);
    const halfSize = num / 2;
    
    // Shuffle players
    const shuffled = this.gameState.players.slice().sort(() => Math.random() - 0.5);
    
    // Assign to teams
    shuffled.forEach((player, i) => {
      player.team = i < halfSize ? 1 : 2;
    });
    
    this.gameState.savePlayers();
  }

  /**
   * Create player tile element
   * @param {Object} player - Player object
   * @returns {HTMLElement} Player tile
   */
  createPlayerTile(player) {
    const tile = document.createElement('div');
    tile.className = 'player-tile';
    tile.draggable = true;
    tile.dataset.playerId = player.id;
    
    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = player.emoji;
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = player.name;
    nameInput.onclick = (e) => e.stopPropagation();
    
    // Update with debouncing for performance
    let updateTimer = null;
    const updateName = function() {
      player.name = this.value;
      this.gameState.savePlayers();
      
      // Debounce the UI updates
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        // Update displays that depend on player names
        this.updatePlayerDisplays();
      }, 300);
    }.bind(this);
    
    nameInput.oninput = updateName;
    nameInput.onchange = function() {
      player.name = this.value;
      this.gameState.savePlayers();
      // Immediate update on change (blur)
      if (updateTimer) clearTimeout(updateTimer);
      this.updatePlayerDisplays();
    }.bind(this);
    
    tile.appendChild(emoji);
    tile.appendChild(nameInput);
    
    // Drag events
    tile.ondragstart = (e) => {
      this.draggedPlayer = player;
      tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    };
    
    tile.ondragend = () => {
      tile.classList.remove('dragging');
      this.draggedPlayer = null;
    };
    
    return tile;
  }

  /**
   * Create ranking player tile (for ranking area)
   * @param {Object} player - Player object
   * @returns {HTMLElement} Ranking player tile
   */
  createRankingPlayerTile(player) {
    const tile = document.createElement('div');
    tile.className = 'ranking-player-tile';
    tile.draggable = true;
    tile.dataset.playerId = player.id;
    
    // Apply team color
    tile.style.borderColor = player.team === 1 ? 
      this.gameState.settings.t1.color : 
      this.gameState.settings.t2.color;
    
    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = player.emoji;
    
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = player.name;
    
    tile.appendChild(emoji);
    tile.appendChild(name);
    
    // Drag events
    tile.ondragstart = (e) => {
      this.draggedPlayer = player;
      tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    };
    
    tile.ondragend = () => {
      tile.classList.remove('dragging');
      this.draggedPlayer = null;
    };
    
    return tile;
  }

  /**
   * Setup drop zones for team assignment
   */
  setupDropZones() {
    const zones = [
      { el: $('unassignedPlayers'), team: null },
      { el: $('team1Zone'), team: 1 },
      { el: $('team2Zone'), team: 2 }
    ];
    
    zones.forEach((zone) => {
      zone.el.ondragover = (e) => {
        e.preventDefault();
        zone.el.classList.add('drag-over');
      };
      
      zone.el.ondragleave = () => {
        zone.el.classList.remove('drag-over');
      };
      
      zone.el.ondrop = (e) => {
        e.preventDefault();
        zone.el.classList.remove('drag-over');
        
        if (this.draggedPlayer) {
          this.handleTeamDrop(zone, this.draggedPlayer);
        }
      };
    });
  }

  /**
   * Handle team drop operation
   * @param {Object} zone - Drop zone info
   * @param {Object} player - Player being dropped
   */
  handleTeamDrop(zone, player) {
    // Update the team assignment
    player.team = zone.team;
    
    // If moving to a team zone, check if that team is already full
    if (zone.team !== null) {
      const teamPlayers = this.gameState.players.filter(p => p.team === zone.team);
      const maxPerTeam = parseInt($('mode').value) / 2;
      
      // Don't allow if team is full (not counting the current player if they're already on this team)
      if (teamPlayers.length >= maxPerTeam && !teamPlayers.some(p => p.id === player.id)) {
        alert('该队伍已满员！');
        return;
      }
    }
    
    this.gameState.savePlayers();
    this.renderPlayers();
    this.renderRankingArea();
  }

  /**
   * Render players in team zones
   */
  renderPlayers() {
    const unassigned = $('unassignedPlayers');
    const team1Zone = $('team1Zone');
    const team2Zone = $('team2Zone');
    
    // Clear zones
    unassigned.innerHTML = '';
    team1Zone.innerHTML = '';
    team2Zone.innerHTML = '';
    
    // Add labels for empty team zones
    const team1Players = this.gameState.players.filter(p => p.team === 1);
    const team2Players = this.gameState.players.filter(p => p.team === 2);
    
    if (team1Players.length === 0) {
      team1Zone.innerHTML = '<div class="label">拖拽玩家到这里分配队伍</div>';
    }
    if (team2Players.length === 0) {
      team2Zone.innerHTML = '<div class="label">拖拽玩家到这里分配队伍</div>';
    }
    
    // Render players
    this.gameState.players.forEach((player) => {
      const tile = this.createPlayerTile(player);
      
      if (player.team === 1) {
        team1Zone.appendChild(tile);
        tile.style.borderColor = this.gameState.settings.t1.color;
      } else if (player.team === 2) {
        team2Zone.appendChild(tile);
        tile.style.borderColor = this.gameState.settings.t2.color;
      } else {
        unassigned.appendChild(tile);
      }
    });
    
    this.updateTeamLabels();
  }

  /**
   * Update team labels
   */
  updateTeamLabels() {
    $('team1Label').textContent = this.gameState.settings.t1.name;
    $('team2Label').textContent = this.gameState.settings.t2.name;
    $('team1Label').style.color = this.gameState.settings.t1.color;
    $('team2Label').style.color = this.gameState.settings.t2.color;
  }

  /**
   * Render ranking area
   */
  renderRankingArea() {
    const pool = $('playerPool');
    const area = $('rankingArea');
    const mode = $('mode').value;
    const num = parseInt(mode);
    const allAssigned = this.gameState.players.every(p => p.team !== null);
    
    if (!allAssigned) {
      pool.innerHTML = '<div class="small muted">请先分配所有玩家到队伍</div>';
      area.innerHTML = '';
      return;
    }
    
    // Render player pool
    this.renderPlayerPool();
    
    // Render ranking slots
    area.innerHTML = '';
    
    for (let rank = 1; rank <= num; rank++) {
      const slot = document.createElement('div');
      slot.className = 'rank-slot';
      slot.dataset.rank = rank;
      
      const number = document.createElement('div');
      number.className = 'rank-number';
      number.textContent = '第' + rank + '名';
      slot.appendChild(number);
      
      this.setupRankingSlot(slot, rank);
      area.appendChild(slot);
    }
  }

  /**
   * Setup ranking slot drag and drop
   * @param {HTMLElement} slot - Ranking slot element
   * @param {number} rank - Rank number
   */
  setupRankingSlot(slot, rank) {
    slot.ondragover = (e) => {
      e.preventDefault();
      slot.classList.add('drag-over');
    };
    
    slot.ondragleave = () => {
      slot.classList.remove('drag-over');
    };
    
    slot.ondrop = (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      
      if (this.draggedPlayer) {
        this.handleRankDrop(rank, this.draggedPlayer);
      }
    };
  }

  /**
   * Handle rank drop operation
   * @param {number} rank - Rank position
   * @param {Object} player - Player being dropped
   */
  handleRankDrop(rank, player) {
    if (!player || !player.id) return;
    
    // Check if another player was already in this rank
    const existingPlayerId = this.gameState.currentRanking[rank];
    if (existingPlayerId && existingPlayerId !== player.id) {
      // Swap positions if the dragged player is already ranked
      let draggedRank = null;
      for (const r in this.gameState.currentRanking) {
        if (this.gameState.currentRanking[r] === player.id) {
          draggedRank = r;
          break;
        }
      }
      if (draggedRank) {
        // Swap the two players
        this.gameState.currentRanking[draggedRank] = existingPlayerId;
      } else {
        // Remove existing player from ranking
        delete this.gameState.currentRanking[rank];
      }
    }
    
    // Remove player from any existing rank
    for (const r in this.gameState.currentRanking) {
      if (this.gameState.currentRanking[r] === player.id && r != rank) {
        delete this.gameState.currentRanking[r];
      }
    }
    
    // Add player to new rank
    this.gameState.currentRanking[rank] = player.id;
    
    // Re-render everything
    this.renderPlayerPool();
    this.renderRankingSlots();
  }

  /**
   * Render player pool (unranked players)
   */
  renderPlayerPool() {
    const pool = $('playerPool');
    pool.innerHTML = '';
    
    // Add drop zone functionality
    pool.ondragover = (e) => {
      e.preventDefault();
      pool.classList.add('drag-over');
    };
    
    pool.ondragleave = () => {
      pool.classList.remove('drag-over');
    };
    
    pool.ondrop = (e) => {
      e.preventDefault();
      pool.classList.remove('drag-over');
      
      if (this.draggedPlayer) {
        // Remove from ranking
        for (const rank in this.gameState.currentRanking) {
          if (this.gameState.currentRanking[rank] === this.draggedPlayer.id) {
            delete this.gameState.currentRanking[rank];
            break;
          }
        }
        this.renderPlayerPool();
        this.renderRankingSlots();
      }
    };
    
    // Add unranked players
    this.gameState.players.forEach((player) => {
      let isRanked = false;
      for (const rank in this.gameState.currentRanking) {
        if (this.gameState.currentRanking[rank] === player.id) {
          isRanked = true;
          break;
        }
      }
      
      if (!isRanked) {
        const tile = this.createRankingPlayerTile(player);
        pool.appendChild(tile);
      }
    });
    
    if (pool.children.length === 0) {
      pool.innerHTML = '<div class="small muted">所有玩家已排名</div>';
    }
  }

  /**
   * Render ranking slots with current players
   */
  renderRankingSlots() {
    const area = $('rankingArea');
    const slots = area.querySelectorAll('.rank-slot');
    
    slots.forEach((slot) => {
      const rank = parseInt(slot.dataset.rank);
      const playerId = this.gameState.currentRanking[rank];
      
      // Remove existing player tiles (keep rank number)
      const existingTiles = slot.querySelectorAll('.ranking-player-tile');
      existingTiles.forEach(t => t.remove());
      
      if (playerId) {
        const player = this.gameState.players.find(p => p.id === parseInt(playerId));
        if (player) {
          const tile = this.createRankingPlayerTile(player);
          slot.appendChild(tile);
          slot.classList.add('filled');
        }
      } else {
        slot.classList.remove('filled');
      }
    });
  }

  /**
   * Clear all ranking assignments
   */
  clearRanking() {
    this.gameState.currentRanking = {};
    this.renderPlayerPool();
    this.renderRankingSlots();
  }

  /**
   * Randomize player ranking
   */
  randomizeRanking() {
    const mode = $('mode').value;
    const num = parseInt(mode);
    
    // Check if all players are assigned to teams
    const allAssigned = this.gameState.players.every(p => p.team !== null);
    if (!allAssigned) {
      alert('请先分配所有玩家到队伍');
      return;
    }
    
    // Clear current ranking
    this.gameState.currentRanking = {};
    
    // Create a shuffled array of player IDs
    const playerIds = this.gameState.players.map(p => p.id);
    
    // Fisher-Yates shuffle
    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = playerIds[i];
      playerIds[i] = playerIds[j];
      playerIds[j] = temp;
    }
    
    // Assign shuffled players to ranking positions
    for (let rank = 1; rank <= num; rank++) {
      this.gameState.currentRanking[rank] = playerIds[rank - 1];
    }
    
    // Update display
    this.renderPlayerPool();
    this.renderRankingSlots();
  }

  /**
   * Update displays that depend on player names
   */
  updatePlayerDisplays() {
    this.renderPlayerPool();
    this.renderRankingSlots();
    // Also trigger statistics update if available
    if (this.onPlayerUpdate) {
      this.onPlayerUpdate();
    }
  }

  /**
   * Parse and validate bulk names input
   * @param {string} namesText - Space-separated names
   * @param {number} expectedCount - Expected number of names
   * @returns {Object} Result with success status and names array or error message
   */
  parseBulkNames(namesText, expectedCount) {
    if (!namesText || typeof namesText !== 'string') {
      return {ok: false, msg: '请输入玩家姓名'};
    }
    
    // Split by spaces and filter out empty strings
    const names = namesText.trim().split(/\s+/).filter(name => name.length > 0);
    
    if (names.length === 0) {
      return {ok: false, msg: '请输入至少一个姓名'};
    }
    
    if (names.length !== expectedCount) {
      return {ok: false, msg: `需要 ${expectedCount} 个姓名，但输入了 ${names.length} 个`};
    }
    
    // Check for duplicate names
    const nameSet = new Set(names);
    if (nameSet.size !== names.length) {
      return {ok: false, msg: '姓名不能重复'};
    }
    
    // Check name length (reasonable limits)
    for (let i = 0; i < names.length; i++) {
      if (names[i].length > 10) {
        return {ok: false, msg: `姓名"${names[i]}"过长（最多10个字符）`};
      }
      if (names[i].length === 0) {
        return {ok: false, msg: '姓名不能为空'};
      }
    }
    
    return {ok: true, names: names};
  }

  /**
   * Apply bulk names to players
   * @param {string} namesText - Space-separated names
   * @returns {boolean} Success status
   */
  applyBulkNames(namesText) {
    const mode = $('mode').value;
    const expectedCount = parseInt(mode);
    
    // Ensure players exist
    if (!this.gameState.players || this.gameState.players.length === 0) {
      alert('请先生成玩家');
      return false;
    }
    
    if (this.gameState.players.length !== expectedCount) {
      alert(`当前${this.gameState.players.length}个玩家，但${mode}人模式需要${expectedCount}个玩家。请先生成玩家。`);
      return false;
    }
    
    // Parse and validate names
    const result = this.parseBulkNames(namesText, expectedCount);
    if (!result.ok) {
      alert('姓名输入错误：' + result.msg);
      return false;
    }
    
    // Apply names to players
    for (let i = 0; i < result.names.length && i < this.gameState.players.length; i++) {
      this.gameState.players[i].name = result.names[i];
    }
    
    // Save and update UI
    this.gameState.savePlayers();
    this.renderPlayers();
    this.renderRankingArea();
    this.updatePlayerDisplays();
    
    // Clear the input field
    const bulkNamesInput = $('bulkNames');
    if (bulkNamesInput) {
      bulkNamesInput.value = '';
    }
    
    return true;
  }

  /**
   * Setup bulk name input event listeners
   */
  setupBulkNameInput() {
    const applyBtn = $('applyBulkNames');
    const input = $('bulkNames');
    
    if (applyBtn) {
      applyBtn.onclick = () => {
        const namesText = input ? input.value : '';
        if (this.applyBulkNames(namesText)) {
          // Show success feedback
          const originalText = applyBtn.textContent;
          applyBtn.textContent = '已应用 ✓';
          applyBtn.style.background = '#22c55e';
          setTimeout(() => {
            applyBtn.textContent = originalText;
            applyBtn.style.background = '';
          }, 1000);
        }
      };
    }
    
    // Also allow Enter key to apply names
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.applyBulkNames(input.value)) {
            // Show success feedback
            const applyBtn = $('applyBulkNames');
            if (applyBtn) {
              const originalText = applyBtn.textContent;
              applyBtn.textContent = '已应用 ✓';
              applyBtn.style.background = '#22c55e';
              setTimeout(() => {
                applyBtn.textContent = originalText;
                applyBtn.style.background = '';
              }, 1000);
            }
          }
        }
      };
    }
  }

  /**
   * Set callback for player updates
   * @param {Function} callback - Callback function
   */
  setPlayerUpdateCallback(callback) {
    this.onPlayerUpdate = callback;
  }
}

export default PlayerSystem;