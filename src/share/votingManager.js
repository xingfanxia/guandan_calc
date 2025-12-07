/**
 * Voting Manager - Remote Voting for Room Viewers
 * Allows viewers to vote from their own devices
 */

import { currentRoomCode, isHost, isViewer } from './roomManager.js';
import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';
import { $ } from '../core/utils.js';
import { emit } from '../core/events.js';

/**
 * Submit vote as viewer
 * @param {string} voteType - 'mvp' or 'burden'
 * @param {number} playerId - Player ID being voted for
 * @param {number} roundNumber - Round number
 * @returns {Promise<boolean>} Success
 */
export async function submitVote(voteType, playerId, roundNumber) {
  if (!currentRoomCode || !isViewer) {
    console.error('Not in viewer mode or no room');
    return false;
  }

  try {
    const response = await fetch(`/api/rooms/vote/${currentRoomCode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        voteType,
        playerId,
        roundNumber
      })
    });

    if (!response.ok) {
      console.error('Failed to submit vote');
      return false;
    }

    emit('voting:submitted', { voteType, playerId, roundNumber });
    return true;
  } catch (error) {
    console.error('Error submitting vote:', error);
    return false;
  }
}

/**
 * Get voting results for current round (host only)
 * @returns {Promise<Object|null>} Voting results
 */
export async function getVotingResults() {
  if (!currentRoomCode || !isHost) {
    return null;
  }

  try {
    const history = state.getHistory();
    const roundNumber = history.length;

    const response = await fetch(`/api/rooms/vote/${currentRoomCode}?round=${roundNumber}`);

    if (!response.ok) {
      return null;
    }

    const results = await response.json();
    return results;
  } catch (error) {
    console.error('Error fetching voting results:', error);
    return null;
  }
}

/**
 * Reset voting for current round (host only)
 * @returns {Promise<boolean>} Success
 */
export async function resetVoting(authToken) {
  if (!currentRoomCode || !isHost) {
    return false;
  }

  try {
    const history = state.getHistory();
    const roundNumber = history.length;

    const response = await fetch(`/api/rooms/reset-vote/${currentRoomCode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ roundNumber })
    });

    if (!response.ok) {
      return false;
    }

    emit('voting:reset', { roundNumber });
    return true;
  } catch (error) {
    console.error('Error resetting votes:', error);
    return false;
  }
}

/**
 * Show voting UI for viewers (per round)
 */
export function showViewerVoting() {
  if (!isViewer) return;

  const votingSection = $('votingSection');
  if (!votingSection) return;

  votingSection.style.display = 'block';

  const players = getPlayers();
  const history = state.getHistory();
  const currentRound = history.length + 1;

  const voterInterface = $('voterInterface');
  if (!voterInterface) return;

  voterInterface.innerHTML = `
    <h4>第 ${currentRound} 局投票</h4>
    <p class="small muted">为本局比赛投票</p>

    <div style="margin: 20px 0;">
      <h5>谁是最C (MVP)？</h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
        ${players.map(p => `
          <button class="vote-btn" data-vote-type="mvp" data-player-id="${p.id}" style="
            padding: 10px;
            background: #2a2b2c;
            border: 2px solid #444;
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
          ">
            <div style="font-size: 24px;">${p.emoji}</div>
            <div style="font-size: 11px;">${p.name}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <div style="margin: 20px 0;">
      <h5>谁是最闹 (Burden)？</h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
        ${players.map(p => `
          <button class="vote-btn" data-vote-type="burden" data-player-id="${p.id}" style="
            padding: 10px;
            background: #2a2b2c;
            border: 2px solid #444;
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
          ">
            <div style="font-size: 24px;">${p.emoji}</div>
            <div style="font-size: 11px;">${p.name}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <div id="voteStatus" style="margin-top: 15px; padding: 10px; background: #1a1b1c; border-radius: 8px; text-align: center; color: #22c55e;">
      等待投票...
    </div>
  `;

  // Attach vote handlers
  const voteButtons = voterInterface.querySelectorAll('.vote-btn');
  voteButtons.forEach(btn => {
    btn.onclick = async () => {
      const voteType = btn.dataset.voteType;
      const playerId = parseInt(btn.dataset.playerId);

      const success = await submitVote(voteType, playerId, currentRound);

      if (success) {
        const status = $('voteStatus');
        if (status) {
          status.textContent = `✅ 已投票: ${voteType === 'mvp' ? '最C' : '最闹'}`;
          status.style.color = '#22c55e';
        }

        // Visual feedback
        btn.style.borderColor = voteType === 'mvp' ? '#22c55e' : '#ef4444';
      }
    };
  });
}

/**
 * Show host voting interface with results
 */
export async function showHostVoting() {
  if (!isHost) return;

  const votingSection = $('votingSection');
  if (!votingSection) return;

  votingSection.style.display = 'block';

  const results = await getVotingResults();

  const hostInterface = $('hostVotingInterface');
  if (!hostInterface) return;

  if (!results || !results.mvp || !results.burden) {
    hostInterface.innerHTML = '<p class="muted">暂无投票数据</p>';
    return;
  }

  const players = getPlayers();

  // Format vote results
  const mvpVotes = Object.entries(results.mvp.votes || {})
    .map(([playerId, count]) => {
      const player = players.find(p => p.id === parseInt(playerId));
      return { player, count };
    })
    .filter(v => v.player)
    .sort((a, b) => b.count - a.count);

  const burdenVotes = Object.entries(results.burden.votes || {})
    .map(([playerId, count]) => {
      const player = players.find(p => p.id === parseInt(playerId));
      return { player, count };
    })
    .filter(v => v.player)
    .sort((a, b) => b.count - a.count);

  hostInterface.innerHTML = `
    <h4>观众投票结果</h4>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
      <div>
        <h5 style="color: #22c55e;">最C (MVP)</h5>
        ${mvpVotes.map(v => `
          <div style="padding: 8px; margin: 5px 0; background: #2a2b2c; border-radius: 6px;">
            <span style="font-size: 18px;">${v.player.emoji}</span>
            <span>${v.player.name}</span>
            <span style="float: right; color: #22c55e; font-weight: bold;">${v.count} 票</span>
          </div>
        `).join('') || '<p class="muted small">暂无投票</p>'}
      </div>

      <div>
        <h5 style="color: #ef4444;">最闹 (Burden)</h5>
        ${burdenVotes.map(v => `
          <div style="padding: 8px; margin: 5px 0; background: #2a2b2c; border-radius: 6px;">
            <span style="font-size: 18px;">${v.player.emoji}</span>
            <span>${v.player.name}</span>
            <span style="float: right; color: #ef4444; font-weight: bold;">${v.count} 票</span>
          </div>
        `).join('') || '<p class="muted small">暂无投票</p>'}
      </div>
    </div>

    <div style="margin-top: 20px; text-align: center;">
      <button id="confirmVotes" style="padding: 12px 24px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer;">
        ✅ 确认并记录
      </button>
      <button id="clearVotes" style="padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; margin-left: 10px;">
        🗑️ 清空投票
      </button>
    </div>
  `;

  // Attach handlers
  const confirmBtn = $('confirmVotes');
  const clearBtn = $('clearVotes');

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      // Record winning votes to "人民的声音"
      if (mvpVotes.length > 0) {
        console.log('MVP:', mvpVotes[0].player.name);
      }
      if (burdenVotes.length > 0) {
        console.log('Burden:', burdenVotes[0].player.name);
      }
      alert('投票结果已确认');
    };
  }

  if (clearBtn) {
    clearBtn.onclick = async () => {
      const authToken = prompt('请输入房主密码:');
      if (authToken) {
        const success = await resetVoting(authToken);
        if (success) {
          alert('投票已清空');
          showHostVoting(); // Refresh
        }
      }
    };
  }
}

/**
 * Start live vote count polling (host only)
 */
export function startVotePolling() {
  if (!isHost) return;

  setInterval(async () => {
    await showHostVoting();
  }, 1000); // Update every second
}
