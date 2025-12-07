/**
 * Voting Manager - End-Game Remote Voting for Room Viewers
 * Allows viewers to vote when game ends (A-level victory)
 */

import { currentRoomCode, isHost, isViewer, getRoomInfo } from './roomManager.js';
import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';
import { $ } from '../core/utils.js';
import { emit, on as onEvent } from '../core/events.js';

/**
 * Submit end-game vote as viewer
 * @param {string} voteType - 'mvp' or 'burden'
 * @param {number} playerId - Player ID being voted for
 * @returns {Promise<boolean>} Success
 */
export async function submitEndGameVote(voteType, playerId) {
  const roomInfo = getRoomInfo();

  if (!roomInfo.roomCode || !roomInfo.isViewer) {
    console.error('Not in viewer mode or no room');
    return false;
  }

  try {
    // Use total games as game identifier
    const gameNumber = state.getHistory().length;

    const response = await fetch(`/api/rooms/vote/${roomInfo.roomCode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        voteType,
        playerId,
        gameNumber, // End-game vote identifier
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      console.error('Failed to submit vote');
      return false;
    }

    emit('voting:submitted', { voteType, playerId, gameNumber });
    return true;
  } catch (error) {
    console.error('Error submitting vote:', error);
    return false;
  }
}

/**
 * Get end-game voting results (host only)
 * @returns {Promise<Object|null>} Voting results
 */
export async function getEndGameVotingResults() {
  const roomInfo = getRoomInfo();

  if (!roomInfo.roomCode || !roomInfo.isHost) {
    return null;
  }

  try {
    const gameNumber = state.getHistory().length;

    const response = await fetch(`/api/rooms/vote/${roomInfo.roomCode}?game=${gameNumber}`);

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    const results = text ? JSON.parse(text) : null;

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
 * Show end-game voting UI for viewers
 */
export function showEndGameVotingForViewers() {
  const roomInfo = getRoomInfo();

  if (!roomInfo.isViewer) return;

  console.log('Showing end-game voting for viewer');

  const votingSection = $('votingSection');
  if (!votingSection) return;

  votingSection.style.display = 'block';

  const players = getPlayers();
  const gameNumber = state.getHistory().length;

  const voterInterface = $('voterInterface');
  if (!voterInterface) return;

  voterInterface.innerHTML = `
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; color: white;">
      <h3 style="margin: 0 0 8px 0;">🎉 游戏结束！</h3>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">为本场比赛投票</p>
    </div>

    <div style="margin-bottom: 25px;">
      <h4 style="color: #22c55e; margin-bottom: 10px;">谁是本场 MVP (最C)？</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
        ${players.map(p => `
          <button class="vote-btn-mvp" data-player-id="${p.id}" style="
            padding: 10px;
            background: #2a2b2c;
            border: 2px solid #444;
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <div style="font-size: 24px;">${p.emoji}</div>
            <div style="font-size: 11px;">${p.name}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <div style="margin-bottom: 25px;">
      <h4 style="color: #ef4444; margin-bottom: 10px;">谁是本场累赘 (最闹)？</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
        ${players.map(p => `
          <button class="vote-btn-burden" data-player-id="${p.id}" style="
            padding: 10px;
            background: #2a2b2c;
            border: 2px solid #444;
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <div style="font-size: 24px;">${p.emoji}</div>
            <div style="font-size: 11px;">${p.name}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <div id="voteStatus" style="margin-top: 15px; padding: 15px; background: #1a1b1c; border-radius: 8px; text-align: center; color: #999; font-size: 14px;">
      👆 点击上方按钮投票
    </div>
  `;

  // Attach vote handlers for MVP
  const mvpButtons = voterInterface.querySelectorAll('.vote-btn-mvp');
  mvpButtons.forEach(btn => {
    btn.onclick = async () => {
      const playerId = parseInt(btn.dataset.playerId);
      const success = await submitEndGameVote('mvp', playerId);

      if (success) {
        const status = $('voteStatus');
        if (status) {
          const player = players.find(p => p.id === playerId);
          status.innerHTML = `✅ 已投 MVP: ${player.emoji}${player.name}`;
          status.style.color = '#22c55e';
        }

        // Visual feedback
        mvpButtons.forEach(b => b.style.borderColor = '#444');
        btn.style.borderColor = '#22c55e';
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => btn.style.transform = 'scale(1)', 100);
      }
    };
  });

  // Attach vote handlers for Burden
  const burdenButtons = voterInterface.querySelectorAll('.vote-btn-burden');
  burdenButtons.forEach(btn => {
    btn.onclick = async () => {
      const playerId = parseInt(btn.dataset.playerId);
      const success = await submitEndGameVote('burden', playerId);

      if (success) {
        const status = $('voteStatus');
        if (status) {
          const player = players.find(p => p.id === playerId);
          status.innerHTML = `✅ 已投最闹: ${player.emoji}${player.name}`;
          status.style.color = '#ef4444';
        }

        // Visual feedback
        burdenButtons.forEach(b => b.style.borderColor = '#444');
        btn.style.borderColor = '#ef4444';
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => btn.style.transform = 'scale(1)', 100);
      }
    };
  });
}

// Listen for victory event to show viewer voting
onEvent('game:victoryForVoting', () => {
  const roomInfo = getRoomInfo();
  if (roomInfo.isViewer) {
    showEndGameVotingForViewers();
  }
});

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
