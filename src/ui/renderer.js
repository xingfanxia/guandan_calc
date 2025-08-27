// UI rendering and team management
// UTF-8 encoding for Chinese characters

import { $, rgba, addRipple } from '../utils/dom.js';

class UIRenderer {
  constructor(gameState) {
    this.gameState = gameState;
    this.input = { value: '' };
    this.selected = [];
  }

  /**
   * Apply team styles to UI elements
   */
  applyTeamStyles() {
    const t1NameChip = $('t1NameChip');
    const t2NameChip = $('t2NameChip');
    const hT1 = $('hT1');
    const hT2 = $('hT2');
    const autoNext = $('autoNext');
    const autoApply = $('autoApply');
    const strictA = $('strictA');
    const winnerDisplay = $('winnerDisplay');
    
    if (t1NameChip) {
      t1NameChip.style.background = this.gameState.settings.t1.color;
      t1NameChip.style.color = '#fff';
      t1NameChip.innerHTML = '<b>' + this.gameState.settings.t1.name + '</b>';
    }
    
    if (t2NameChip) {
      t2NameChip.style.background = this.gameState.settings.t2.color;
      t2NameChip.style.color = '#fff';
      t2NameChip.innerHTML = '<b>' + this.gameState.settings.t2.name + '</b>';
    }
    
    if (hT1) hT1.innerText = this.gameState.settings.t1.name;
    if (hT2) hT2.innerText = this.gameState.settings.t2.name;
    
    if (autoNext) autoNext.checked = !!this.gameState.settings.autoNext;
    if (autoApply) autoApply.checked = !!this.gameState.settings.autoApply;
    if (strictA) strictA.checked = !!this.gameState.settings.strictA;
    
    // Update winner display if set
    if (winnerDisplay && this.gameState.winner) {
      winnerDisplay.textContent = this.gameState.getWinnerName();
      winnerDisplay.style.color = this.gameState.getWinnerColor();
    }
  }

  /**
   * Update rule hint display
   */
  updateRuleHint() {
    const ruleHint = $('ruleHint');
    const mode = $('mode').value;
    
    if (!ruleHint) return;
    
    if (mode === '4') {
      const c4 = this.gameState.settings.c4;
      ruleHint.textContent = '4人：固定表 (' + c4['1,2'] + ',' + c4['1,3'] + ',' + c4['1,4'] + ')';
    } else if (mode === '6') {
      const t6 = this.gameState.settings.t6;
      ruleHint.textContent = '6人：分差≥' + t6.g3 + ' 升3；≥' + t6.g2 + ' 升2；≥' + t6.g1 + ' 升1';
    } else {
      const t8 = this.gameState.settings.t8;
      ruleHint.textContent = '8人：分差≥' + t8.g3 + ' 升3；≥' + t8.g2 + ' 升2；≥' + t8.g1 + ' 升1';
    }
  }

  /**
   * Render team levels and status
   */
  renderTeams() {
    const t1Lvl = $('t1Lvl');
    const t2Lvl = $('t2Lvl');
    const t1A = $('t1A');
    const t2A = $('t2A');
    const t1AState = $('t1AState');
    const t2AState = $('t2AState');
    const curRoundLvl = $('curRoundLvl');
    const nextRoundPreview = $('nextRoundPreview');
    
    if (t1Lvl) t1Lvl.textContent = this.gameState.state.t1.lvl;
    if (t2Lvl) t2Lvl.textContent = this.gameState.state.t2.lvl;
    if (t1A) t1A.textContent = this.gameState.state.t1.aFail || 0;
    if (t2A) t2A.textContent = this.gameState.state.t2.aFail || 0;
    
    if (t1AState) {
      t1AState.textContent = (this.gameState.state.t1.lvl === 'A') ? 
        ('A' + (this.gameState.state.t1.aFail || 0) + '/3') : '—';
    }
    if (t2AState) {
      t2AState.textContent = (this.gameState.state.t2.lvl === 'A') ? 
        ('A' + (this.gameState.state.t2.aFail || 0) + '/3') : '—';
    }
    
    // Show which team's level we're playing at
    let roundTeamName = '';
    if (String(this.gameState.state.roundLevel) === String(this.gameState.state.t1.lvl) && 
        String(this.gameState.state.roundLevel) !== String(this.gameState.state.t2.lvl)) {
      roundTeamName = ' (' + this.gameState.settings.t1.name + ')';
    } else if (String(this.gameState.state.roundLevel) === String(this.gameState.state.t2.lvl) && 
               String(this.gameState.state.roundLevel) !== String(this.gameState.state.t1.lvl)) {
      roundTeamName = ' (' + this.gameState.settings.t2.name + ')';
    }
    
    if (curRoundLvl) {
      curRoundLvl.textContent = this.gameState.state.roundLevel + roundTeamName;
    }
    
    // Show next round preview with team name
    const nextRound = this.gameState.state.nextRoundBase || this.gameState.state.roundLevel || '-';
    let nextTeamName = '';
    if (this.gameState.state.nextRoundBase) {
      // There's a pending next round, figure out which team it would be
      if (this.gameState.state.nextRoundBase === this.gameState.state.t1.lvl && 
          this.gameState.state.nextRoundBase !== this.gameState.state.t2.lvl) {
        nextTeamName = ' (' + this.gameState.settings.t1.name + ')';
      } else if (this.gameState.state.nextRoundBase === this.gameState.state.t2.lvl && 
                 this.gameState.state.nextRoundBase !== this.gameState.state.t1.lvl) {
        nextTeamName = ' (' + this.gameState.settings.t2.name + ')';
      }
    }
    
    if (nextRoundPreview) {
      nextRoundPreview.textContent = nextRound + nextTeamName;
    }
  }

  /**
   * Refresh preview only (for calculation display)
   */
  refreshPreviewOnly() {
    const nextRoundPreview = $('nextRoundPreview');
    if (!nextRoundPreview) return;
    
    // If there's a pending next round, show it. Otherwise show current round
    if (this.gameState.state.nextRoundBase) {
      nextRoundPreview.textContent = this.gameState.state.nextRoundBase;
    } else {
      // In auto-next mode or no pending round, preview is same as current round
      nextRoundPreview.textContent = this.gameState.state.roundLevel || '-';
    }
  }

  /**
   * Set winner and update UI
   * @param {string} winner - Winner team ID
   */
  setWinner(winner) {
    this.gameState.setWinner(winner);
    const winnerDisplay = $('winnerDisplay');
    
    if (winnerDisplay) {
      winnerDisplay.textContent = this.gameState.getWinnerName();
      winnerDisplay.style.color = this.gameState.getWinnerColor();
    }
    
    this.refreshPreviewOnly();
  }

  /**
   * Update calculation display
   * @param {Object} result - Calculation result
   * @param {string} mode - Game mode
   */
  updateCalculationDisplay(result) {
    const headline = $('headline');
    const explain = $('explain');
    const winnerDisplay = $('winnerDisplay');
    
    if (!result.ok) {
      if (headline) headline.textContent = result.headline || '等待排名完成';
      if (explain) explain.textContent = result.explain || '请将所有玩家拖到排名位置';
      if (winnerDisplay) winnerDisplay.textContent = '—';
      return;
    }
    
    if (headline) headline.textContent = result.headline;
    if (explain) explain.textContent = result.explain;
    
    this.refreshPreviewOnly();
  }

  /**
   * Update ranking input (for mobile integration)
   */
  updateRankingInput() {
    const mode = parseInt($('mode').value);
    const isMobile = 'ontouchstart' in window;
    
    if (!isMobile) {
      // Let desktop handle it the original way
      return;
    }
    
    // Check if all positions are filled
    let allFilled = true;
    for (let i = 1; i <= mode; i++) {
      if (!this.gameState.currentRanking[i]) {
        allFilled = false;
        break;
      }
    }
    
    if (!allFilled) {
      return;
    }
    
    // For mobile, determine winner based on who has rank 1
    const firstPlacePlayerId = this.gameState.currentRanking[1];
    const firstPlacePlayer = this.gameState.players.find(p => p.id === firstPlacePlayerId);
    
    if (!firstPlacePlayer) {
      return;
    }
    
    // Set winner based on first place player's team
    const actualWinner = firstPlacePlayer.team === 1 ? 't1' : 't2';
    this.setWinner(actualWinner);
    
    // Collect ranks for each team
    const team1Ranks = [];
    const team2Ranks = [];
    
    for (let rank = 1; rank <= mode; rank++) {
      const playerId = this.gameState.currentRanking[rank];
      if (playerId) {
        const player = this.gameState.players.find(p => p.id === parseInt(playerId));
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
    const winnerRanks = actualWinner === 't1' ? team1Ranks : team2Ranks;
    winnerRanks.sort((a, b) => a - b);
    
    // Set input to winning team's ranks
    this.input.value = winnerRanks.join(' ');
    this.selected = winnerRanks.slice();
    
    // Trigger calculation if callback is available
    if (this.onCalculationUpdate) {
      this.onCalculationUpdate();
    }
    
    // Auto-apply if enabled
    if (this.gameState.settings.autoApply && this.onAutoApply) {
      this.onAutoApply();
    }
  }

  /**
   * Collect and save rules from form inputs
   */
  collectAndSaveRules() {
    // 4-player rules
    this.gameState.settings.c4 = {
      '1,2': parseInt($('c4_12').value) || 0,
      '1,3': parseInt($('c4_13').value) || 0,
      '1,4': parseInt($('c4_14').value) || 0
    };
    
    // 6-player thresholds
    this.gameState.settings.t6 = {
      g3: parseInt($('t6_3').value) || 7,
      g2: parseInt($('t6_2').value) || 4,
      g1: parseInt($('t6_1').value) || 1
    };
    
    // 6-player points
    this.gameState.settings.p6 = {
      1: parseInt($('p6_1').value) || 0,
      2: parseInt($('p6_2').value) || 0,
      3: parseInt($('p6_3').value) || 0,
      4: parseInt($('p6_4').value) || 0,
      5: parseInt($('p6_5').value) || 0,
      6: parseInt($('p6_6').value) || 0
    };
    
    // 8-player thresholds
    this.gameState.settings.t8 = {
      g3: parseInt($('t8_3').value) || 11,
      g2: parseInt($('t8_2').value) || 6,
      g1: parseInt($('t8_1').value) || 1
    };
    
    // 8-player points
    this.gameState.settings.p8 = {
      1: parseInt($('p8_1').value) || 0,
      2: parseInt($('p8_2').value) || 0,
      3: parseInt($('p8_3').value) || 0,
      4: parseInt($('p8_4').value) || 0,
      5: parseInt($('p8_5').value) || 0,
      6: parseInt($('p8_6').value) || 0,
      7: parseInt($('p8_7').value) || 0,
      8: parseInt($('p8_8').value) || 0
    };
    
    this.gameState.saveSettings();
    this.updateRuleHint();
    this.refreshPreviewOnly();
  }

  /**
   * Set calculation update callback
   * @param {Function} callback - Callback function
   */
  setCalculationCallback(callback) {
    this.onCalculationUpdate = callback;
  }

  /**
   * Set auto-apply callback
   * @param {Function} callback - Callback function
   */
  setAutoApplyCallback(callback) {
    this.onAutoApply = callback;
  }

  /**
   * Initialize UI elements and their values
   */
  initializeUI() {
    this.applyTeamStyles();
    this.updateRuleHint();
    this.renderTeams();
    
    // Initialize form elements with saved values
    const must1 = $('must1');
    if (must1) must1.checked = !!this.gameState.settings.must1;
    
    // Set initial display states
    const headline = $('headline');
    const explain = $('explain');
    const winnerDisplay = $('winnerDisplay');
    
    if (headline) headline.textContent = '等待排名';
    if (explain) explain.textContent = '请将玩家拖到排名位置';
    if (winnerDisplay) winnerDisplay.textContent = '—';
  }
}

export default UIRenderer;