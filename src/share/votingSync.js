/**
 * Voting Results Sync to Player Profiles
 * Syncs community voting results to player career stats
 */

import { getPlayerProfileHandle, updatePlayerStats } from '../api/playerApi.js';
import { getPlayers } from '../player/playerManager.js';
import { readOptionalJsonResponse as readOptionalJson } from '../api/httpResponse.js';
import { getRoomInfo } from './roomManager.js';
import { findPlayerByVoteId, normalizeVoteApiResults } from './voteResults.js';

export function summarizeVoteProfileUpdateResults(updateResults) {
  const results = Array.isArray(updateResults) ? updateResults : [];
  const totalPlayersSynced = results.filter(result => result?.success).length;
  const failedPlayers = results.length - totalPlayersSynced;

  if (failedPlayers === 0) {
    return {
      success: true,
      totalPlayersSynced,
      failedPlayers
    };
  }

  return {
    success: false,
    reason: totalPlayersSynced === 0
      ? 'profile_update_failed'
      : 'partial_profile_update_failed',
    totalPlayersSynced,
    failedPlayers
  };
}

export function buildPlayerVoteTotals(votePayload) {
  const results = normalizeVoteApiResults(votePayload);
  const playerVotes = {};

  Object.entries(results.mvp.votes || {}).forEach(([playerId, voteCount]) => {
    playerVotes[playerId] = playerVotes[playerId] || { mvp: 0, burden: 0 };
    playerVotes[playerId].mvp = voteCount;
  });

  Object.entries(results.burden.votes || {}).forEach(([playerId, voteCount]) => {
    playerVotes[playerId] = playerVotes[playerId] || { mvp: 0, burden: 0 };
    playerVotes[playerId].burden = voteCount;
  });

  return playerVotes;
}

/**
 * Sync voting results to player profiles
 * Gets top-voted MVP and burden from API and updates their profiles
 */
export async function syncVotingToProfiles({
  roomInfo = getRoomInfo(),
  players = getPlayers()
} = {}) {
  const syncRoomInfo = roomInfo || {};
  const syncPlayers = Array.isArray(players) ? players : [];

  if (!syncRoomInfo.roomCode) {
    console.log('No room code - skipping voting sync');
    return { success: false, reason: 'no_room' };
  }

  try {
    // Fetch voting results from API
    const response = await fetch(`/api/rooms/vote/${encodeURIComponent(syncRoomInfo.roomCode)}`);
    const data = await readOptionalJson(response);

    if (!data.success || !data.votes) {
      console.log('No voting data available');
      return { success: false, reason: 'no_votes' };
    }

    console.log('Syncing ALL voting results to profiles');

    // Build per-player vote totals BEFORE issuing updates so a player who got
    // both MVP and burden votes gets BOTH credited in a single PUT.
    // Previously the burden-sync loop skipped any player already synced for MVP,
    // silently dropping their burden votes.
    const playerVotes = buildPlayerVoteTotals(data);
    if (Object.keys(playerVotes).length === 0) {
      console.log('No voting totals available');
      return { success: false, reason: 'no_votes' };
    }

    // Host-only auth: viewers see authToken === null and the server will 403
    // their writes, which is correct (only the host should sync vote-derived
    // stats). C-1 fix relies on this — see api/players/[handle].js auth gate.
    const roomAuthToken = syncRoomInfo.authToken || null;

    const updates = [];
    Object.entries(playerVotes).forEach(([playerId, votes]) => {
      const player = findPlayerByVoteId(syncPlayers, playerId);
      const playerHandle = getPlayerProfileHandle(player);
      if (playerHandle) {
        const update = updatePlayerStats(playerHandle, {
          votedMVP: votes.mvp > 0,
          votedBurden: votes.burden > 0,
          mvpVoteCount: votes.mvp,
          burdenVoteCount: votes.burden,
          roomCode: syncRoomInfo.roomCode,
          ranking: 0,
          team: player.team,
          teamWon: false,
          gamesInSession: 0,
          mode: 'VOTE_ONLY'
        }, roomAuthToken);
        updates.push(update);
        console.log(`✅ Syncing votes for @${playerHandle}: MVP=${votes.mvp}, burden=${votes.burden}`);
      }
    });

    const updateResults = await Promise.all(updates);
    const syncSummary = summarizeVoteProfileUpdateResults(updateResults);

    // Find top voted for return message
    const topMVP = Object.entries(playerVotes)
      .filter(([, votes]) => votes.mvp > 0)
      .map(([playerId, votes]) => [playerId, votes.mvp])
      .sort((a, b) => b[1] - a[1])[0];
    const topBurden = Object.entries(playerVotes)
      .filter(([, votes]) => votes.burden > 0)
      .map(([playerId, votes]) => [playerId, votes.burden])
      .sort((a, b) => b[1] - a[1])[0];

    const mvpPlayer = topMVP ? findPlayerByVoteId(syncPlayers, topMVP[0]) : null;
    const burdenPlayer = topBurden ? findPlayerByVoteId(syncPlayers, topBurden[0]) : null;

    return {
      ...syncSummary,
      mvpPlayer: mvpPlayer,
      burdenPlayer: burdenPlayer,
      mvpVotes: topMVP ? topMVP[1] : 0,
      burdenVotes: topBurden ? topBurden[1] : 0
    };

  } catch (error) {
    console.error('Error syncing voting results:', error);
    return { success: false, reason: 'error', error };
  }
}

/**
 * Schedule automatic voting sync 5 minutes after game ends
 */
export function scheduleAutoVotingSync({
  roomInfo = getRoomInfo(),
  players = getPlayers()
} = {}) {
  const capturedRoomInfo = roomInfo ? { ...roomInfo } : {};
  const capturedPlayers = Array.isArray(players)
    ? players.map(player => ({ ...player }))
    : [];

  console.log('⏲️ Auto voting sync scheduled for 5 minutes');

  setTimeout(async () => {
    console.log('⏲️ Auto-syncing voting results...');
    const result = await syncVotingToProfiles({
      roomInfo: capturedRoomInfo,
      players: capturedPlayers
    });

    if (result.success) {
      console.log('✅ Auto-sync complete:', result);
    } else {
      console.log('❌ Auto-sync failed:', result.reason);
    }
  }, 5 * 60 * 1000); // 5 minutes
}
