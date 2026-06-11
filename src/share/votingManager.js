/**
 * Voting Manager - Community Voting System
 * Handles end-game MVP and burden voting for viewers and host
 */

import { $, escapeHtml } from '../core/utils.js';
import { on as onEvent, emit } from '../core/events.js';
import { getRoomInfo } from './roomManager.js';
import state from '../core/state.js';
import config from '../core/config.js';
import { getPlayers, normalizeTeamNumber } from '../player/playerManager.js';
import { renderProfileAvatar } from '../player/photoRenderer.js';
import { readOptionalJsonResponse as readOptionalJson } from '../api/httpResponse.js';
import { getHistoryEntries, resolveGameStatus } from '../game/gameStatus.js';
import {
  deriveVoteSessionKey,
  hasAlreadyVotedInSession,
  markVotedInSession
} from './voteSession.js';
import { findPlayerByVoteId, normalizeVoteApiResults, normalizeVotePlayerId } from './voteResults.js';
import { syncVotingToProfiles } from './votingSync.js';

// Track if voting has been unlocked (prevent re-locking on refresh)
let votingUnlocked = false;
let hostVotePollingInterval = null;
let activeVoteSessionKey = null;
let volatileFingerprint = null;

function readStoredFingerprint() {
  try {
    return globalThis.localStorage?.getItem?.('gd_voter_fingerprint') || null;
  } catch {
    return null;
  }
}

function writeStoredFingerprint(fingerprint) {
  try {
    globalThis.localStorage?.setItem?.('gd_voter_fingerprint', fingerprint);
  } catch {
    // Storage can be blocked in private/embedded contexts. The in-memory
    // fallback still keeps repeated submissions in the same page stable.
  }
}

/**
 * Generate a simple browser fingerprint for vote deduplication
 * Uses localStorage ID + browser properties
 */
function getBrowserFingerprint() {
  // Check if we already have a fingerprint stored
  const storedFingerprint = readStoredFingerprint();

  if (storedFingerprint) {
    return storedFingerprint;
  }
  if (volatileFingerprint) {
    return volatileFingerprint;
  }

  const nav = globalThis.navigator || {};
  const display = globalThis.screen || {};
  // Generate new fingerprint from browser properties
  const components = [
    nav.userAgent || 'unknown',
    nav.language || 'unknown',
    (display.width || 0) + 'x' + (display.height || 0),
    display.colorDepth || 'unknown',
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || 'unknown',
    // Add some randomness for uniqueness
    Math.random().toString(36).substring(2, 15)
  ];

  // Simple hash function
  const fingerprint = components.join('|');
  const hash = fingerprint.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString(36);

  // Add timestamp for extra uniqueness
  const fullFingerprint = hash + '_' + Date.now().toString(36);

  volatileFingerprint = fullFingerprint;
  writeStoredFingerprint(fullFingerprint);

  return fullFingerprint;
}

function deriveVoteSessionKeyFromState(roomInfo = getRoomInfo()) {
  return deriveVoteSessionKey({
    roomCode: roomInfo.roomCode,
    gameStatus: state.getGameStatus(),
    history: state.getHistory(),
    finishedAt: roomInfo.finishedAt,
    endGameVotesHistory: []
  });
}

function deriveVoteSessionKeyFromRoomData(roomData) {
  return deriveVoteSessionKey({
    roomCode: roomData?.roomCode || getRoomInfo().roomCode,
    gameStatus: roomData?.state?.gameStatus,
    history: getHistoryEntries(roomData?.state),
    finishedAt: roomData?.finishedAt,
    endGameVotesHistory: roomData?.endGameVotesHistory
  });
}

function getCurrentVoteSessionKey(roomInfo = getRoomInfo()) {
  if (activeVoteSessionKey) {
    return activeVoteSessionKey;
  }

  activeVoteSessionKey = deriveVoteSessionKeyFromState(roomInfo);
  return activeVoteSessionKey;
}

export function resolveVotingWinner(gameStatus, history) {
  const resolvedStatus = resolveGameStatus(gameStatus, history);
  if (!resolvedStatus.ended || !resolvedStatus.winnerKey) {
    return null;
  }

  return {
    winKey: resolvedStatus.winnerKey,
    winName: resolvedStatus.winnerName || null
  };
}

/**
 * Check if current browser has already voted in the active voting window.
 */
function hasAlreadyVoted(roomInfo = getRoomInfo()) {
  return hasAlreadyVotedInSession(globalThis.localStorage, getCurrentVoteSessionKey(roomInfo));
}

/**
 * Mark current browser as having voted in the active voting window.
 */
function markAsVoted(roomInfo = getRoomInfo()) {
  return markVotedInSession(globalThis.localStorage, getCurrentVoteSessionKey(roomInfo));
}

export function resetViewerVotingState() {
  votingUnlocked = false;

  const roomInfo = getRoomInfo();
  if (roomInfo.isViewer) {
    initializeViewerVotingSection();
  }
}

export function resetViewerVotingUnlockState() {
  votingUnlocked = false;
}

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
    return { success: false, error: 'not_viewer' };
  }

  // Check if already voted (client-side check)
  if (hasAlreadyVoted(roomInfo)) {
    console.warn('Already voted for this room');
    return { success: false, error: 'already_voted' };
  }

  const normalizedMvpPlayerId = normalizeVotePlayerId(mvpPlayerId);
  const normalizedBurdenPlayerId = normalizeVotePlayerId(burdenPlayerId);
  if (!normalizedMvpPlayerId || !normalizedBurdenPlayerId) {
    console.error('Invalid vote player ID');
    return { success: false, error: 'invalid_player' };
  }

  // Validate: MVP and burden cannot be the same person
  if (normalizedMvpPlayerId === normalizedBurdenPlayerId) {
    console.error('MVP and burden cannot be the same person');
    return { success: false, error: 'same_person' };
  }

  try {
    const gameNumber = state.getHistory().length;
    const fingerprint = getBrowserFingerprint();

    const response = await fetch(`/api/rooms/vote/${encodeURIComponent(roomInfo.roomCode)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mvpPlayerId: normalizedMvpPlayerId,
        burdenPlayerId: normalizedBurdenPlayerId,
        gameNumber,
        fingerprint
      })
    });

    const result = await readOptionalJson(response);

    if (!response.ok) {
      console.error('Failed to submit vote:', result.error || response.statusText);
      return { success: false, error: result.error || 'server_error' };
    }

    // Mark as voted locally
    markAsVoted(roomInfo);

    emit('voting:submitted', {
      mvpPlayerId: normalizedMvpPlayerId,
      burdenPlayerId: normalizedBurdenPlayerId
    });

    // ALSO call directly to ensure it runs
    setTimeout(() => {
      updateVoteLeaderboard();
    }, 500);

    return { success: true };
  } catch (error) {
    console.error('Error submitting vote:', error);
    return { success: false, error: 'network_error' };
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

    const response = await fetch(`/api/rooms/vote/${encodeURIComponent(roomInfo.roomCode)}?game=${gameNumber}`);

    if (!response.ok) {
      return null;
    }

    const payload = await readOptionalJson(response);
    if (!payload?.success || !payload?.votes) {
      return null;
    }

    return normalizeVoteApiResults(payload);
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
  // currentRoomCode/isHost were undefined module-scoped refs (P2 #10 fix);
  // pull current values via getRoomInfo() instead.
  const roomInfo = getRoomInfo();
  if (!roomInfo.roomCode || !roomInfo.isHost) {
    return false;
  }

  try {
    const history = state.getHistory();
    const roundNumber = history.length;

    const response = await fetch(`/api/rooms/reset-vote/${encodeURIComponent(roomInfo.roomCode)}`, {
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
              <div style="font-size: 20px;">${escapeHtml(p.emoji)}</div>
              <div style="font-size: 10px; color: #666;">${escapeHtml(p.name)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <h4 style="color: #666; margin-bottom: 10px;">累赘 (最闹):</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
          ${players.map(p => `
            <div style="padding: 8px; background: #1a1b1c; border: 2px solid #444; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px;">${escapeHtml(p.emoji)}</div>
              <div style="font-size: 10px; color: #666;">${escapeHtml(p.name)}</div>
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
  if (votingUnlocked) return;

  let votingCard = document.getElementById('viewerVotingCard');
  if (!votingCard) {
    initializeViewerVotingSection();
    votingCard = document.getElementById('viewerVotingCard');
  }

  if (!votingCard) {
    console.error('Voting card not found');
    return;
  }

  votingUnlocked = true;

  // Check if already voted
  if (hasAlreadyVoted(roomInfo)) {
    // Show "already voted" UI
    votingCard.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
    votingCard.style.border = '3px solid #6b7280';
    votingCard.style.opacity = '1';

    votingCard.innerHTML = `
      <h3 style="color: white; margin: 0 0 15px 0; text-align: center;">
        ✅ 您已投过票
      </h3>
      <p style="color: rgba(255,255,255,0.8); text-align: center; margin-bottom: 15px;">
        每个设备只能投一次票，感谢您的参与！
      </p>
      <div id="viewerVoteResultsContainer"></div>
    `;

    // Show current vote results
    setTimeout(() => showVoteResultsToViewer(votingCard), 500);
    return;
  }

  // Update card styling
  votingCard.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
  votingCard.style.border = '3px solid #22c55e';
  votingCard.style.opacity = '1';

  const players = getPlayers();

  // Calculate winning team MVP and teammates
  const history = state.getHistory();
  const votingWinner = resolveVotingWinner(state.getGameStatus(), history);
  let winnerSection = '';
  
  if (votingWinner) {
    const winningTeamKey = votingWinner.winKey;
    const winningTeamName = votingWinner.winName ||
      (winningTeamKey === 't1' ? config.getTeamName('t1') : config.getTeamName('t2'));
    const winningTeamColor = winningTeamKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');
    const winningTeamNum = winningTeamKey === 't1' ? 1 : 2;
    const teamPlayers = players.filter(p => normalizeTeamNumber(p.team) === winningTeamNum);
    const playerStats = state.getPlayerStats();
    
    // Find MVP
    let mvpPlayer = null;
    let bestAvg = Infinity;
    
    teamPlayers.forEach(player => {
      const stats = playerStats[player.id];
      if (stats && stats.games > 0) {
        const avgRank = stats.totalRank / stats.games;
        if (avgRank < bestAvg) {
          bestAvg = avgRank;
          mvpPlayer = player;
        }
      }
    });
    
    if (mvpPlayer) {
      winnerSection = `
        <div style="background: rgba(255, 255, 255, 0.95); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <div style="color: ${winningTeamColor}; font-size: 24px; font-weight: bold; margin-bottom: 16px; text-align: center;">
            🎉 ${escapeHtml(winningTeamName)} 通关！
          </div>

          <div style="text-align: center; margin-bottom: 16px;">
            <div style="color: #d97706; font-weight: bold; margin-bottom: 12px; font-size: 16px;">MVP</div>
            <div style="display: flex; justify-content: center; margin-bottom: 8px;">
              ${renderProfileAvatar(mvpPlayer, 80, { marginRight: false })}
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #000;">${escapeHtml(mvpPlayer.name)}</div>
            <div style="color: #666; font-size: 14px;">平均 ${bestAvg.toFixed(2)} 名</div>
            ${mvpPlayer.tagline ? `<div style="font-style: italic; color: #d97706; margin-top: 8px;">"${escapeHtml(mvpPlayer.tagline)}"</div>` : ''}
          </div>

          <div style="text-align: center;">
            <div style="color: #666; font-size: 14px; margin-bottom: 8px;">队友</div>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              ${teamPlayers.filter(p => p.id !== mvpPlayer.id).map(p => `
                <div style="text-align: center;">
                  <div style="font-size: 24px;">${escapeHtml(p.emoji)}</div>
                  <div style="font-size: 11px; color: #666;">${escapeHtml(p.name)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  }

  // Replace with interactive buttons
  votingCard.innerHTML = `
    ${winnerSection}
    
    <h3 style="color: white; margin: 0 0 15px 0; text-align: center;">
      🎉 游戏结束 - 请投票！
    </h3>

    <div style="margin-bottom: 15px;">
      <h4 style="color: white; margin-bottom: 10px;">谁是本场 MVP (最C)？</h4>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        ${players.map(p => `
          <button class="vote-mvp-btn" data-player-id="${escapeHtml(p.id)}" style="
            padding: 10px;
            background: white;
            border: 3px solid white;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <div style="font-size: 24px;">${escapeHtml(p.emoji)}</div>
            <div style="font-size: 11px; color: #1a1b1c; font-weight: bold;">${escapeHtml(p.name)}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <div style="margin-bottom: 15px;">
      <h4 style="color: white; margin-bottom: 10px;">谁是本场累赘 (最闹)？</h4>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        ${players.map(p => `
          <button class="vote-burden-btn" data-player-id="${escapeHtml(p.id)}" style="
            padding: 10px;
            background: white;
            border: 3px solid white;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <div style="font-size: 24px;">${escapeHtml(p.emoji)}</div>
            <div style="font-size: 11px; color: #1a1b1c; font-weight: bold;">${escapeHtml(p.name)}</div>
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

    mvpBtns.forEach(btn => {
      btn.onclick = () => {
        const playerId = normalizeVotePlayerId(btn.dataset.playerId);
        if (!playerId) return;

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

    burdenBtns.forEach(btn => {
      btn.onclick = () => {
        const playerId = normalizeVotePlayerId(btn.dataset.playerId);
        if (!playerId) return;

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

        // Validate: cannot select same person for both
        if (selectedMVP === selectedBurden) {
          alert('不能选择同一个人同时作为 MVP 和累赘！');
          return;
        }

        // Submit both votes together
        const result = await submitEndGameVotes(selectedMVP, selectedBurden);

        if (result.success) {
          // Trigger immediate leaderboard update
          setTimeout(updateVoteLeaderboard, 200);

          const status = document.getElementById('viewerVoteStatus');
          const mvpPlayer = findPlayerByVoteId(players, selectedMVP);
          const burdenPlayer = findPlayerByVoteId(players, selectedBurden);

          if (status && mvpPlayer && burdenPlayer) {
            status.innerHTML = `✅ 投票成功！<br>MVP: ${escapeHtml(mvpPlayer.emoji)}${escapeHtml(mvpPlayer.name)}<br>最闹: ${escapeHtml(burdenPlayer.emoji)}${escapeHtml(burdenPlayer.name)}<br><br>正在获取投票结果...`;
            status.style.background = 'rgba(34, 197, 94, 0.5)';
          }

          confirmBtn.disabled = true;
          confirmBtn.style.opacity = '0.5';
          confirmBtn.textContent = '✅ 已投票';

          // Show vote results to viewer
          setTimeout(() => showVoteResultsToViewer(votingCard), 1000);
        } else {
          // Handle specific errors
          if (result.error === 'already_voted') {
            alert('您已经投过票了！每个设备只能投一次票。');
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.textContent = '❌ 已投过票';
          } else if (result.error === 'same_person') {
            alert('不能选择同一个人同时作为 MVP 和累赘！');
          } else if (result.error === 'duplicate_fingerprint') {
            alert('检测到重复投票！每个设备只能投一次票。');
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.textContent = '❌ 已投过票';
          } else {
            alert('投票失败，请重试');
          }
        }
      };
    }

    function updateVoteStatus() {
      const status = document.getElementById('viewerVoteStatus');
      if (!status) return;

      // Check for same person selection
      if (selectedMVP && selectedBurden && selectedMVP === selectedBurden) {
        const player = findPlayerByVoteId(players, selectedMVP);
        status.innerHTML = player
          ? `⚠️ 警告：不能选同一个人！<br>${escapeHtml(player.emoji)}${escapeHtml(player.name)} 不能同时是 MVP 和累赘`
          : '⚠️ 警告：不能选同一个人！';
        status.style.background = 'rgba(239, 68, 68, 0.5)';
        return;
      }

      let text = '';
      if (selectedMVP) {
        const mvpPlayer = findPlayerByVoteId(players, selectedMVP);
        if (mvpPlayer) {
          text += `MVP: ${escapeHtml(mvpPlayer.emoji)}${escapeHtml(mvpPlayer.name)}`;
        }
      }
      if (selectedBurden) {
        const burdenPlayer = findPlayerByVoteId(players, selectedBurden);
        if (burdenPlayer) {
          if (text) text += '<br>';
          text += `最闹: ${escapeHtml(burdenPlayer.emoji)}${escapeHtml(burdenPlayer.name)}`;
        }
      }

      if (text) {
        status.innerHTML = `已选择：<br>${text}<br><br>👇 点击下方确认按钮提交`;
        status.style.background = 'rgba(255, 255, 255, 0.2)'; // Reset to normal
      }
    }
  }, 200);
}

/**
 * Show end-game voting UI for viewers
 */
export function showEndGameVotingForViewers() {
  console.log('🎉 Showing end-game voting for viewers');
  unlockViewerVoting();
  
  // Calculate and display winning team MVP + teammates
  const history = state.getHistory();
  if (history.length === 0) {
    console.log('No history, skipping winner display');
    return;
  }
  
  const votingWinner = resolveVotingWinner(state.getGameStatus(), history);
  if (!votingWinner) {
    console.log('No resolved voting winner, skipping winner display');
    return;
  }

  const winningTeamKey = votingWinner.winKey;
  const winningTeamName = votingWinner.winName ||
    (winningTeamKey === 't1' ? config.getTeamName('t1') : config.getTeamName('t2'));
  const winningTeamColor = winningTeamKey === 't1' ? config.getTeamColor('t1') : config.getTeamColor('t2');
  const winningTeamNum = winningTeamKey === 't1' ? 1 : 2;
  
  const players = getPlayers();
  const playerStats = state.getPlayerStats();
  const teamPlayers = players.filter(p => normalizeTeamNumber(p.team) === winningTeamNum);
  
  console.log('Winning team:', winningTeamName, 'Players:', teamPlayers.length);
  
  // Find MVP (lowest average ranking)
  let mvpPlayer = null;
  let bestAvg = Infinity;
  
  teamPlayers.forEach(player => {
    const stats = playerStats[player.id];
    if (stats && stats.games > 0) {
      const avgRank = stats.totalRank / stats.games;
      if (avgRank < bestAvg) {
        bestAvg = avgRank;
        mvpPlayer = player;
      }
    }
  });
  
  // Create winner display section
  const votingSection = $('votingSection');
  if (votingSection && mvpPlayer) {
    let winnerDisplay = votingSection.querySelector('.winner-display');
    if (!winnerDisplay) {
      winnerDisplay = document.createElement('div');
      winnerDisplay.className = 'winner-display';
      winnerDisplay.style.cssText = 'background: #1a2e1a; border: 2px solid #22c55e; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center;';
      votingSection.insertBefore(winnerDisplay, votingSection.firstChild);
    }
    
    winnerDisplay.innerHTML = `
      <div style="color: ${winningTeamColor}; font-size: 28px; font-weight: bold; margin-bottom: 16px;">
        🎉 ${escapeHtml(winningTeamName)} 通关！
      </div>

      <div style="margin-bottom: 16px;">
        <div style="color: #fbbf24; font-weight: bold; margin-bottom: 12px; font-size: 18px;">MVP</div>
        <div style="display: flex; justify-content: center; margin-bottom: 8px;">
          ${renderProfileAvatar(mvpPlayer, 80, { marginRight: false })}
        </div>
        <div style="font-size: 20px; font-weight: bold; color: #fff; margin-bottom: 4px;">
          ${escapeHtml(mvpPlayer.name)}
        </div>
        <div style="color: #888; font-size: 14px;">
          平均 ${bestAvg.toFixed(2)} 名
        </div>
        ${mvpPlayer.tagline ? `
          <div style="font-style: italic; color: #fbbf24; margin-top: 8px;">
            "${escapeHtml(mvpPlayer.tagline)}"
          </div>
        ` : ''}
      </div>

      <div>
        <div style="color: #888; font-size: 14px; margin-bottom: 8px;">队友</div>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          ${teamPlayers.filter(p => p.id !== mvpPlayer.id).map(p => `
            <div style="text-align: center;">
              <div style="font-size: 28px; margin-bottom: 4px;">${escapeHtml(p.emoji)}</div>
              <div style="font-size: 12px; color: #888;">${escapeHtml(p.name)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
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

onEvent('state:gameStatusChanged', ({ status } = {}) => {
  if (!status?.ended) {
    activeVoteSessionKey = null;
    resetViewerVotingState();
  }
});

onEvent('game:rollback', () => {
  activeVoteSessionKey = null;
  resetViewerVotingState();
});

function resetVotingSessionState() {
  activeVoteSessionKey = null;
  resetViewerVotingState();
}

[
  'game:reset',
  'state:gameReset',
  'state:allReset'
].forEach(eventName => {
  onEvent(eventName, resetVotingSessionState);
});

onEvent('room:left', () => {
  activeVoteSessionKey = null;
  votingUnlocked = false;
});

onEvent('room:dataLoaded', ({ roomData } = {}) => {
  const roomInfo = getRoomInfo();
  if (!roomInfo.isViewer) return;

  const nextSessionKey = deriveVoteSessionKeyFromRoomData(roomData);
  if (!nextSessionKey) {
    activeVoteSessionKey = null;
    resetViewerVotingState();
    return;
  }

  const sessionChanged = activeVoteSessionKey && activeVoteSessionKey !== nextSessionKey;
  activeVoteSessionKey = nextSessionKey;

  if (sessionChanged) {
    resetViewerVotingState();
    showEndGameVotingForViewers();
  }
});

/**
 * Show vote results to viewer after voting
 */
async function showVoteResultsToViewer(votingCard) {
  const roomInfo = getRoomInfo();
  if (!roomInfo.roomCode) return;

  try {
    const response = await fetch(`/api/rooms/vote/${encodeURIComponent(roomInfo.roomCode)}`);
    const data = await readOptionalJson(response);

    if (!data.success || !data.votes) return;
    const results = normalizeVoteApiResults(data);

    const players = getPlayers();
    const mvpVotes = Object.entries(results.mvp.votes || {})
      .map(([id, count]) => ({ p: findPlayerByVoteId(players, id), count }))
      .filter(v => v.p)
      .sort((a, b) => b.count - a.count);

    const burdenVotes = Object.entries(results.burden.votes || {})
      .map(([id, count]) => ({ p: findPlayerByVoteId(players, id), count }))
      .filter(v => v.p)
      .sort((a, b) => b.count - a.count);

    // Refresh a stable results section instead of appending duplicates when
    // viewers poll, re-open, or receive multiple voting events.
    let resultsDiv = votingCard.querySelector('#viewerVoteResultsContainer, .viewer-vote-results');
    if (!resultsDiv) {
      resultsDiv = document.createElement('div');
      votingCard.appendChild(resultsDiv);
    }
    resultsDiv.className = 'viewer-vote-results';
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
          ${mvpVotes.map((v, i) => `
            <div style="padding: 10px; margin: 6px 0; background: rgba(255, 255, 255, 0.9); color: #1a1b1c; border-radius: 6px; font-size: 15px; font-weight: ${i === 0 ? 'bold' : 'normal'};">
              ${i + 1}. ${escapeHtml(v.p.emoji)}${escapeHtml(v.p.name)}: <strong style="color: #22c55e;">${v.count}票</strong>
            </div>
          `).join('') || '<div style="color: white;">暂无</div>'}
        </div>
        <div>
          <h5 style="color: white; margin-bottom: 10px; font-weight: bold;">最闹</h5>
          ${burdenVotes.map((v, i) => `
            <div style="padding: 10px; margin: 6px 0; background: rgba(255, 255, 255, 0.9); color: #1a1b1c; border-radius: 6px; font-size: 15px; font-weight: ${i === 0 ? 'bold' : 'normal'};">
              ${i + 1}. ${escapeHtml(v.p.emoji)}${escapeHtml(v.p.name)}: <strong style="color: #ef4444;">${v.count}票</strong>
            </div>
          `).join('') || '<div style="color: white;">暂无</div>'}
        </div>
      </div>
    `;

  } catch (error) {
    console.error('Error fetching vote results:', error);
  }
}

export async function updateVoteLeaderboard() {
  const roomInfo = getRoomInfo();
  if (!roomInfo.roomCode) {
    return;
  }

  try {
    const response = await fetch(`/api/rooms/vote/${encodeURIComponent(roomInfo.roomCode)}`);
    const data = await readOptionalJson(response);

    if (!data.success || !data.votes) {
      return;
    }
    const results = normalizeVoteApiResults(data);

    const players = getPlayers();


    const mvp = Object.entries(results.mvp.votes || {})
      .map(([id, count]) => ({ p: findPlayerByVoteId(players, id), count }))
      .filter(v => v.p)
      .sort((a, b) => b.count - a.count);

    const burden = Object.entries(results.burden.votes || {})
      .map(([id, count]) => ({ p: findPlayerByVoteId(players, id), count }))
      .filter(v => v.p)
      .sort((a, b) => b.count - a.count);


    const mvpDiv = document.getElementById('mvpStatsTable');
    const burdenDiv = document.getElementById('burdenStatsTable');


    if (mvpDiv) {
      const html = mvp.map((v, i) => `<div style="padding:8px;margin:4px 0;background:rgba(34,197,94,0.2);border-left:3px solid #22c55e;border-radius:4px;">${i+1}. ${escapeHtml(v.p.emoji)}${escapeHtml(v.p.name)}: <strong>${v.count}票</strong></div>`).join('') || '暂无数据';
      mvpDiv.innerHTML = html;
    }

    if (burdenDiv) {
      const html = burden.map((v, i) => `<div style="padding:8px;margin:4px 0;background:rgba(239,68,68,0.2);border-left:3px solid #ef4444;border-radius:4px;">${i+1}. ${escapeHtml(v.p.emoji)}${escapeHtml(v.p.name)}: <strong>${v.count}票</strong></div>`).join('') || '暂无数据';
      burdenDiv.innerHTML = html;
    }
  } catch (error) {
    console.error('Error updating vote leaderboard:', error);
  }
}

/**
 * Show host voting interface with results
 */
export async function showHostVoting() {
  const roomInfo = getRoomInfo();

  if (!roomInfo.isHost) return;

  const votingSection = $('votingSection');
  if (!votingSection) return;

  votingSection.hidden = false;
  votingSection.style.display = 'block';

  const results = await getEndGameVotingResults();

  const hostInterface = $('hostVotingInterface');
  if (!hostInterface) return;
  hostInterface.hidden = false;
  hostInterface.style.display = 'block';

  if (!results || !results.mvp || !results.burden) {
    hostInterface.innerHTML = '<p class="muted">暂无投票数据</p>';
    return;
  }

  const players = getPlayers();

  // Format vote results
  const mvpVotes = Object.entries(results.mvp.votes || {})
    .map(([playerId, count]) => {
      const player = findPlayerByVoteId(players, playerId);
      return { player, count };
    })
    .filter(v => v.player)
    .sort((a, b) => b.count - a.count);

  const burdenVotes = Object.entries(results.burden.votes || {})
    .map(([playerId, count]) => {
      const player = findPlayerByVoteId(players, playerId);
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
            <span style="font-size: 18px;">${escapeHtml(v.player.emoji)}</span>
            <span>${escapeHtml(v.player.name)}</span>
            <span style="float: right; color: #22c55e; font-weight: bold;">${v.count} 票</span>
          </div>
        `).join('') || '<p class="muted small">暂无投票</p>'}
      </div>

      <div>
        <h5 style="color: #ef4444;">最闹 (Burden)</h5>
        ${burdenVotes.map(v => `
          <div style="padding: 8px; margin: 5px 0; background: #2a2b2c; border-radius: 6px;">
            <span style="font-size: 18px;">${escapeHtml(v.player.emoji)}</span>
            <span>${escapeHtml(v.player.name)}</span>
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
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = '同步中...';

      const syncResult = await syncVotingToProfiles();
      if (!syncResult.success) {
        alert(`投票结果同步失败: ${syncResult.reason || 'unknown'}`);
        confirmBtn.disabled = false;
        confirmBtn.textContent = '✅ 确认并记录';
        return;
      }

      const resetSuccess = await resetVoting(roomInfo.authToken);
      if (!resetSuccess) {
        alert('投票结果已同步，但清空投票失败，请稍后重试');
        confirmBtn.disabled = false;
        confirmBtn.textContent = '✅ 确认并记录';
        return;
      }

      alert(`投票结果已确认并记录到"人民的声音"\n已同步 ${syncResult.totalPlayersSynced || 0} 位玩家`);
      await showHostVoting();
    };
  }

  if (clearBtn) {
    clearBtn.onclick = async () => {
      const success = await resetVoting(roomInfo.authToken);
      if (success) {
        alert('投票已清空');
        showHostVoting(); // Refresh
      } else {
        alert('投票清空失败');
      }
    };
  }
}

/**
 * Start live vote count polling (host only)
 */
export function stopVotePolling() {
  if (hostVotePollingInterval) {
    clearInterval(hostVotePollingInterval);
    hostVotePollingInterval = null;
  }
}

export function startVotePolling() {
  // P2 #10 fix: `isHost` was an undefined module-scoped ref; getRoomInfo() is
  // the canonical source.
  if (!getRoomInfo().isHost) {
    stopVotePolling();
    return;
  }

  stopVotePolling();

  hostVotePollingInterval = setInterval(async () => {
    if (!getRoomInfo().isHost) {
      stopVotePolling();
      return;
    }
    await showHostVoting();
  }, 1000); // Update every second
}
