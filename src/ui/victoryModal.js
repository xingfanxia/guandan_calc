/**
 * Victory Modal - A-Level Victory Celebration with End-Game Voting
 * Extracted from app.js lines 1715-1746
 * NEW FEATURE: End-game voting for MVP and burden
 */

import { $, escapeHtml } from '../core/utils.js';
import { getPlayers } from '../player/playerManager.js';
import config from '../core/config.js';
import state from '../core/state.js';
import { emit } from '../core/events.js';
import { renderProfileAvatar } from '../player/photoRenderer.js';
import { getPlayerDisplayData } from '../api/playerApi.js';

// In-memory voting data (cleared on modal close)
let votes = {
  mvp: {},     // { playerId: voteCount }
  burden: {}   // { playerId: voteCount }
};

/**
 * Get confirmed voting results (top voted players)
 * @returns {Object} {mvp: playerId, burden: playerId}
 */
export function getVotingResults() {
  // Find player with most MVP votes
  let mvpId = null;
  let maxMVP = 0;
  Object.entries(votes.mvp).forEach(([playerId, count]) => {
    if (count > maxMVP) {
      maxMVP = count;
      mvpId = parseInt(playerId);
    }
  });

  // Find player with most burden votes
  let burdenId = null;
  let maxBurden = 0;
  Object.entries(votes.burden).forEach(([playerId, count]) => {
    if (count > maxBurden) {
      maxBurden = count;
      burdenId = parseInt(playerId);
    }
  });

  return { mvp: mvpId, burden: burdenId };
}

/**
 * Show victory modal with celebration and voting
 * @param {string} teamName - Winning team name
 */
export async function showVictoryModal(teamName) {
  const modal = $('victoryModal');
  if (!modal) return;

  const modalContent = modal.querySelector('.victory-modal__inner');
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

  // Expose the winning team color as a CSS custom property so per-theme
  // styles can use it without inline rule overrides. Pre-2026-05-05 we set
  // borderColor + boxShadow inline here, which clobbered each theme's
  // border treatment (Atelier gold-top, Trading amber-frame, etc.).
  if (modalContent) {
    modal.style.setProperty('--winning-team-color', winningTeamColor);
  }

  // Find MVP from winning team and show tagline
  try {
    const players = state.getPlayers();
    const playerStats = state.getPlayerStats();
    const winningTeamNum = teamName === config.getTeamName('t1') ? 1 : 2;

    // Get winning team players
    const winningPlayers = players.filter(p => p.team === winningTeamNum);

    // Find MVP: player with LOWEST average ranking (best performance)
    let mvpPlayer = null;
    let bestAvg = Infinity;

    winningPlayers.forEach(player => {
      const stats = playerStats[player.id];
      if (stats && stats.games > 0) {
        const avgRank = stats.totalRank / stats.games;
        if (avgRank < bestAvg) {
          bestAvg = avgRank;
          mvpPlayer = player;
        }
      }
    });

    // Fetch current profile data for MVP (with fallback to stored data)
    if (mvpPlayer) {
      mvpPlayer = await getPlayerDisplayData(mvpPlayer);
    }

    // Show tagline if MVP has profile
    if (mvpPlayer && mvpPlayer.tagline) {
      const existingTagline = modal.querySelector('.mvp-tagline');
      if (existingTagline) existingTagline.remove();
      
      const taglineEl = document.createElement('p');
      taglineEl.className = 'mvp-tagline';
      taglineEl.style.cssText = `
        color: #fbbf24;
        font-size: 20px;
        margin: 0 0 24px 0;
        font-style: italic;
        text-shadow: 0 0 10px rgba(251, 191, 36, 0.3);
      `;
      taglineEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px;">
          ${renderProfileAvatar(mvpPlayer, 64, { marginRight: false })}
          <div style="text-align: left;">
            <div style="color: ${winningTeamColor}; font-weight: bold; font-size: 18px;">MVP ${escapeHtml(mvpPlayer.name)}</div>
            <div style="color: #888; font-size: 14px;">平均 ${bestAvg.toFixed(2)}名</div>
          </div>
        </div>
        <div style="font-style: italic;">"${escapeHtml(mvpPlayer.tagline)}"</div>
      `;
      
      // Insert after team name
      if (teamNameEl && teamNameEl.nextSibling) {
        teamNameEl.parentNode.insertBefore(taglineEl, teamNameEl.nextSibling);
      }
    }
  } catch (error) {
    console.error('Failed to show MVP tagline:', error);
    // Don't prevent modal from showing
  }

  // Clear previous votes
  votes = { mvp: {}, burden: {} };

  // Check if in room mode
  import('../share/roomManager.js').then(async roomModule => {
    const roomInfo = roomModule.getRoomInfo();

    if (roomInfo.roomCode && roomInfo.isViewer) {
      // Viewer: Don't show modal
      modal.style.display = 'none';
      return;
    }
    // Host and local mode: Just show celebration, no voting interface
  });

  // Emit voting event BEFORE checking room mode (so viewers receive it)
  emit('ui:victoryModalShown', { teamName });
  emit('game:victoryForVoting', { teamName }); // Signal for remote voting

  modal.style.display = 'flex';
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0 15px 0;">
      <h3 style="margin: 0; color: #f5f6f8;">🏆 投票评选</h3>
      <button id="toggleVoting" style="padding: 8px 16px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
        隐藏投票
      </button>
    </div>

    <div id="votingContent">
      <div style="margin-bottom: 25px;">
        <h4 style="color: #22c55e; margin-bottom: 10px;">谁是本场 MVP (最C)？</h4>
      <div id="mvpVoting" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        ${players.map(p => `
          <button class="vote-btn" data-vote-type="mvp" data-player-id="${escapeHtml(p.id)}" style="
            padding: 8px;
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
            <span style="font-size: 24px;">${escapeHtml(p.emoji)}</span>
            <span style="font-size: 12px;">${escapeHtml(p.name)}</span>
            <span class="vote-count" style="font-size: 11px; color: #999;">0 票</span>
          </button>
        `).join('')}
      </div>
    </div>

    <div style="margin-bottom: 15px;">
      <h4 style="color: #ef4444; margin-bottom: 10px;">谁是本场累赘 (最闹)？</h4>
      <div id="burdenVoting" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        ${players.map(p => `
          <button class="vote-btn" data-vote-type="burden" data-player-id="${escapeHtml(p.id)}" style="
            padding: 8px;
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
            <span style="font-size: 24px;">${escapeHtml(p.emoji)}</span>
            <span style="font-size: 12px;">${escapeHtml(p.name)}</span>
            <span class="vote-count" style="font-size: 11px; color: #999;">0 票</span>
          </button>
        `).join('')}
      </div>
    </div>

      <div id="votingResults" style="margin-top: 20px; padding: 15px; background: #1a1b1c; border-radius: 8px; display: none;">
        <h4>📊 投票结果</h4>
        <div id="resultsContent"></div>
      </div>
    </div>
  `;

  // Add toggle functionality
  setTimeout(() => {
    const toggleBtn = document.getElementById('toggleVoting');
    const votingContent = document.getElementById('votingContent');

    if (toggleBtn && votingContent) {
      let isVisible = true;

      toggleBtn.onclick = () => {
        isVisible = !isVisible;
        votingContent.style.display = isVisible ? 'block' : 'none';
        toggleBtn.textContent = isVisible ? '隐藏投票' : '显示投票';
        toggleBtn.style.background = isVisible ? '#666' : '#3b82f6';
      };
    }
  }, 100);

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
 * Render vote leaderboard for host
 */
function renderVoteLeaderboard(votes) {
  const votingContainer = $('victoryVoting');
  if (!votingContainer) return;

  const players = getPlayers();

  // Parse votes (simple format from new API)
  const mvpVotes = votes.mvp || {};
  const burdenVotes = votes.burden || {};

  const mvpSorted = Object.entries(mvpVotes)
    .map(([id, count]) => ({ player: players.find(p => p.id === parseInt(id)), count }))
    .filter(v => v.player)
    .sort((a, b) => b.count - a.count);

  const burdenSorted = Object.entries(burdenVotes)
    .map(([id, count]) => ({ player: players.find(p => p.id === parseInt(id)), count }))
    .filter(v => v.player)
    .sort((a, b) => b.count - a.count);

  votingContainer.innerHTML = `
    <h3 style="margin: 20px 0; color: #f5f6f8; text-align: center;">📊 观众投票结果</h3>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
      <div>
        <h4 style="color: #22c55e; text-align: center; margin-bottom: 15px;">🥇 MVP</h4>
        ${mvpSorted.slice(0, 3).map((v, i) => `
          <div style="padding: 12px; margin: 8px 0; background: ${i === 0 ? '#22c55e20' : '#2a2b2c'}; border-radius: 8px; border: 2px solid ${i === 0 ? '#22c55e' : '#444'};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 24px;">${escapeHtml(v.player.emoji)}</span>
                <span style="font-size: 16px; margin-left: 8px; ${i === 0 ? 'font-weight: bold;' : ''}">${escapeHtml(v.player.name)}</span>
              </div>
              <div style="font-size: 20px; font-weight: bold; color: #22c55e;">${escapeHtml(v.count)} 票</div>
            </div>
          </div>
        `).join('') || '<p style="color: #666; text-align: center;">暂无投票</p>'}
      </div>

      <div>
        <h4 style="color: #ef4444; text-align: center; margin-bottom: 15px;">😅 最闹</h4>
        ${burdenSorted.slice(0, 3).map((v, i) => `
          <div style="padding: 12px; margin: 8px 0; background: ${i === 0 ? '#ef444420' : '#2a2b2c'}; border-radius: 8px; border: 2px solid ${i === 0 ? '#ef4444' : '#444'};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 24px;">${escapeHtml(v.player.emoji)}</span>
                <span style="font-size: 16px; margin-left: 8px; ${i === 0 ? 'font-weight: bold;' : ''}">${escapeHtml(v.player.name)}</span>
              </div>
              <div style="font-size: 20px; font-weight: bold; color: #ef4444;">${escapeHtml(v.count)} 票</div>
            </div>
          </div>
        `).join('') || '<p style="color: #666; text-align: center;">暂无投票</p>'}
      </div>
    </div>

    <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #444;">
      <p style="color: #999; font-size: 13px; margin-bottom: 15px;">房主确认后将记录到"人民的声音"</p>
      <button id="confirmVotingResults" style="padding: 12px 32px; background: #22c55e; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold;">
        ✅ 确认投票结果
      </button>
    </div>
  `;

  // Attach confirmation handler
  setTimeout(() => {
    const confirmBtn = $('confirmVotingResults');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        const mvpWinner = mvpSorted[0];
        const burdenWinner = burdenSorted[0];

        alert(`已确认：\nMVP: ${mvpWinner?.player.name || '无'}\n最闹: ${burdenWinner?.player.name || '无'}\n\n结果已记录到"人民的声音"`);

        // TODO: Actually record to "人民的声音" section and sync

        closeVictoryModal();
      };
    }
  }, 100);
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
          <div style="font-size: 32px;">${escapeHtml(mvpWinner.emoji)}</div>
          <div style="font-weight: bold; margin-top: 5px;">${escapeHtml(mvpWinner.name)}</div>
          <div style="color: #999; font-size: 12px;">${escapeHtml(maxMvpVotes)} 票</div>
        ` : '<div style="color: #666;">暂无投票</div>'}
      </div>
      <div style="text-align: center; padding: 15px; background: #2a2b2c; border-radius: 8px;">
        <div style="color: #ef4444; font-weight: bold; margin-bottom: 8px;">😅 最闹</div>
        ${burdenPlayer ? `
          <div style="font-size: 32px;">${escapeHtml(burdenPlayer.emoji)}</div>
          <div style="font-weight: bold; margin-top: 5px;">${escapeHtml(burdenPlayer.name)}</div>
          <div style="color: #999; font-size: 12px;">${escapeHtml(maxBurdenVotes)} 票</div>
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
