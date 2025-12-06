/**
 * Victory Modal - A-Level Victory Celebration with End-Game Voting
 * Extracted from app.js lines 1715-1746
 * NEW FEATURE: End-game voting for MVP and burden
 */

import { $ } from '../core/utils.js';
import { getPlayers } from '../player/playerManager.js';
import config from '../core/config.js';
import { emit } from '../core/events.js';

// In-memory voting data (cleared on modal close)
let votes = {
  mvp: {},     // { playerId: voteCount }
  burden: {}   // { playerId: voteCount }
};

/**
 * Show victory modal with celebration and voting
 * @param {string} teamName - Winning team name
 */
export function showVictoryModal(teamName) {
  const modal = $('victoryModal');
  if (!modal) return;

  const modalContent = modal.querySelector('div');
  const teamNameEl = $('victoryTeamName');

  // Determine winning team color
  const winningTeamColor =
    teamName === config.getTeamName('t1') ? config.getTeamColor('t1') :
    teamName === config.getTeamName('t2') ? config.getTeamColor('t2') : '#22c55e';

  // Update modal content
  if (teamNameEl) {
    teamNameEl.textContent = teamName;
    teamNameEl.style.color = winningTeamColor;
  }

  if (modalContent) {
    modalContent.style.borderColor = winningTeamColor;
    modalContent.style.boxShadow = `0 0 30px ${winningTeamColor}40`;
  }

  // Clear previous votes
  votes = { mvp: {}, burden: {} };

  // Render voting interface
  renderVotingInterface();

  modal.style.display = 'flex';

  emit('ui:victoryModalShown', { teamName });
}

/**
 * Close victory modal
 */
export function closeVictoryModal() {
  const modal = $('victoryModal');
  if (modal) {
    modal.style.display = 'none';
  }

  // Clear votes on close
  votes = { mvp: {}, burden: {} };

  emit('ui:victoryModalClosed');
}

/**
 * Render voting interface
 */
function renderVotingInterface() {
  const votingContainer = $('victoryVoting');
  if (!votingContainer) return;

  const players = getPlayers();

  votingContainer.innerHTML = `
    <h3 style="margin: 20px 0 15px 0; color: #f5f6f8;">🏆 投票评选</h3>

    <div style="margin-bottom: 25px;">
      <h4 style="color: #22c55e; margin-bottom: 10px;">谁是本场 MVP (最C)？</h4>
      <div id="mvpVoting" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">
        ${players.map(p => `
          <button class="vote-btn" data-vote-type="mvp" data-player-id="${p.id}" style="
            padding: 10px;
            background: #2a2b2c;
            border: 2px solid #444;
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
          ">
            <span style="font-size: 24px;">${p.emoji}</span>
            <span style="font-size: 12px;">${p.name}</span>
            <span class="vote-count" style="font-size: 11px; color: #999;">0 票</span>
          </button>
        `).join('')}
      </div>
    </div>

    <div style="margin-bottom: 15px;">
      <h4 style="color: #ef4444; margin-bottom: 10px;">谁是本场累赘 (最闹)？</h4>
      <div id="burdenVoting" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">
        ${players.map(p => `
          <button class="vote-btn" data-vote-type="burden" data-player-id="${p.id}" style="
            padding: 10px;
            background: #2a2b2c;
            border: 2px solid #444;
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
          ">
            <span style="font-size: 24px;">${p.emoji}</span>
            <span style="font-size: 12px;">${p.name}</span>
            <span class="vote-count" style="font-size: 11px; color: #999;">0 票</span>
          </button>
        `).join('')}
      </div>
    </div>

    <div id="votingResults" style="margin-top: 20px; padding: 15px; background: #1a1b1c; border-radius: 8px; display: none;">
      <h4>📊 投票结果</h4>
      <div id="resultsContent"></div>
    </div>
  `;

  // Attach vote handlers
  attachVoteHandlers();
}

/**
 * Attach click handlers to vote buttons
 */
function attachVoteHandlers() {
  const voteButtons = document.querySelectorAll('.vote-btn');

  voteButtons.forEach(btn => {
    btn.onclick = () => {
      const voteType = btn.dataset.voteType;
      const playerId = parseInt(btn.dataset.playerId);

      // Record vote
      if (!votes[voteType][playerId]) {
        votes[voteType][playerId] = 0;
      }
      votes[voteType][playerId]++;

      // Update display
      updateVoteDisplay();

      // Visual feedback
      btn.style.borderColor = voteType === 'mvp' ? '#22c55e' : '#ef4444';
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        btn.style.transform = 'scale(1)';
      }, 100);

      emit('voting:cast', { voteType, playerId });
    };
  });
}

/**
 * Update vote count display
 */
function updateVoteDisplay() {
  // Update MVP votes
  Object.keys(votes.mvp).forEach(playerId => {
    const btn = document.querySelector(`[data-vote-type="mvp"][data-player-id="${playerId}"]`);
    if (btn) {
      const countEl = btn.querySelector('.vote-count');
      if (countEl) {
        countEl.textContent = `${votes.mvp[playerId]} 票`;
        countEl.style.color = votes.mvp[playerId] > 0 ? '#22c55e' : '#999';
      }
    }
  });

  // Update burden votes
  Object.keys(votes.burden).forEach(playerId => {
    const btn = document.querySelector(`[data-vote-type="burden"][data-player-id="${playerId}"]`);
    if (btn) {
      const countEl = btn.querySelector('.vote-count');
      if (countEl) {
        countEl.textContent = `${votes.burden[playerId]} 票`;
        countEl.style.color = votes.burden[playerId] > 0 ? '#ef4444' : '#999';
      }
    }
  });

  // Show results if there are any votes
  const totalVotes =
    Object.values(votes.mvp).reduce((sum, count) => sum + count, 0) +
    Object.values(votes.burden).reduce((sum, count) => sum + count, 0);

  if (totalVotes > 0) {
    showVotingResults();
  }
}

/**
 * Show voting results summary
 */
function showVotingResults() {
  const resultsContainer = $('votingResults');
  const resultsContent = $('resultsContent');

  if (!resultsContainer || !resultsContent) return;

  const players = getPlayers();

  // Find MVP winner
  let mvpWinner = null;
  let maxMvpVotes = 0;
  Object.keys(votes.mvp).forEach(playerId => {
    if (votes.mvp[playerId] > maxMvpVotes) {
      maxMvpVotes = votes.mvp[playerId];
      mvpWinner = players.find(p => p.id === parseInt(playerId));
    }
  });

  // Find burden
  let burdenPlayer = null;
  let maxBurdenVotes = 0;
  Object.keys(votes.burden).forEach(playerId => {
    if (votes.burden[playerId] > maxBurdenVotes) {
      maxBurdenVotes = votes.burden[playerId];
      burdenPlayer = players.find(p => p.id === parseInt(playerId));
    }
  });

  resultsContent.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
      <div style="text-align: center; padding: 15px; background: #2a2b2c; border-radius: 8px;">
        <div style="color: #22c55e; font-weight: bold; margin-bottom: 8px;">🥇 MVP</div>
        ${mvpWinner ? `
          <div style="font-size: 32px;">${mvpWinner.emoji}</div>
          <div style="font-weight: bold; margin-top: 5px;">${mvpWinner.name}</div>
          <div style="color: #999; font-size: 12px;">${maxMvpVotes} 票</div>
        ` : '<div style="color: #666;">暂无投票</div>'}
      </div>
      <div style="text-align: center; padding: 15px; background: #2a2b2c; border-radius: 8px;">
        <div style="color: #ef4444; font-weight: bold; margin-bottom: 8px;">😅 最闹</div>
        ${burdenPlayer ? `
          <div style="font-size: 32px;">${burdenPlayer.emoji}</div>
          <div style="font-weight: bold; margin-top: 5px;">${burdenPlayer.name}</div>
          <div style="color: #999; font-size: 12px;">${maxBurdenVotes} 票</div>
        ` : '<div style="color: #666;">暂无投票</div>'}
      </div>
    </div>
  `;

  resultsContainer.style.display = 'block';
}

/**
 * Update rule hint text
 * @param {string} mode - Game mode
 */
export function updateRuleHint(mode) {
  const ruleHint = $('ruleHint');
  if (!ruleHint) return;

  const cfg = config.getAll();

  if (mode === '4') {
    ruleHint.textContent = `4人：固定表 (${cfg.c4['1,2']},${cfg.c4['1,3']},${cfg.c4['1,4']})`;
  } else if (mode === '6') {
    ruleHint.textContent = `6人：分差≥${cfg.t6.g3} 升3；≥${cfg.t6.g2} 升2；≥${cfg.t6.g1} 升1`;
  } else {
    ruleHint.textContent = `8人：分差≥${cfg.t8.g3} 升3；≥${cfg.t8.g2} 升2；≥${cfg.t8.g1} 升1`;
  }
}

// Make closeVictoryModal globally accessible for HTML onclick
if (typeof window !== 'undefined') {
  window.closeVictoryModal = closeVictoryModal;
}
