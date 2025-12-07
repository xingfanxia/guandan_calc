/**
 * Voting Manager - End-Game Remote Voting for Room Viewers
 * Allows viewers to vote when game ends (A-level victory)
 */

import { currentRoomCode, isHost, isViewer, getRoomInfo } from './roomManager.js';
import { getPlayers } from '../player/playerManager.js';
import state from '../core/state.js';
import { $ } from '../core/utils.js';
import { emit, on as onEvent } from '../core/events.js';

// Track if voting has been unlocked (prevent re-locking on refresh)
let votingUnlocked = false;

/**
 * Submit end-game votes (both MVP and burden together)
 * @param {number} mvpPlayerId - MVP player ID
 * @param {number} burdenPlayerId - Burden player ID
 * @returns {Promise<boolean>} Success
 */
export async function submitEndGameVotes(mvpPlayerId, burdenPlayerId) {
  const roomInfo = getRoomInfo();

  if (!roomInfo.roomCode || !roomInfo.isViewer) {
    console.error('Not in viewer mode or no room');
    return false;
  }

  try {
    const gameNumber = state.getHistory().length;

    console.log('Submitting votes:', { mvpPlayerId, burdenPlayerId, gameNumber });

    const response = await fetch(`/api/rooms/vote/${roomInfo.roomCode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mvpPlayerId,
        burdenPlayerId,
        gameNumber
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to submit vote:', error);
      return false;
    }

    console.log('Vote submitted successfully, emitting event');
    emit('voting:submitted', { mvpPlayerId, burdenPlayerId });

    // ALSO call directly to ensure it runs
    setTimeout(() => {
      console.log('Calling updateVoteLeaderboard directly');
      updateVoteLeaderboard();
    }, 500);

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
 * Initialize locked voting section for viewers (called on page load)
 */
export function initializeViewerVotingSection() {
  const roomInfo = getRoomInfo();
  if (!roomInfo.isViewer) return;

  console.log('Initializing locked voting section for viewer');

  // Create locked voting section
  let votingCard = document.getElementById('viewerVotingCard');

  if (!votingCard) {
    votingCard = document.createElement('div');
    votingCard.id = 'viewerVotingCard';
    votingCard.className = 'card';
    votingCard.style.cssText = `
      background: #2a2b2c;
      border: 2px solid #666;
      padding: 20px;
      border-radius: 12px;
      margin: 20px 0;
      opacity: 0.5;
    `;

    const wrap = document.querySelector('.wrap');
    if (wrap) {
      // Insert after viewer banner area
      const firstCard = wrap.querySelector('.card');
      if (firstCard) {
        wrap.insertBefore(votingCard, firstCard);
      }
    }
  }

  const players = getPlayers();

  votingCard.innerHTML = `
    <h3 style="color: #999; margin: 0 0 10px 0; text-align: center;">
      🔒 投票区（游戏结束后解锁）
    </h3>
    <p style="color: #666; text-align: center; font-size: 13px; margin-bottom: 15px;">
      等待游戏结束...
    </p>
    <div id="votingButtons" style="opacity: 0.3; pointer-events: none;">
      <div style="margin-bottom: 15px;">
        <h4 style="color: #666; margin-bottom: 10px;">MVP (最C):</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
          ${players.map(p => `
            <div style="padding: 8px; background: #1a1b1c; border: 2px solid #444; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px;">${p.emoji}</div>
              <div style="font-size: 10px; color: #666;">${p.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <h4 style="color: #666; margin-bottom: 10px;">累赘 (最闹):</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
          ${players.map(p => `
            <div style="padding: 8px; background: #1a1b1c; border: 2px solid #444; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px;">${p.emoji}</div>
              <div style="font-size: 10px; color: #666;">${p.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Unlock voting section for viewers (called when game ends)
 */
export function unlockViewerVoting() {
  const roomInfo = getRoomInfo();
  if (!roomInfo.isViewer) return;

  // Already unlocked, don't recreate
  if (votingUnlocked) {
    console.log('Voting already unlocked, skipping');
    return;
  }

  votingUnlocked = true;
  console.log('Unlocking voting section for viewer');

  const votingCard = document.getElementById('viewerVotingCard');
  if (!votingCard) {
    console.error('Voting card not found');
    return;
  }

  // Update card styling
  votingCard.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
  votingCard.style.border = '3px solid #22c55e';
  votingCard.style.opacity = '1';

  const players = getPlayers();

  // Replace with interactive buttons
  votingCard.innerHTML = `
    <h3 style="color: white; margin: 0 0 15px 0; text-align: center;">
      🎉 游戏结束 - 请投票！
    </h3>

    <div style="margin-bottom: 15px;">
      <h4 style="color: white; margin-bottom: 10px;">谁是本场 MVP (最C)？</h4>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        ${players.map(p => `
          <button class="vote-mvp-btn" data-player-id="${p.id}" style="
            padding: 10px;
            background: white;
            border: 3px solid white;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <div style="font-size: 24px;">${p.emoji}</div>
            <div style="font-size: 11px; color: #1a1b1c; font-weight: bold;">${p.name}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <div style="margin-bottom: 15px;">
      <h4 style="color: white; margin-bottom: 10px;">谁是本场累赘 (最闹)？</h4>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        ${players.map(p => `
          <button class="vote-burden-btn" data-player-id="${p.id}" style="
            padding: 10px;
            background: white;
            border: 3px solid white;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <div style="font-size: 24px;">${p.emoji}</div>
            <div style="font-size: 11px; color: #1a1b1c; font-weight: bold;">${p.name}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <div id="viewerVoteStatus" style="
      padding: 15px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      text-align: center;
      color: white;
      font-weight: bold;
      font-size: 15px;
    ">
      👆 点击上方按钮投票
    </div>
  `;

  // Add confirm button at bottom
  votingCard.innerHTML += `
    <button id="confirmViewerVote" style="
      width: 100%;
      padding: 15px;
      background: white;
      color: #22c55e;
      border: 3px solid white;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      margin-top: 15px;
    ">
      ✅ 确认投票
    </button>
  `;

  // Track selections
  let selectedMVP = null;
  let selectedBurden = null;

  // Attach selection handlers
  setTimeout(() => {
    const mvpBtns = votingCard.querySelectorAll('.vote-mvp-btn');
    console.log('Attached MVP selection handlers:', mvpBtns.length);

    mvpBtns.forEach(btn => {
      btn.onclick = () => {
        const playerId = parseInt(btn.dataset.playerId);
        console.log('Selected MVP:', playerId);

        selectedMVP = playerId;

        // Visual feedback - highlight selected
        mvpBtns.forEach(b => {
          b.style.borderColor = 'white';
          b.style.background = 'white';
        });
        btn.style.borderColor = '#22c55e';
        btn.style.background = 'rgba(34, 197, 94, 0.2)';
        btn.style.borderWidth = '4px';

        updateVoteStatus();
      };
    });

    const burdenBtns = votingCard.querySelectorAll('.vote-burden-btn');
    console.log('Attached burden selection handlers:', burdenBtns.length);

    burdenBtns.forEach(btn => {
      btn.onclick = () => {
        const playerId = parseInt(btn.dataset.playerId);
        console.log('Selected burden:', playerId);

        selectedBurden = playerId;

        // Visual feedback - highlight selected
        burdenBtns.forEach(b => {
          b.style.borderColor = 'white';
          b.style.background = 'white';
        });
        btn.style.borderColor = '#ef4444';
        btn.style.background = 'rgba(239, 68, 68, 0.2)';
        btn.style.borderWidth = '4px';

        updateVoteStatus();
      };
    });

    // Confirm button handler
    const confirmBtn = document.getElementById('confirmViewerVote');
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        if (!selectedMVP || !selectedBurden) {
          alert('请先选择 MVP 和累赘');
          return;
        }

        console.log('Confirming votes:', { mvp: selectedMVP, burden: selectedBurden });

        // Submit both votes together
        const success = await submitEndGameVotes(selectedMVP, selectedBurden);

        if (success) {
          // Trigger immediate leaderboard update
          setTimeout(updateVoteLeaderboard, 200);

          const status = document.getElementById('viewerVoteStatus');
          const mvpPlayer = players.find(p => p.id === selectedMVP);
          const burdenPlayer = players.find(p => p.id === selectedBurden);

          if (status) {
            status.innerHTML = `✅ 投票成功！<br>MVP: ${mvpPlayer.emoji}${mvpPlayer.name}<br>最闹: ${burdenPlayer.emoji}${burdenPlayer.name}<br><br>正在获取投票结果...`;
            status.style.background = 'rgba(34, 197, 94, 0.5)';
          }

          confirmBtn.disabled = true;
          confirmBtn.style.opacity = '0.5';
          confirmBtn.textContent = '✅ 已投票';

          // Show vote results to viewer
          setTimeout(() => showVoteResultsToViewer(votingCard), 1000);
        } else {
          alert('投票失败，请重试');
        }
      };
    }

    function updateVoteStatus() {
      const status = document.getElementById('viewerVoteStatus');
      if (!status) return;

      let text = '';
      if (selectedMVP) {
        const mvpPlayer = players.find(p => p.id === selectedMVP);
        text += `MVP: ${mvpPlayer.emoji}${mvpPlayer.name}`;
      }
      if (selectedBurden) {
        const burdenPlayer = players.find(p => p.id === selectedBurden);
        if (text) text += '<br>';
        text += `最闹: ${burdenPlayer.emoji}${burdenPlayer.name}`;
      }

      if (text) {
        status.innerHTML = `已选择：<br>${text}<br><br>👇 点击下方确认按钮提交`;
      }
    }
  }, 200);
}

/**
 * Show end-game voting UI for viewers
 */
export function showEndGameVotingForViewers() {
  unlockViewerVoting();
}

onEvent('game:victoryForVoting', () => {
  const roomInfo = getRoomInfo();
  if (roomInfo.isViewer) {
    showEndGameVotingForViewers();
  } else if (roomInfo.isHost) {
    updateVoteLeaderboard();
  }
});

onEvent('voting:submitted', () => {
  setTimeout(updateVoteLeaderboard, 500);
});

/**
 * Show vote results to viewer after voting
 */
async function showVoteResultsToViewer(votingCard) {
  const roomInfo = getRoomInfo();
  if (!roomInfo.roomCode) return;

  try {
    const response = await fetch(`/api/rooms/vote/${roomInfo.roomCode}`);
    const data = await response.json();

    if (!data.success || !data.votes) return;

    const players = getPlayers();
    const mvpVotes = Object.entries(data.votes.mvp || {})
      .map(([id, count]) => ({ p: players.find(p => p.id === parseInt(id)), count }))
      .filter(v => v.p)
      .sort((a, b) => b.count - a.count);

    const burdenVotes = Object.entries(data.votes.burden || {})
      .map(([id, count]) => ({ p: players.find(p => p.id === parseInt(id)), count }))
      .filter(v => v.p)
      .sort((a, b) => b.count - a.count);

    // Add results section to voting card
    const resultsDiv = document.createElement('div');
    resultsDiv.style.cssText = `
      margin-top: 20px;
      padding: 15px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.3);
    `;

    resultsDiv.innerHTML = `
      <h4 style="color: white; margin: 0 0 15px 0; text-align: center;">📊 当前投票结果</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <h5 style="color: white; margin-bottom: 10px; font-weight: bold;">MVP</h5>
          ${mvpVotes.slice(0, 3).map((v, i) => `
            <div style="padding: 10px; margin: 6px 0; background: rgba(255, 255, 255, 0.9); color: #1a1b1c; border-radius: 6px; font-size: 15px; font-weight: ${i === 0 ? 'bold' : 'normal'};">
              ${i + 1}. ${v.p.emoji}${v.p.name}: <strong style="color: #22c55e;">${v.count}票</strong>
            </div>
          `).join('') || '<div style="color: white;">暂无</div>'}
        </div>
        <div>
          <h5 style="color: white; margin-bottom: 10px; font-weight: bold;">最闹</h5>
          ${burdenVotes.slice(0, 3).map((v, i) => `
            <div style="padding: 10px; margin: 6px 0; background: rgba(255, 255, 255, 0.9); color: #1a1b1c; border-radius: 6px; font-size: 15px; font-weight: ${i === 0 ? 'bold' : 'normal'};">
              ${i + 1}. ${v.p.emoji}${v.p.name}: <strong style="color: #ef4444;">${v.count}票</strong>
            </div>
          `).join('') || '<div style="color: white;">暂无</div>'}
        </div>
      </div>
    `;

    votingCard.appendChild(resultsDiv);

  } catch (error) {
    console.error('Error fetching vote results:', error);
  }
}

export async function updateVoteLeaderboard() {
  console.log('updateVoteLeaderboard called');

  const roomInfo = getRoomInfo();
  if (!roomInfo.roomCode) {
    console.log('No room code');
    return;
  }

  console.log('Fetching votes from:', `/api/rooms/vote/${roomInfo.roomCode}`);

  const response = await fetch(`/api/rooms/vote/${roomInfo.roomCode}`);
  const data = await response.json();

  console.log('Vote data received:', data);

  if (!data.success || !data.votes) {
    console.log('No vote data');
    return;
  }

  const players = getPlayers();

  console.log('Votes:', data.votes);

  const mvp = Object.entries(data.votes.mvp || {})
    .map(([id, count]) => ({ p: players.find(p => p.id === parseInt(id)), count }))
    .filter(v => v.p)
    .sort((a, b) => b.count - a.count);

  const burden = Object.entries(data.votes.burden || {})
    .map(([id, count]) => ({ p: players.find(p => p.id === parseInt(id)), count }))
    .filter(v => v.p)
    .sort((a, b) => b.count - a.count);

  console.log('MVP sorted:', mvp);
  console.log('Burden sorted:', burden);

  const mvpDiv = document.getElementById('mvpStatsTable');
  const burdenDiv = document.getElementById('burdenStatsTable');

  console.log('mvpDiv found:', !!mvpDiv, 'burdenDiv found:', !!burdenDiv);

  if (mvpDiv) {
    const html = mvp.map((v, i) => `<div style="padding:8px;margin:4px 0;background:rgba(34,197,94,0.2);border-left:3px solid #22c55e;border-radius:4px;">${i+1}. ${v.p.emoji}${v.p.name}: <strong>${v.count}票</strong></div>`).join('') || '暂无数据';
    console.log('Setting mvpDiv innerHTML:', html);
    mvpDiv.innerHTML = html;
  }

  if (burdenDiv) {
    const html = burden.map((v, i) => `<div style="padding:8px;margin:4px 0;background:rgba(239,68,68,0.2);border-left:3px solid #ef4444;border-radius:4px;">${i+1}. ${v.p.emoji}${v.p.name}: <strong>${v.count}票</strong></div>`).join('') || '暂无数据';
    console.log('Setting burdenDiv innerHTML:', html);
    burdenDiv.innerHTML = html;
  }

  console.log('updateVoteLeaderboard complete');
}

/**
 * Show host voting interface with results
 */
export async function showHostVoting() {
  const roomInfo = getRoomInfo();

  if (!roomInfo.isHost) return;

  const votingSection = $('votingSection');
  if (!votingSection) return;

  votingSection.style.display = 'block';

  const results = await getEndGameVotingResults();

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
