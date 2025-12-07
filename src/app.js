(function() {
  // ================================
  // Utility Functions
  // ================================
  function $(id) { 
    return document.getElementById(id); 
  }
  
  function on(el, ev, fn) { 
    el.addEventListener ? el.addEventListener(ev, fn) : el.attachEvent('on' + ev, fn); 
  }
  
  function now() { 
    return new Date().toLocaleString(); 
  }

  // ================================
  // DOM Element References
  // ================================
  
  // Game controls
  var modeSel = $('mode');
  var input = { value: '' };
  var must1 = $('must1');
  var ruleHint = $('ruleHint');
  var tip = $('tip');
  
  // Result display elements
  var headline = $('headline');
  var explain = $('explain');
  var applyBtn = $('apply');
  var applyTip = $('applyTip');
  var advanceBtn = $('advance');
  var winnerDisplay = $('winnerDisplay');
  
  // Settings checkboxes
  var autoNext = $('autoNext');
  var autoApply = $('autoApply');
  var strictA = $('strictA');
  
  // Team status elements
  var t1Lvl = $('t1Lvl');
  var t2Lvl = $('t2Lvl');
  var t1A = $('t1A');
  var t2A = $('t2A');
  var t1AState = $('t1AState');
  var t2AState = $('t2AState');
  var t1NameChip = $('t1NameChip');
  var t2NameChip = $('t2NameChip');
  
  // Round display elements
  var curRoundLvl = $('curRoundLvl');
  var nextRoundPreview = $('nextRoundPreview');
  var hT1 = $('hT1');
  var hT2 = $('hT2');
  
  // Canvas for export
  var longCnv = $('longCnv');
  var lctx = longCnv.getContext('2d');
  
  // Game state
  var selected = [];

  // ================================
  // Storage Management
  // ================================
  var KEY_S = 'gd_v7_5_1_settings';
  var KEY_ST = 'gd_v7_5_1_state';
  
  function load(key, def) { 
    try { 
      var v = localStorage.getItem(key); 
      return v ? JSON.parse(v) : def; 
    } catch(e) { 
      return def; 
    } 
  }
  
  function save(key, v) { 
    try { 
      localStorage.setItem(key, JSON.stringify(v)); 
    } catch(e) {} 
  }

  // ================================
  // Settings Initialization
  // ================================
  var S = load(KEY_S, {});
  
  // 4-player mode rules
  if (!S.c4) { 
    S.c4 = {'1,2': 3, '1,3': 2, '1,4': 1}; 
  }
  
  // 6-player mode thresholds and points
  if (!S.t6) { 
    S.t6 = {g3: 7, g2: 4, g1: 1}; 
  }
  if (!S.p6) { 
    S.p6 = {1: 5, 2: 4, 3: 3, 4: 3, 5: 1, 6: 0}; 
  }
  
  // 8-player mode thresholds and points
  if (!S.t8) { 
    S.t8 = {g3: 11, g2: 6, g1: 1}; 
  }
  if (!S.p8) { 
    S.p8 = {1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0}; 
  }
  
  // Game preferences
  if (typeof S.must1 === 'undefined') { 
    S.must1 = true; 
  }
  if (typeof S.autoNext === 'undefined') { 
    S.autoNext = true; // Default to auto-advance
  }
  if (typeof S.autoApply === 'undefined') { 
    S.autoApply = true; // Default to true for better UX
  }
  if (typeof S.strictA === 'undefined') { 
    S.strictA = true; // Default to strict mode
  }
  
  // Team settings
  if (!S.t1) { 
    S.t1 = {name: '蓝队', color: '#3b82f6'}; 
  }
  if (!S.t2) { 
    S.t2 = {name: '红队', color: '#ef4444'}; 
  }

  // ================================
  // Game State Initialization
  // ================================
  var ST = load(KEY_ST, {});
  
  // Team states
  if (!ST.t1) { 
    ST.t1 = {lvl: '2', aFail: 0}; 
  }
  if (!ST.t2) { 
    ST.t2 = {lvl: '2', aFail: 0}; 
  }
  
  // Game history
  if (!ST.hist) { 
    ST.hist = []; 
  }
  
  // Round tracking
  if (!ST.roundLevel) { 
    ST.roundLevel = '2'; 
  }
  if (!ST.nextRoundBase) { 
    ST.nextRoundBase = null; // Key: next round's level to play
  }
  
  var winner = 't1';

  // ================================
  // Player System Variables
  // ================================
  var players = [];
  var playerStats = {};
  var currentRanking = {};
  
  // Drag and drop state
  var draggedPlayer = null;
  var touchDraggedElement = null; // For touch dragging
  var touchClone = null; // Clone element for visual feedback during touch
  var touchStartTimer = null; // Timer for delayed drag start
  var touchStartPos = null; // Initial touch position
  
  // Animal emoji pool for player avatars
  var animalEmojis = [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
    '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆',
    '🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋',
    '🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎',
    '🦖','🦕','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬',
    '🐳','🐋','🦈'
  ];
  
  // ================================
  // Touch Event Handling
  // ================================
  function handleTouchStart(e, player) {
    // Don't start drag if touching an input field
    if (e.target.tagName === 'INPUT') {
      return; // Allow normal input interaction
    }
    
    var touch = e.touches[0];
    var tile = e.currentTarget;
    
    // Store initial touch position
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    
    // Set up delayed drag start (long press)
    touchStartTimer = setTimeout(function() {
      // Start drag after delay
      e.preventDefault();
      draggedPlayer = player;
      touchDraggedElement = tile;
      
      // Create clone for visual feedback
      touchClone = tile.cloneNode(true);
      touchClone.style.position = 'fixed';
      touchClone.style.zIndex = '1000';
      touchClone.style.opacity = '0.8';
      touchClone.style.pointerEvents = 'none';
      touchClone.style.transform = 'scale(1.1)';
      touchClone.classList.add('dragging');
      document.body.appendChild(touchClone);
      
      // Position clone at touch point
      touchClone.style.left = (touch.clientX - tile.offsetWidth/2) + 'px';
      touchClone.style.top = (touch.clientY - tile.offsetHeight/2) + 'px';
      
      // Hide the original tile while dragging
      tile.style.opacity = '0.3';
      tile.classList.add('dragging');
      
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }, 200); // 200ms delay for long press
  }
  
  function handleTouchMove(e) {
    var touch = e.touches[0];
    
    // If we haven't started dragging yet, check for movement
    if (!touchClone && touchStartTimer && touchStartPos) {
      var dx = Math.abs(touch.clientX - touchStartPos.x);
      var dy = Math.abs(touch.clientY - touchStartPos.y);
      
      // Cancel drag start if user moves finger significantly
      if (dx > 10 || dy > 10) {
        clearTimeout(touchStartTimer);
        touchStartTimer = null;
        touchStartPos = null;
        return;
      }
    }
    
    // Only prevent default if we're actually dragging
    if (!touchClone) return;
    e.preventDefault();
    
    // Update clone position
    touchClone.style.left = (touch.clientX - touchClone.offsetWidth/2) + 'px';
    touchClone.style.top = (touch.clientY - touchClone.offsetHeight/2) + 'px';
    
    // Find element under touch point (excluding the clone)
    touchClone.style.display = 'none';
    var elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    touchClone.style.display = 'block';
    
    // Highlight drop zones
    var dropZones = document.querySelectorAll('.rank-slot, .team-drop-zone, #playerPool, #unassignedPlayers');
    dropZones.forEach(function(zone) {
      zone.classList.remove('drag-over');
    });
    
    if (elementBelow) {
      var dropZone = elementBelow.closest('.rank-slot, .team-drop-zone, #playerPool, #unassignedPlayers');
      if (dropZone) {
        dropZone.classList.add('drag-over');
      }
    }
  }
  
  function handleTouchEnd(e) {
    // Clear the timer if it's still running
    if (touchStartTimer) {
      clearTimeout(touchStartTimer);
      touchStartTimer = null;
    }
    touchStartPos = null;
    
    // If we haven't started dragging, restore opacity and return
    if (!touchClone || !draggedPlayer) {
      if (touchDraggedElement) {
        touchDraggedElement.style.opacity = '';
        touchDraggedElement.classList.remove('dragging');
        touchDraggedElement = null;
      }
      return;
    }
    
    e.preventDefault();
    
    var touch = e.changedTouches[0];
    
    // Find element under touch point
    touchClone.style.display = 'none';
    var elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    touchClone.style.display = 'block';
    
    // Handle drop
    
    if (elementBelow && draggedPlayer) {
      var rankSlot = elementBelow.closest('.rank-slot');
      var pool = elementBelow.closest('#playerPool');
      var unassignedZone = elementBelow.closest('#unassignedPlayers');
      var teamZone = elementBelow.closest('.team-drop-zone');
      
      
      if (rankSlot) {
        handleRankDrop(rankSlot, draggedPlayer);
      } else if (pool) {
        handlePoolDrop(draggedPlayer);
      } else if (unassignedZone) {
        // Move player back to unassigned
        draggedPlayer.team = null;
        save('gd_players', players);
        renderPlayers();
        renderRankingArea();
      } else if (teamZone) {
        handleTeamDrop(teamZone, draggedPlayer);
      } else {
      }
    } else {
    }
    
    // Clean up - ensure clone is removed
    if (touchClone) {
      if (touchClone.parentNode) {
        touchClone.parentNode.removeChild(touchClone);
      }
      touchClone = null;
    }
    
    // Also clean up any other floating clones that might exist
    var floatingClones = document.querySelectorAll('.dragging');
    floatingClones.forEach(function(clone) {
      if (clone.style.position === 'fixed' && clone !== touchDraggedElement) {
        if (clone.parentNode) {
          clone.parentNode.removeChild(clone);
        }
      }
    });
    
    if (touchDraggedElement) {
      touchDraggedElement.classList.remove('dragging');
      touchDraggedElement.style.opacity = ''; // Restore original opacity
      touchDraggedElement.style.display = ''; // Ensure visibility is restored
      touchDraggedElement = null;
    }
    
    draggedPlayer = null;
    
    // Clear all highlights
    var dropZones = document.querySelectorAll('.rank-slot, .team-drop-zone, #playerPool, #unassignedPlayers');
    dropZones.forEach(function(zone) {
      zone.classList.remove('drag-over');
    });
    
    // Force re-render to clean up any visual artifacts
    setTimeout(function() {
      renderPlayerPool();
      renderRankingSlots();
    }, 10);
  }
  
  function updateRankingInput() {
    
    var mode = parseInt(modeSel.value);
    
    var isMobile = 'ontouchstart' in window;
    
    if (!isMobile) {
      // Let desktop handle it the original way
      return;
    }
    
    // Check if all positions are filled
    var allFilled = true;
    var filledCount = 0;
    for (var i = 1; i <= mode; i++) {
      if (!currentRanking[i]) {
        allFilled = false;
      } else {
        filledCount++;
      }
    }
    
    
    if (!allFilled) {
      return;
    }
    
    // For mobile, match desktop's calculateFromRanking logic
    // First determine the winner based on who has rank 1
    var firstPlacePlayerId = currentRanking[1];
    var firstPlacePlayer = players.find(function(p) { return p.id === firstPlacePlayerId; });
    
    if (!firstPlacePlayer) {
      return;
    }
    
    
    // Set winner based on first place player's team
    var actualWinner = firstPlacePlayer.team === 1 ? 't1' : 't2';
    setWinner(actualWinner);
    
    // Collect ranks for each team
    var team1Ranks = [];
    var team2Ranks = [];
    
    for (var rank = 1; rank <= mode; rank++) {
      var playerId = currentRanking[rank];
      if (playerId) {
        var player = players.find(function(p) { return p.id === parseInt(playerId); });
        if (player) {
          if (player.team === 1) {
            team1Ranks.push(rank);
          } else {
            team2Ranks.push(rank);
          }
        }
      }
    }
    
    
    // Use the winning team's ranks for calculation
    var winnerRanks = actualWinner === 't1' ? team1Ranks : team2Ranks;
    winnerRanks.sort(function(a, b) { return a - b; });
    
    
    // Set input to winning team's ranks only (not player names!)
    input.value = winnerRanks.join(' ');
    selected = winnerRanks.slice();
    
    // Calculate and check for auto-apply
    var result = calc();
    
    // Auto-apply if enabled and calculation successful
    if (S.autoApply && result && result.ok) {
      applyResult();
    }
  }
  
  function handleRankDrop(slot, player) {
    
    if (!player || !player.id) {
      return;
    }
    
    var rank = parseInt(slot.dataset.rank);
    
    if (!rank) {
      return;
    }
    
    // Clean up any floating clones immediately
    var existingClones = document.querySelectorAll('.dragging');
    existingClones.forEach(function(clone) {
      if (clone.style.position === 'fixed') {
        clone.remove();
      }
    });
    
    // Check if another player was already in this rank
    var existingPlayerId = currentRanking[rank];
    if (existingPlayerId && existingPlayerId !== player.id) {
      // Swap positions if the dragged player is already ranked
      var draggedRank = null;
      for (var r in currentRanking) {
        if (currentRanking[r] === player.id) {
          draggedRank = r;
          break;
        }
      }
      if (draggedRank) {
        // Swap the two players
        currentRanking[draggedRank] = existingPlayerId;
      } else {
        // Move existing player back to pool - don't add to DOM, just remove from ranking
        delete currentRanking[rank];
      }
    }
    
    // Remove player from any existing rank (if not swapping)
    for (var r in currentRanking) {
      if (currentRanking[r] === player.id && r != rank) {
        delete currentRanking[r];
      }
    }
    
    // Add player to new rank
    currentRanking[rank] = player.id;
    
    // Re-render everything to ensure clean state
    renderPlayerPool();
    renderRankingSlots();
    updateRankingInput();
    checkAutoCalculate();
  }
  
  function handleTeamDrop(zone, player) {
    // Clean up any floating clones
    var existingClones = document.querySelectorAll('.dragging');
    existingClones.forEach(function(clone) {
      if (clone.style.position === 'fixed') {
        clone.remove();
      }
    });
    
    var team = parseInt(zone.dataset.team);
    
    // Check if team is full
    var teamPlayers = players.filter(function(p) {
      return p.team === team;
    });
    var maxPerTeam = parseInt(modeSel.value) / 2;
    
    // Don't allow if team is full (not counting the current player if they're already on this team)
    if (teamPlayers.length >= maxPerTeam && !teamPlayers.some(function(p) { return p.id === player.id; })) {
      alert('该队伍已满员！');
      renderPlayers();
      renderRankingArea();
      return;
    }
    
    // Update player's team
    player.team = team;
    save('gd_players', players);
    renderPlayers();
    renderRankingArea();
  }
  
  function handlePoolDrop(player) {
    // Clean up any floating clones
    var existingClones = document.querySelectorAll('.dragging');
    existingClones.forEach(function(clone) {
      if (clone.style.position === 'fixed') {
        clone.remove();
      }
    });
    
    // Remove from ranking
    for (var r in currentRanking) {
      if (currentRanking[r] === player.id) {
        delete currentRanking[r];
      }
    }
    // Re-render everything to ensure clean state
    renderPlayerPool();
    renderRankingSlots();
    updateRankingInput();
    calc();
  }
  
  // Player System Functions
  function generatePlayers(forceNew) {
    var num = parseInt(modeSel.value);
    
    // Always regenerate if no valid number
    if (!num || isNaN(num)) {
      return;
    }
    
    // Try to load saved players first (unless forcing new generation)
    var savedPlayers = load('gd_players', []);
    if (!forceNew && savedPlayers && savedPlayers.length === num) {
      players = savedPlayers;
      // Ensure saved players have proper IDs and teams
      players.forEach(function(player, index) {
        if (!player.id || typeof player.id === 'string') {
          player.id = index + 1;
        }
        // Fix team values - convert string 'A'/'B' to numeric 1/2
        if (player.team === 'A') {
          player.team = 1;
        } else if (player.team === 'B') {
          player.team = 2;
        } else if (!player.team) {
          player.team = null;  // Start unassigned
        }
      });
    } else {
      // Generate new players
      players = [];
      
      // Shuffle emojis
      var shuffledEmojis = animalEmojis.slice().sort(function() { return Math.random() - 0.5; });
      
      for (var i = 0; i < num; i++) {
        var player = {
          id: i + 1,  // Numeric ID matching player number
          name: '玩家' + (i + 1),
          emoji: shuffledEmojis[i % shuffledEmojis.length],
          team: null  // Start with no team assigned
        };
        players.push(player);
      }
    }
    
    // Save the newly generated or loaded players
    save('gd_players', players);
    
    // Load saved player stats if available
    playerStats = load('gd_player_stats', {});
    
    // Clear current ranking when changing player count
    currentRanking = {};
    
    renderPlayers();
    renderRankingArea();
  }
  
  function renderPlayers() {
    var unassigned = $('unassignedPlayers');
    var team1Zone = $('team1Zone');
    var team2Zone = $('team2Zone');
    
    // Clear zones but keep the label
    unassigned.innerHTML = '';
    team1Zone.innerHTML = '';
    team2Zone.innerHTML = '';
    
    // Add labels for team zones if they're empty
    var team1Players = players.filter(function(p) { return p.team === 1; });
    var team2Players = players.filter(function(p) { return p.team === 2; });
    
    if (team1Players.length === 0) {
      team1Zone.innerHTML = '<div class="label">拖拽玩家到这里分配队伍</div>';
    }
    if (team2Players.length === 0) {
      team2Zone.innerHTML = '<div class="label">拖拽玩家到这里分配队伍</div>';
    }
    
    players.forEach(function(player) {
      var tile = createPlayerTile(player);
      
      if (player.team === 1) {
        team1Zone.appendChild(tile);
        tile.style.borderColor = S.t1.color;
      } else if (player.team === 2) {
        team2Zone.appendChild(tile);
        tile.style.borderColor = S.t2.color;
      } else {
        unassigned.appendChild(tile);
      }
    });
    
    updateTeamLabels();
  }
  
  function createPlayerTile(player) {
    var tile = document.createElement('div');
    tile.className = 'player-tile';
    tile.draggable = true;
    tile.dataset.playerId = player.id;
    
    var emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = player.emoji;
    
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = player.name;
    nameInput.onclick = function(e) { e.stopPropagation(); };
    // Update with debouncing for performance
    var updateTimer = null;
    var updateName = function() {
      player.name = this.value;
      save('gd_players', players);
      
      // Debounce the UI updates
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(function() {
        // Update ranking display if this player is ranked
        renderPlayerPool();
        renderRankingSlots();
        // Also update statistics display
        renderStatistics();
      }, 300);
    };
    nameInput.oninput = updateName;
    nameInput.onchange = function() {
      player.name = this.value;
      save('gd_players', players);
      // Immediate update on change (blur)
      if (updateTimer) clearTimeout(updateTimer);
      renderPlayerPool();
      renderRankingSlots();
      renderStatistics();
    };
    
    tile.appendChild(emoji);
    tile.appendChild(nameInput);
    
    // Drag events
    tile.ondragstart = function(e) {
      draggedPlayer = player;
      tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    };
    
    tile.ondragend = function() {
      tile.classList.remove('dragging');
      draggedPlayer = null;
    };
    
    // Touch events for mobile
    tile.addEventListener('touchstart', function(e) {
      handleTouchStart(e, player);
    }, { passive: false });
    
    tile.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    tile.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    tile.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    
    return tile;
  }
  
  function setupDropZones() {
    var zones = [
      { el: $('unassignedPlayers'), team: null },
      { el: $('team1Zone'), team: 1 },
      { el: $('team2Zone'), team: 2 }
    ];
    
    zones.forEach(function(zone) {
      zone.el.ondragover = function(e) {
        e.preventDefault();
        zone.el.classList.add('drag-over');
      };
      
      zone.el.ondragleave = function() {
        zone.el.classList.remove('drag-over');
      };
      
      zone.el.ondrop = function(e) {
        e.preventDefault();
        zone.el.classList.remove('drag-over');
        
        if (draggedPlayer) {
          // Update the team assignment
          draggedPlayer.team = zone.team;
          
          // If moving to a team zone, check if that team is already full
          if (zone.team !== null) {
            var teamPlayers = players.filter(function(p) {
              return p.team === zone.team;
            });
            var maxPerTeam = parseInt(modeSel.value) / 2;
            
            // Don't allow if team is full (not counting the current player if they're already on this team)
            if (teamPlayers.length >= maxPerTeam && !teamPlayers.some(function(p) { return p.id === draggedPlayer.id; })) {
              alert('该队伍已满员！');
              return;
            }
          }
          
          save('gd_players', players);
          renderPlayers();
          renderRankingArea();
        }
      };
    });
  }
  
  function shuffleTeams() {
    var num = parseInt(modeSel.value);
    var halfSize = num / 2;
    
    // Shuffle players
    var shuffled = players.slice().sort(function() { return Math.random() - 0.5; });
    
    // Assign to teams
    shuffled.forEach(function(player, i) {
      player.team = i < halfSize ? 1 : 2;
    });
    
    save('gd_players', players);
    renderPlayers();
    renderRankingArea();
  }
  
  function renderRankingArea() {
    var pool = $('playerPool');
    var area = $('rankingArea');
    var num = parseInt(modeSel.value);
    var allAssigned = players.every(function(p) { return p.team !== null; });
    
    if (!allAssigned) {
      pool.innerHTML = '<div class="small muted">请先分配所有玩家到队伍</div>';
      area.innerHTML = '';
      return;
    }
    
    // Render player pool
    renderPlayerPool();
    
    // Render ranking slots
    area.innerHTML = '';
    
    for (var rank = 1; rank <= num; rank++) {
      var slot = document.createElement('div');
      slot.className = 'rank-slot';
      slot.dataset.rank = rank;
      
      var number = document.createElement('div');
      number.className = 'rank-number';
      number.textContent = '第' + rank + '名';
      slot.appendChild(number);
      
      // Drop events for ranking
      slot.ondragover = function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
      };
      
      slot.ondragleave = function() {
        this.classList.remove('drag-over');
      };
      
      slot.ondrop = (function(r) {
        return function(e) {
          e.preventDefault();
          this.classList.remove('drag-over');
          
          if (draggedPlayer) {
            // Check if another player was already in this rank
            var existingPlayerId = currentRanking[r];
            if (existingPlayerId && existingPlayerId !== draggedPlayer.id) {
              // Swap positions if the dragged player is already ranked
              var draggedRank = null;
              for (var rank in currentRanking) {
                if (currentRanking[rank] === draggedPlayer.id) {
                  draggedRank = rank;
                  break;
                }
              }
              if (draggedRank) {
                // Swap the two players
                currentRanking[draggedRank] = existingPlayerId;
              } else {
                // Move existing player back to pool
                delete currentRanking[r];
              }
            }
            
            // Remove from previous rank if any
            for (var oldRank in currentRanking) {
              if (currentRanking[oldRank] === draggedPlayer.id) {
                delete currentRanking[oldRank];
                break;
              }
            }
            
            // Add to new rank
            currentRanking[r] = draggedPlayer.id;
            renderPlayerPool();
            renderRankingSlots();
            // Force check auto calculate after updating ranking
            setTimeout(function() {
              checkAutoCalculate();
            }, 100);
          }
        };
      })(rank);
      
      area.appendChild(slot);
    }
  }
  
  function renderPlayerPool() {
    var pool = $('playerPool');
    pool.innerHTML = '';
    
    // Add drop zone for returning players to pool
    pool.ondragover = function(e) {
      e.preventDefault();
      pool.classList.add('drag-over');
    };
    
    pool.ondragleave = function() {
      pool.classList.remove('drag-over');
    };
    
    pool.ondrop = function(e) {
      e.preventDefault();
      pool.classList.remove('drag-over');
      
      if (draggedPlayer) {
        // Remove from ranking
        for (var rank in currentRanking) {
          if (currentRanking[rank] === draggedPlayer.id) {
            delete currentRanking[rank];
            break;
          }
        }
        renderPlayerPool();
        renderRankingSlots();
        checkAutoCalculate();
      }
    };
    
    // Add players not yet ranked
    players.forEach(function(player) {
      var isRanked = false;
      for (var rank in currentRanking) {
        if (currentRanking[rank] === player.id) {
          isRanked = true;
          break;
        }
      }
      
      if (!isRanked) {
        var tile = createRankingPlayerTile(player);
        pool.appendChild(tile);
      }
    });
    
    if (pool.children.length === 0) {
      pool.innerHTML = '<div class="small muted">所有玩家已排名</div>';
    }
  }
  
  function createRankingPlayerTile(player) {
    var tile = document.createElement('div');
    tile.className = 'ranking-player-tile';
    tile.draggable = true;
    tile.dataset.playerId = player.id;
    
    // Apply team color
    tile.style.borderColor = player.team === 1 ? S.t1.color : S.t2.color;
    
    var emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = player.emoji;
    
    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = player.name;
    
    tile.appendChild(emoji);
    tile.appendChild(name);
    
    // Drag events
    tile.ondragstart = function(e) {
      draggedPlayer = player;
      tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    };
    
    tile.ondragend = function() {
      tile.classList.remove('dragging');
      draggedPlayer = null;
    };
    
    // Touch events for mobile
    tile.addEventListener('touchstart', function(e) {
      handleTouchStart(e, player);
    }, { passive: false });
    
    tile.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    tile.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    tile.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    
    return tile;
  }
  
  function renderRankingSlots() {
    var area = $('rankingArea');
    var slots = area.querySelectorAll('.rank-slot');
    
    slots.forEach(function(slot) {
      var rank = parseInt(slot.dataset.rank);
      var playerId = currentRanking[rank];
      
      // Remove existing player tiles (keep rank number)
      var existingTiles = slot.querySelectorAll('.ranking-player-tile');
      existingTiles.forEach(function(t) { t.remove(); });
      
      if (playerId) {
        var player = players.find(function(p) { return p.id === parseInt(playerId); });
        if (player) {
          var tile = createRankingPlayerTile(player);
          slot.appendChild(tile);
          slot.classList.add('filled');
        }
      } else {
        slot.classList.remove('filled');
      }
    });
  }
  
  function clearRanking() {
    currentRanking = {};
    renderPlayerPool();
    renderRankingSlots();
    checkAutoCalculate();
  }
  
  function randomizeRanking() {
    var num = parseInt(modeSel.value);
    
    // Check if all players are assigned to teams
    var allAssigned = players.every(function(p) { return p.team !== null; });
    if (!allAssigned) {
      alert('请先分配所有玩家到队伍');
      return;
    }
    
    // Clear current ranking
    currentRanking = {};
    
    // Create a shuffled array of player IDs
    var playerIds = players.map(function(p) { return p.id; });
    
    // Fisher-Yates shuffle
    for (var i = playerIds.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = playerIds[i];
      playerIds[i] = playerIds[j];
      playerIds[j] = temp;
    }
    
    // Assign shuffled players to ranking positions
    for (var rank = 1; rank <= num; rank++) {
      currentRanking[rank] = playerIds[rank - 1];
    }
    
    
    // Update display
    renderPlayerPool();
    renderRankingSlots();
    
    // Auto calculate
    checkAutoCalculate();
  }
  
  
  function checkAutoCalculate() {
    var num = parseInt(modeSel.value);
    var rankedCount = 0;
    
    // Count how many players are actually ranked
    for (var i = 1; i <= num; i++) {
      if (currentRanking[i]) {
        rankedCount++;
      }
    }
    
    // Show current state
    
    var allRanked = rankedCount === num;
    
    if (allRanked) {
      calculateFromRanking();
    } else {
      // Show progress
      headline.textContent = '已排名 ' + rankedCount + ' / ' + num + ' 位玩家';
      explain.textContent = '请继续拖拽剩余玩家到排名位置';
      if (winnerDisplay) winnerDisplay.textContent = '—';
    }
  }
  
  function calculateFromRanking() {
    var num = parseInt(modeSel.value);
    
    // Count properly ranked players
    var rankedCount = 0;
    for (var i = 1; i <= num; i++) {
      if (currentRanking[i]) {
        rankedCount++;
      }
    }
    
    
    if (rankedCount !== num) {
      // If not all players are ranked, clear results
      headline.textContent = '等待排名完成 (' + rankedCount + '/' + num + ')';
      explain.textContent = '请将所有玩家拖到排名位置';
      if (winnerDisplay) winnerDisplay.textContent = '—';
      return;
    }
    
    // First, determine who won based on who has rank 1
    var firstPlacePlayerId = currentRanking[1];
    if (!firstPlacePlayerId) {
      headline.textContent = '错误：未找到第1名';
      return;
    }
    
    var firstPlacePlayer = players.find(function(p) { return p.id === firstPlacePlayerId; });
    
    if (!firstPlacePlayer) {
      headline.textContent = '错误：未找到第1名玩家';
      return;
    }
    
    // Set winner based on who has first place
    var actualWinner = firstPlacePlayer.team === 1 ? 't1' : 't2';
    setWinner(actualWinner);
    
    var team1Ranks = [];
    var team2Ranks = [];
    
    for (var rank = 1; rank <= num; rank++) {
      var playerId = currentRanking[rank];
      if (playerId) {
        var player = players.find(function(p) { return p.id === parseInt(playerId); });
        if (player) {
          if (player.team === 1) {
            team1Ranks.push(rank);
          } else {
            team2Ranks.push(rank);
          }
        }
      }
    }
    
    // Use the winning team's ranks for calculation
    var winnerRanks = actualWinner === 't1' ? team1Ranks : team2Ranks;
    winnerRanks.sort(function(a, b) { return a - b; });
    
    // Set the ranks input value
    input.value = winnerRanks.join(' ');
    selected = winnerRanks.slice();
    
    // Calculate and display results
    var result = calc();
    
    // Auto-apply if enabled and calculation successful
    if (S.autoApply && result.ok) {
      applyResult();
    }
  }
  
  function updatePlayerStats() {
    var num = parseInt(modeSel.value);
    var lastPlace = num; // 4, 6, or 8 depending on mode
    
    for (var rank = 1; rank <= num; rank++) {
      var playerId = currentRanking[rank];
      if (playerId) {
        var player = players.find(function(p) { return p.id === parseInt(playerId); });
        if (player) {
          if (!playerStats[playerId]) {
            playerStats[playerId] = {
              games: 0,
              totalRank: 0,
              firstPlaceCount: 0,  // Count of 1st place finishes
              lastPlaceCount: 0,   // Count of last place finishes
              rankings: []
            };
          }
          
          var stats = playerStats[playerId];
          stats.games++;
          stats.totalRank += rank;
          stats.rankings.push(rank);
          
          // Count first and last places
          if (rank === 1) {
            stats.firstPlaceCount = (stats.firstPlaceCount || 0) + 1;
          }
          if (rank === lastPlace) {
            stats.lastPlaceCount = (stats.lastPlaceCount || 0) + 1;
          }
        }
      }
    }
    
    save('gd_player_stats', playerStats);
    renderStatistics();
  }
  
  function renderStatistics() {
    renderPlayerStatsTable();
    renderTeamMVPBurden();
  }
  
  function renderPlayerStatsTable() {
    var tbody = $('playerStatsBody');
    tbody.innerHTML = '';
    
    // Collect player data with stats
    var playerData = [];
    players.forEach(function(player) {
      var stats = playerStats[player.id];
      if (stats && stats.games > 0) {
        var avgRank = stats.totalRank / stats.games;
        playerData.push({
          player: player,
          stats: stats,
          avgRank: avgRank
        });
      }
    });
    
    if (playerData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted small">暂无数据</td></tr>';
      return;
    }
    
    // Sort by team first, then by average ranking (best to worst within each team)
    playerData.sort(function(a, b) {
      // First sort by team
      if (a.player.team !== b.player.team) {
        return (a.player.team || 999) - (b.player.team || 999); // Unassigned teams go last
      }
      // Then sort by average rank within team (lower is better)
      return a.avgRank - b.avgRank;
    });
    
    // Render sorted data
    playerData.forEach(function(data) {
      var player = data.player;
      var stats = data.stats;
      var tr = document.createElement('tr');
      var avgRankDisplay = data.avgRank.toFixed(2);
      var teamName = player.team === 1 ? S.t1.name : (player.team === 2 ? S.t2.name : '未分配');
      var teamColor = player.team === 1 ? S.t1.color : (player.team === 2 ? S.t2.color : '#666');
      
      // Add subtle team background
      if (player.team === 1 || player.team === 2) {
        tr.style.background = 'linear-gradient(90deg, ' + teamColor + '08, transparent)';
      }
      
      tr.innerHTML = '<td><span class="emoji">' + player.emoji + '</span>' + player.name + '</td>' +
                    '<td><span style="color:' + teamColor + ';font-weight:bold">' + teamName + '</span></td>' +
                    '<td>' + stats.games + '</td>' +
                    '<td><b>' + avgRankDisplay + '</b></td>' +
                    '<td>' + (stats.firstPlaceCount || 0) + '</td>' +
                    '<td>' + (stats.lastPlaceCount || 0) + '</td>';
      tbody.appendChild(tr);
    });
  }
  
  function renderTeamMVPBurden() {
    var team1Players = players.filter(function(p) { return p.team === 1; });
    var team2Players = players.filter(function(p) { return p.team === 2; });
    
    function findMVPAndBurden(teamPlayers) {
      var mvp = null, burden = null;
      var bestAvg = 999, worstAvg = 0;
      
      teamPlayers.forEach(function(player) {
        var stats = playerStats[player.id];
        if (stats && stats.games > 0) {
          var avg = stats.totalRank / stats.games;
          if (avg < bestAvg) {
            bestAvg = avg;
            mvp = player;
          }
          if (avg > worstAvg) {
            worstAvg = avg;
            burden = player;
          }
        }
      });
      
      return { mvp: mvp, burden: burden };
    }
    
    var team1Result = findMVPAndBurden(team1Players);
    var team2Result = findMVPAndBurden(team2Players);
    
    $('team1StatsTitle').textContent = S.t1.name;
    $('team2StatsTitle').textContent = S.t2.name;
    
    $('team1MVP').innerHTML = team1Result.mvp ? 
      '<span class="emoji">' + team1Result.mvp.emoji + '</span>' + team1Result.mvp.name : '—';
    $('team1Burden').innerHTML = team1Result.burden ? 
      '<span class="emoji">' + team1Result.burden.emoji + '</span>' + team1Result.burden.name : '—';
    
    $('team2MVP').innerHTML = team2Result.mvp ? 
      '<span class="emoji">' + team2Result.mvp.emoji + '</span>' + team2Result.mvp.name : '—';
    $('team2Burden').innerHTML = team2Result.burden ? 
      '<span class="emoji">' + team2Result.burden.emoji + '</span>' + team2Result.burden.name : '—';
  }
  
  function updateTeamLabels() {
    $('team1Label').textContent = S.t1.name;
    $('team2Label').textContent = S.t2.name;
    $('team1Label').style.color = S.t1.color;
    $('team2Label').style.color = S.t2.color;
  }

  // Utils
  function hexToRgb(hex){ var h=hex.replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; return {r:parseInt(h.substr(0,2),16),g:parseInt(h.substr(2,2),16),b:parseInt(h.substr(4,2),16)}; }
  function rgba(hex,a){ var c=hexToRgb(hex); return 'rgba('+c.r+','+c.g+','+c.b+','+a+')'; }
  function setWinner(w){ 
    winner=w; 
    if (winnerDisplay) {
      winnerDisplay.textContent = w === 't1' ? S.t1.name : S.t2.name;
      winnerDisplay.style.color = w === 't1' ? S.t1.color : S.t2.color;
    }
    refreshPreviewOnly(); 
  }
  function addRipple(ev,el,color){ var r=document.createElement('span'); var rect=el.getBoundingClientRect(), d=Math.max(rect.width,rect.height)*1.4; r.className='ripple'; r.style.width=r.style.height=d+'px'; r.style.left=(ev.clientX-rect.left-d/2)+'px'; r.style.top=(ev.clientY-rect.top-d/2)+'px'; r.style.background=rgba(color,.35); el.appendChild(r); setTimeout(function(){ if(r.parentNode) r.parentNode.removeChild(r); },650); }

  function applyTeamStyles(){ 
    t1NameChip.style.background=S.t1.color; 
    t2NameChip.style.background=S.t2.color; 
    t1NameChip.style.color=t2NameChip.style.color='#fff'; 
    t1NameChip.innerHTML='<b>'+S.t1.name+'</b>'; 
    t2NameChip.innerHTML='<b>'+S.t2.name+'</b>'; 
    hT1.innerText=S.t1.name; 
    hT2.innerText=S.t2.name; 
    autoNext.checked=!!S.autoNext;
    autoApply.checked=!!S.autoApply;
    strictA.checked=!!S.strictA; 
    // Update winner display if set
    if (winnerDisplay && winner) {
      winnerDisplay.textContent = winner === 't1' ? S.t1.name : S.t2.name;
      winnerDisplay.style.color = winner === 't1' ? S.t1.color : S.t2.color;
    }
  }
  applyTeamStyles();

  function updateRuleHint(){ var mode=modeSel.value; if(mode==='4'){ ruleHint.textContent='4人：固定表 ('+S.c4['1,2']+','+S.c4['1,3']+','+S.c4['1,4']+')'; } else if(mode==='6'){ ruleHint.textContent='6人：分差≥'+S.t6.g3+' 升3；≥'+S.t6.g2+' 升2；≥'+S.t6.g1+' 升1'; } else { ruleHint.textContent='8人：分差≥'+S.t8.g3+' 升3；≥'+S.t8.g2+' 升2；≥'+S.t8.g1+' 升1'; } }
  updateRuleHint();

  function renderTeams(){ 
    t1Lvl.textContent=ST.t1.lvl; 
    t2Lvl.textContent=ST.t2.lvl; 
    t1A.textContent=ST.t1.aFail||0; 
    t2A.textContent=ST.t2.aFail||0; 
    t1AState.textContent=(ST.t1.lvl==='A')?('A'+(ST.t1.aFail||0)+'/3'):'—'; 
    t2AState.textContent=(ST.t2.lvl==='A')?('A'+(ST.t2.aFail||0)+'/3'):'—'; 
    
    // Show which team's level we're playing at
    var roundTeamName = '';
    if (String(ST.roundLevel) === String(ST.t1.lvl) && String(ST.roundLevel) !== String(ST.t2.lvl)) {
      roundTeamName = ' (' + S.t1.name + ')';
    } else if (String(ST.roundLevel) === String(ST.t2.lvl) && String(ST.roundLevel) !== String(ST.t1.lvl)) {
      roundTeamName = ' (' + S.t2.name + ')';
    }
    curRoundLvl.textContent = ST.roundLevel + roundTeamName;
    
    // Show next round preview with team name
    var nextRound = ST.nextRoundBase || ST.roundLevel || '-';
    var nextTeamName = '';
    if (ST.nextRoundBase) {
      // There's a pending next round, figure out which team it would be
      if (ST.nextRoundBase === ST.t1.lvl && ST.nextRoundBase !== ST.t2.lvl) {
        nextTeamName = ' (' + S.t1.name + ')';
      } else if (ST.nextRoundBase === ST.t2.lvl && ST.nextRoundBase !== ST.t1.lvl) {
        nextTeamName = ' (' + S.t2.name + ')';
      }
    }
    nextRoundPreview.textContent = nextRound + nextTeamName;
  }
  renderTeams();

  // Rules saving
  function collectAndSaveRules(){ S.c4={'1,2':+$('c4_12').value||0,'1,3':+$('c4_13').value||0,'1,4':+$('c4_14').value||0}; S.t6={g3:+$('t6_3').value||7,g2:+$('t6_2').value||4,g1:+$('t6_1').value||1}; S.p6={1:+$('p6_1').value||0,2:+$('p6_2').value||0,3:+$('p6_3').value||0,4:+$('p6_4').value||0,5:+$('p6_5').value||0,6:+$('p6_6').value||0}; S.t8={g3:+$('t8_3').value||11,g2:+$('t8_2').value||6,g1:+$('t8_1').value||1}; S.p8={1:+$('p8_1').value||0,2:+$('p8_2').value||0,3:+$('p8_3').value||0,4:+$('p8_4').value||0,5:+$('p8_5').value||0,6:+$('p8_6').value||0,7:+$('p8_7').value||0,8:+$('p8_8').value||0}; save(KEY_S,S); updateRuleHint(); refreshPreviewOnly(); }
  on($('save4'),'click',collectAndSaveRules); on($('save6'),'click',collectAndSaveRules); on($('save8'),'click',collectAndSaveRules);
  must1.checked=!!S.must1; on(must1,'change',function(){ S.must1=!!must1.checked; save(KEY_S,S); refreshPreviewOnly(); });
  on(autoNext,'change',function(){ S.autoNext=!!autoNext.checked; save(KEY_S,S); });
  on(autoApply,'change',function(){ S.autoApply=!!autoApply.checked; save(KEY_S,S); });
  on(strictA,'change',function(){ S.strictA=!!strictA.checked; save(KEY_S,S); });

  // Helpers
  function parseRanks(text, need){ if(!text) return {ok:false,msg:'请输入名次'}; var t=String(text).trim(), maxn=(need===2?4:(need===3?6:8)), re=new RegExp('^[0-9]{'+need+'}$'); if(re.test(t)){ var arr=t.split(''), nums=[], i; for(i=0;i<arr.length;i++) nums.push(parseInt(arr[i],10)); var seen={}, j; for(j=0;j<nums.length;j++){ if(nums[j]<1||nums[j]>maxn) return {ok:false,msg:'名次超出范围'}; if(seen[nums[j]]) return {ok:false,msg:'名次不能重复'}; seen[nums[j]]=1; } nums.sort(function(a,b){return a-b;}); return {ok:true,ranks:nums}; } var parts=t.replace(/[^0-9]+/g,' ').trim().split(/\s+/); if(parts.length!==need) return {ok:false,msg:'需要 '+need+' 个名次'}; var nums2=[], k; for(k=0;k<parts.length;k++){ var n=parseInt(parts[k],10); if(!(n>=1&&n<=maxn)) return {ok:false,msg:'名次必须在 1~'+maxn}; nums2.push(n); } var seen2={}, m; for(m=0;m<nums2.length;m++){ if(seen2[nums2[m]]) return {ok:false,msg:'名次不能重复'}; seen2[nums2[m]]=1; } nums2.sort(function(a,b){return a-b;}); return {ok:true,ranks:nums2}; }
  function sum(a){var s=0,i;for(i=0;i<a.length;i++)s+=a[i];return s;}
  function scoreSum(r,map){var s=0,i;for(i=0;i<r.length;i++)s+=(map[r[i]]||0);return s;}
  function tier(diff,t){if(diff>=t.g3)return 3;if(diff>=t.g2)return 2;if(diff>=t.g1)return 1;return 0;}
  function nextLevel(curr,inc){var L=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];var i=Math.max(0,L.indexOf(curr));return L[Math.min(L.length-1,i+inc)];}

  function calc(){
    var mode=modeSel.value, need=(mode==='4'?2:(mode==='6'?3:4));
    
    // Check if we have valid ranking input
    if (!input.value) {
      headline.textContent='等待排名完成';
      explain.textContent='请将所有玩家拖到排名位置';
      refreshPreviewOnly();
      return {ok:false};
    }
    
    var pr=parseRanks(input.value, need);
    if(!pr.ok){ headline.textContent='输入有误'; explain.textContent=pr.msg; refreshPreviewOnly(); return {ok:false}; }
    var r=pr.ranks, up=0, ours=null, opp=null, diff=null;
    if(mode==='4'){ up=S.c4[r[0]+','+r[1]]||0; }
    else if(mode==='6'){ ours=scoreSum(r,S.p6); opp=sum([S.p6[1],S.p6[2],S.p6[3],S.p6[4],S.p6[5],S.p6[6]])-ours; diff=ours-opp; up=(S.must1 && r.indexOf(1)===-1)?0:tier(diff,S.t6); }
    else{ 
      // Special case: if team gets 1,2,3,4 (complete sweep), upgrade 4 levels
      if(r.length === 4 && r[0] === 1 && r[1] === 2 && r[2] === 3 && r[3] === 4) {
        up = 4;
      } else {
        ours=scoreSum(r,S.p8); opp=sum([S.p8[1],S.p8[2],S.p8[3],S.p8[4],S.p8[5],S.p8[6],S.p8[7],S.p8[8]])-ours; diff=ours-opp; up=(S.must1 && r.indexOf(1)===-1)?0:tier(diff,S.t8);
      }
    }
    // Add team name to upgrade label
    var winnerName = winner === 't1' ? S.t1.name : S.t2.name;
    var label=(up>0?(winnerName+' 升 '+up+' 级'):'不升级');
    var base=ST.roundLevel;
    // Calculate what the next round would be if we apply this result
    var winnerCurrentLevel = (winner==='t1')?ST.t1.lvl:ST.t2.lvl;
    var winnerNewLevel = nextLevel(winnerCurrentLevel, up);
    var preview = ST.nextRoundBase || winnerNewLevel;
    // Get team names for display
    var winnerName = winner === 't1' ? S.t1.name : S.t2.name;
    var loserName = winner === 't1' ? S.t2.name : S.t1.name;
    var currentRoundTeam = base === ST.t1.lvl ? S.t1.name : (base === ST.t2.lvl ? S.t2.name : '');
    headline.textContent=(mode+'人：'+ '('+r.join(',')+')'+' → '+label+'｜本局 '+base+(currentRoundTeam?' ('+currentRoundTeam+')':'')+' → 下局 '+preview+' ('+winnerName+')');
    explain.textContent=(mode==='4'?'4人表：(1,2)='+S.c4['1,2']+'；(1,3)='+S.c4['1,3']+'；(1,4)='+S.c4['1,4'] : '分差与资格规则已计算');
    refreshPreviewOnly();
    return {ok:true,mode:mode,ranks:r,up:up,base:base,preview:winnerNewLevel};
  }

  function refreshPreviewOnly(){ 
    // If there's a pending next round, show it. Otherwise show current winner's level
    if (ST.nextRoundBase) {
      nextRoundPreview.textContent = ST.nextRoundBase;
    } else {
      // In auto-next mode or no pending round, preview is same as current round
      nextRoundPreview.textContent = ST.roundLevel || '-';
    }
  }


  // History
  var histBody=$('histBody'), exportTip=$('exportTip');
  function renderHistory(){ 
    histBody.innerHTML=''; 
    for(var i=0;i<ST.hist.length;i++){ 
      (function(idx){ 
        var h=ST.hist[idx]; 
        var tr=document.createElement('tr'); 
        tr.className='tinted'; 
        // Add color coding based on winning team
        var winColor = h.winKey === 't1' ? S.t1.color : S.t2.color;
        tr.style.background = 'linear-gradient(90deg, ' + winColor + '10, transparent)';
        
        // Add team name to upgrade display
        var upgradeText = h.up ? (h.win + ' 升' + h.up + '级') : '不升级';
        
        // Build player ranking display if available
        var rankingDisplay = '';
        if (h.playerRankings) {
          var rankingParts = [];
          for (var i = 1; i <= parseInt(h.mode); i++) {
            if (h.playerRankings[i]) {
              var p = h.playerRankings[i];
              var teamColor = p.team === 1 ? S.t1.color : S.t2.color;
              rankingParts.push('<span style="color:' + teamColor + '">' + p.emoji + p.name + '</span>');
            }
          }
          if (rankingParts.length > 0) {
            rankingDisplay = rankingParts.join(' ');
          }
        }
        
        // Keep the original combo display
        var comboDisplay = h.combo || '';
        
        tr.innerHTML='<td>'+(idx+1)+'</td><td>'+h.ts+'</td><td>'+h.mode+'</td><td>'+comboDisplay+'</td><td>'+rankingDisplay+'</td><td>'+upgradeText+'</td><td style="color:'+winColor+';font-weight:bold">'+h.win+'</td><td>'+h.t1+'</td><td>'+h.t2+'</td><td>'+h.round+'</td><td>'+h.aNote+'</td>'; 
        var td=document.createElement('td'); 
        var b=document.createElement('button'); 
        b.textContent='回滚至此前'; 
        b.onclick=function(){ rollbackTo(idx); }; 
        td.appendChild(b); 
        tr.appendChild(td); 
        histBody.appendChild(tr); 
      })(i); 
    } 
  }

  // Apply & advance
  function applyResult(){ var r=calc(); if(!r.ok){ applyTip.textContent='请先计算'; return; } var win=winner, lose=(win==='t1'?'t2':'t1'); var thisRound = ST.roundLevel;
    // Snapshot
    var snap={prevT1Lvl:ST.t1.lvl,prevT1A:ST.t1.aFail||0,prevT2Lvl:ST.t2.lvl,prevT2A:ST.t2.aFail||0,prevRound:ST.roundLevel};
    // 升级
    var winNew=nextLevel(ST[win].lvl, r.up), loseNew=ST[lose].lvl;
    var nextBaseByRule = winNew; // 关键：下局 = 胜方升级后的级牌
    // A 规则
    var aNote='', finalWin=false, aTeam=null;
    var lastR=(r.mode==='4'?4:(r.mode==='6'?6:8)), winnerHasLast=(r.ranks.indexOf(lastR)>=0);
    if(ST.t1.lvl==='A' && ST.t2.lvl==='A') aTeam=win; else if(ST.t1.lvl==='A') aTeam='t1'; else if(ST.t2.lvl==='A') aTeam='t2';
    if(aTeam){
      if(aTeam===win){
        if(winnerHasLast){ // 胜方带末游 -> 不通关
          // Only count as failure if it's their own round
          if(ST.roundOwner === aTeam) {
            ST[aTeam].aFail=(ST[aTeam].aFail||0)+1; 
            aNote=((aTeam==='t1'?S.t1.name:S.t2.name))+' A级失败（在自己的A级胜方含末游）→ A'+ST[aTeam].aFail;
            if(ST[aTeam].aFail>=3){ 
              winNew='2'; // Reset winner to level 2
              ST[aTeam].aFail=0; 
              aNote+='｜累计3次失败，仅该队重置到2'; 
            } else {
              winNew=ST[win].lvl; // 本局不升级
            }
          } else {
            winNew=ST[win].lvl; // 本局不升级
            aNote=((aTeam==='t1'?S.t1.name:S.t2.name))+' 在对方回合（'+(ST.roundOwner==='t1'?S.t1.name:S.t2.name)+'的级）胜但含末游，不通关但A失败不计';
          }
        }else{
          // Check strict mode - in strict mode, must win at YOUR OWN A level
          if(S.strictA && (ST.roundLevel !== 'A' || ST.roundOwner !== aTeam)){
            // In strict mode, must be playing at A level AND it must be your own round
            var roundOwnerName = ST.roundOwner ? (ST.roundOwner==='t1'?S.t1.name:S.t2.name) : '未知';
            if(ST.roundLevel !== 'A') {
              aNote=((aTeam==='t1'?S.t1.name:S.t2.name))+' A级胜利（但本局级牌为'+ST.roundLevel+'，需在自己的A级获胜才能通关）';
            } else {
              aNote=((aTeam==='t1'?S.t1.name:S.t2.name))+' A级胜利（但在'+roundOwnerName+'的回合，需在自己的A级获胜才能通关）';
            }
            // Still no upgrade, but no failure count increase
            winNew=ST[win].lvl;
          } else {
            // Either lenient mode, or (strict mode and playing at YOUR OWN A level)
            finalWin=true; 
            aNote=((aTeam==='t1'?S.t1.name:S.t2.name))+' A级通关（胜方无末游'+(S.strictA?'，在自己的A级':'')+')';
          }
        }
      }else{
        // Only increment A-fail counter if it's the A-team's own round
        // Check if this team owns the current round (their level is being played)
        if(ST.roundOwner === aTeam) {
          ST[aTeam].aFail=(ST[aTeam].aFail||0)+1; 
          aNote=((aTeam==='t1'?S.t1.name:S.t2.name))+' A级失败（在自己的A级未取胜）→ A'+ST[aTeam].aFail;
          if(ST[aTeam].aFail>=3){ 
            // Reset the losing A-team to level 2
            if(aTeam === win) {
              winNew = '2';
            } else {
              loseNew = '2';
            }
            ST[aTeam].aFail=0; 
            aNote+='｜累计3次失败，仅该队重置到2'; 
          }
        } else {
          aNote=((aTeam==='t1'?S.t1.name:S.t2.name))+' 在对方回合（'+(ST.roundOwner==='t1'?S.t1.name:S.t2.name)+'的级）未胜，A失败不计';
        }
      }
    }
    // 应用升级至队伍
    ST[win].lvl=winNew; ST[lose].lvl=loseNew;
    // 决定并保存"下局级牌"
    if(S.autoNext || finalWin){ 
      ST.roundLevel = String(nextBaseByRule); // Move to next round (winner's new level)
      ST.roundOwner = win; // The winner owns the next round
      ST.nextRoundBase=null; 
    }
    else { 
      ST.roundLevel = String(thisRound); // Stay at current round
      ST.nextRoundBase = String(nextBaseByRule); // But preview shows what next round would be
      // Don't change round owner when staying at same round
    }
    // Build player ranking details for history
    var playerRankings = {};
    for (var rank in currentRanking) {
      var playerId = currentRanking[rank];
      var player = players.find(function(p) { return p.id === playerId; });
      if (player) {
        playerRankings[rank] = {
          id: player.id,
          name: player.name,
          emoji: player.emoji,
          team: player.team
        };
      }
    }
    
    // 写历史
    var row={ts:now(),mode:r.mode,combo:'('+r.ranks.join(',')+')',up:r.up,win:(win==='t1'?S.t1.name:S.t2.name),t1:ST.t1.lvl,t2:ST.t2.lvl,round:thisRound,aNote:aNote,winKey:win,prevT1Lvl:snap.prevT1Lvl,prevT1A:snap.prevT1A,prevT2Lvl:snap.prevT2Lvl,prevT2A:snap.prevT2A,prevRound:snap.prevRound,playerRankings:playerRankings};
    ST.hist.push(row); save(KEY_ST,ST);
    // Update player stats
    updatePlayerStats();
    // Clear ranking for next round
    currentRanking = {};
    input.value = ''; // Clear the input as well
    renderTeams(); renderHistory(); calc();
    renderRankingArea();
    applyTip.textContent = finalWin ? ('🎉 '+row.win+' A级通关！') : (S.autoNext ? '已应用，已进入下一局（本局→下局：'+thisRound+'→'+nextBaseByRule+'）。' : '已应用。下局级牌：'+nextBaseByRule+'。');
    
    // Show victory modal if A-level was won
    if (finalWin) {
      showVictoryModal(row.win);
    }
    
    // Clear ranking for next round if auto-apply is enabled
    if (S.autoApply) {
      clearRanking();
    }
  }

  function doAdvance(){ 
    if(ST.nextRoundBase){ 
      ST.roundLevel = ST.nextRoundBase; 
      // Set round owner to the last winner
      if(ST.hist.length > 0) {
        ST.roundOwner = ST.hist[ST.hist.length - 1].winKey;
      }
      ST.nextRoundBase=null; 
      save(KEY_ST,ST); 
      renderTeams(); 
      calc(); 
      applyTip.textContent='已进入下一局'; 
    } else { 
      applyTip.textContent='没有待进入的下一局（或已自动进入）。'; 
    } 
  }

  // Rollback/undo/reset
  function rollbackTo(index){ 
    if(index<0||index>=ST.hist.length) return; 
    var h=ST.hist[index]; 
    if(!confirm('回滚到第 '+(index+1)+' 局之前？')) return; 
    ST.t1.lvl=h.prevT1Lvl; 
    ST.t1.aFail=h.prevT1A||0; 
    ST.t2.lvl=h.prevT2Lvl; 
    ST.t2.aFail=h.prevT2A||0; 
    ST.roundLevel=h.prevRound||'2'; 
    // Restore round owner from previous history
    if(index > 0) {
      ST.roundOwner = ST.hist[index-1].winKey;
    } else {
      ST.roundOwner = null; // First round has no owner
    }
    ST.nextRoundBase=null; 
    ST.hist=ST.hist.slice(0,index); 
    save(KEY_ST,ST); 
    renderTeams(); 
    renderHistory(); 
    calc(); 
    applyTip.textContent='已回滚。'; 
  }
  function undoLast(){ if(!ST.hist.length){ alert('没有可撤销的记录'); return; } rollbackTo(ST.hist.length-1); }
  function resetAll(){ 
    if(!confirm('重置整场？')) return; 
    // Reset state to initial values
    ST={t1:{lvl:'2',aFail:0},t2:{lvl:'2',aFail:0},hist:[],roundLevel:'2',nextRoundBase:null,roundOwner:null}; 
    save(KEY_ST,ST); 
    
    // Clear player-related state
    selected=[]; 
    input.value=''; 
    playerStats = {}; 
    save('gd_player_stats', {}); 
    currentRanking = {};
    
    // Re-render everything
    renderTeams(); 
    renderHistory(); 
    calc(); 
    renderStatistics(); 
    renderRankingArea();
    generatePlayers(true); // Force regenerate players to ensure clean state
    
    applyTip.textContent='已重置整场比赛';
    
    // Close victory modal if it's open
    closeVictoryModal();
  }

  // Victory Modal
  function showVictoryModal(teamName) {
    var modal = $('victoryModal');
    var modalContent = modal.querySelector('div');
    var teamNameEl = $('victoryTeamName');
    
    // Determine which team won and get their color
    var winningTeamColor = '';
    if (teamName === S.t1.name) {
      winningTeamColor = S.t1.color;
    } else if (teamName === S.t2.name) {
      winningTeamColor = S.t2.color;
    }
    
    // Update modal content
    teamNameEl.textContent = teamName;
    teamNameEl.style.color = winningTeamColor;
    
    // Update modal border color
    modalContent.style.borderColor = winningTeamColor;
    modalContent.style.boxShadow = '0 0 30px ' + winningTeamColor + '40';
    
    modal.style.display = 'flex';
  }
  
  function closeVictoryModal() {
    var modal = $('victoryModal');
    modal.style.display = 'none';
  }
  
  // Make functions globally accessible
  window.closeVictoryModal = closeVictoryModal;
  window.exportTXT = exportTXT;
  window.exportCSV = exportCSV;
  window.exportLongPNG = exportLongPNG;
  window.resetAll = resetAll;
  
  // Exports
  var exportTip=$('exportTip');
  function exportTXT(){ 
    var lines=['掼蛋战绩导出（v8.0）','================',
      '当前本局级牌：'+ST.roundLevel,
      '下局预览：'+(ST.nextRoundBase||'—'),
      (S.t1.name||'队1')+'级牌：'+ST.t1.lvl+'｜A'+(ST.t1.aFail||0)+'/3',
      (S.t2.name||'队2')+'级牌：'+ST.t2.lvl+'｜A'+(ST.t2.aFail||0)+'/3',
      'A级规则：'+(S.strictA?'严格模式':'宽松模式'),
      '',
      '#  时间 | 人数 | 胜方组合 | 玩家排名 | 升级情况 | 胜队 | '+S.t1.name+'级 | '+S.t2.name+'级 | 本局级 | A说明'
    ]; 
    for(var i=0;i<ST.hist.length;i++){ 
      var h=ST.hist[i]; 
      // Build player ranking string
      var playerRankStr = '';
      if(h.playerRankings){
        var rankParts = [];
        for(var r=1; r<=parseInt(h.mode); r++){
          if(h.playerRankings[r]){
            var p = h.playerRankings[r];
            rankParts.push(p.emoji+p.name);
          }
        }
        playerRankStr = rankParts.join(' ');
      }
      var upgradeStr = h.up ? (h.win + ' 升' + h.up + '级') : '不升级';
      lines.push([i+1,h.ts,h.mode,h.combo,playerRankStr,upgradeStr,h.win,h.t1,h.t2,h.round,h.aNote].join(' | ')); 
    } 
    var blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}); 
    var a=document.createElement('a'); 
    a.href=URL.createObjectURL(blob); 
    a.download='掼蛋战绩_v8.txt'; 
    a.click(); 
    exportTip.textContent='已导出 TXT'; 
    setTimeout(function(){exportTip.textContent='';},1200); 
  }
  function csvEscape(v){ var s=String(v).replace(/"/g,'""'); if(s.search(/[",\n]/)>=0) s='"'+s+'"'; return s; }
  function exportCSV(){ 
    var rows=[['#','时间','人数','胜方组合','玩家排名','升级情况','胜队',S.t1.name+'级',S.t2.name+'级','本局级','A说明','A级规则']]; 
    for(var i=0;i<ST.hist.length;i++){ 
      var h=ST.hist[i]; 
      // Build player ranking string
      var playerRankStr = '';
      if(h.playerRankings){
        var rankParts = [];
        for(var r=1; r<=parseInt(h.mode); r++){
          if(h.playerRankings[r]){
            var p = h.playerRankings[r];
            rankParts.push(p.emoji+p.name);
          }
        }
        playerRankStr = rankParts.join(' ');
      }
      var upgradeStr = h.up ? (h.win + ' 升' + h.up + '级') : '不升级';
      rows.push([i+1,h.ts,h.mode,h.combo,playerRankStr,upgradeStr,h.win,h.t1,h.t2,h.round,h.aNote,S.strictA?'严格':'宽松']); 
    } 
    var lines=rows.map(function(r){ return r.map(csvEscape).join(','); }).join('\n'); 
    var blob=new Blob([lines],{type:'text/csv;charset=utf-8'}); 
    var a=document.createElement('a'); 
    a.href=URL.createObjectURL(blob); 
    a.download='掼蛋战绩_v8.csv'; 
    a.click(); 
    exportTip.textContent='已导出 CSV'; 
    setTimeout(function(){exportTip.textContent='';},1200); 
  }
  function exportLongPNG(){ 
    var W=2200, headH=220, rowH=40, n=ST.hist.length, H=headH+(n+1)*rowH+80; 
    longCnv.width=W; longCnv.height=H; 
    lctx.fillStyle='#0b0b0c'; lctx.fillRect(0,0,W,H); 
    lctx.fillStyle='#f5f6f8'; 
    lctx.font='bold 48px Arial'; 
    lctx.fillText('掼蛋战绩总览 v8.0',40,70); 
    lctx.font='20px Arial'; 
    lctx.fillStyle='#b4b8bf'; 
    lctx.fillText('当前本局级牌：'+ST.roundLevel+'｜下局预览：'+(ST.nextRoundBase||'—')+'｜A级规则：'+(S.strictA?'严格模式':'宽松模式'),40,110); 
    lctx.fillText('队伍：'+S.t1.name+'（'+ST.t1.lvl+'，A'+(ST.t1.aFail||0)+'/3） | '+S.t2.name+'（'+ST.t2.lvl+'，A'+(ST.t2.aFail||0)+'/3）',40,140); 
    lctx.fillText('生成时间：'+now(),40,170); 
    
    var cols=['#','时间','人数','胜方组合','玩家排名','升级','胜队',S.t1.name+'级',S.t2.name+'级','本局级','A说明']; 
    var xs=[40,80,240,300,440,700,800,900,1000,1100,1200]; 
    lctx.font='bold 20px Arial'; 
    lctx.fillStyle='#e6b800'; 
    for(var c=0;c<cols.length;c++) lctx.fillText(cols[c], xs[c], headH); 
    
    lctx.font='14px Arial'; 
    for(var i=0;i<n;i++){ 
      var h=ST.hist[i], y=headH+(i+1)*rowH; 
      
      // Add row background color based on winning team
      var winColor = h.winKey === 't1' ? S.t1.color : S.t2.color;
      lctx.fillStyle = winColor + '10'; // Very light background
      lctx.fillRect(0, y - rowH + 10, W, rowH);
      
      // Build player ranking string with emoji and names
      var playerRankStr = '';
      if(h.playerRankings) {
        var rankParts = [];
        for(var r=1; r<=8; r++) {
          if(h.playerRankings[r]) {
            var p = h.playerRankings[r];
            rankParts.push(p.emoji + p.name);
          }
        }
        playerRankStr = rankParts.join(' ');
      }
      
      var upgradeStr = h.up ? (h.win + ' 升' + h.up) : '不升';
      var vals=[i+1,h.ts.substring(0,16),h.mode,h.combo,playerRankStr,upgradeStr,h.win,h.t1,h.t2,h.round,h.aNote||'']; 
      
      // Set text color
      lctx.fillStyle='#f5f6f8';
      
      for(var j=0;j<vals.length;j++) {
        var text = String(vals[j]);
        // Wrap long A notes
        if(j === 10 && text.length > 50) {
          var maxWidth = 800;
          var words = text.split(' ');
          var line = '';
          var lineY = y;
          for(var w = 0; w < words.length; w++) {
            var testLine = line + words[w] + ' ';
            var metrics = lctx.measureText(testLine);
            if (metrics.width > maxWidth && w > 0) {
              lctx.fillText(line, xs[j], lineY);
              line = words[w] + ' ';
              lineY += 15;
            } else {
              line = testLine;
            }
          }
          lctx.fillText(line, xs[j], lineY);
        } else {
          lctx.fillText(text, xs[j], y);
        }
      }
    } 
    var a=document.createElement('a'); 
    a.href=longCnv.toDataURL('image/png'); 
    a.download='掼蛋战绩_v8.png'; 
    a.click(); 
  }

  // Events
  on(modeSel,'change', function(){ selected=[]; input.value=''; updateRuleHint(); calc(); generatePlayers(false); });
  on(applyBtn,'click', applyResult); on(advanceBtn,'click', doAdvance);
  on($('undo'),'click', undoLast);
  on($('exportTxt'),'click', exportTXT); on($('exportCsv'),'click', exportCSV); on($('exportLongPng'),'click', exportLongPNG);
  on($('resetMatch'),'click', resetAll);
  
  // Player system events
  on($('generatePlayers'),'click', function() { generatePlayers(true); });
  on($('shuffleTeams'),'click', shuffleTeams);
  on($('clearRanking'),'click', clearRanking);
  on($('randomRanking'),'click', randomizeRanking);
  on($('manualCalc'),'click', function() {
    // Force rebuild currentRanking from what's actually in the slots
    var area = $('rankingArea');
    var slots = area.querySelectorAll('.rank-slot');
    var newRanking = {};
    
    slots.forEach(function(slot) {
      var rank = parseInt(slot.dataset.rank);
      var playerTile = slot.querySelector('.ranking-player-tile');
      if (playerTile) {
        var playerId = parseInt(playerTile.dataset.playerId);
        if (playerId) {
          newRanking[rank] = playerId;
        }
      }
    });
    
    currentRanking = newRanking;
    
    // Now calculate
    calculateFromRanking();
    
    // Also trigger apply if calculation was successful
    var r = calc();
    if (r.ok) {
      applyResult();
    }
  });

  function syncSelectedFromInput(){ var need=(modeSel.value==='4'?2:(modeSel.value==='6'?3:4)); var pr=parseRanks(input.value, need); selected=pr.ok?pr.ranks.slice():[]; }

  // Init
  generatePlayers(false);  // Load saved players on init
  setupDropZones();
  renderStatistics();
  // Set initial state
  headline.textContent = '等待排名';
  explain.textContent = '请将玩家拖到排名位置';
  if (winnerDisplay) winnerDisplay.textContent = '—';
})();