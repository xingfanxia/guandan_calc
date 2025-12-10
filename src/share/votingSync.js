/**
 * Voting Results Sync to Player Profiles
 * Syncs community voting results to player career stats
 */

import { updatePlayerStats } from '../api/playerApi.js';
import { getPlayers } from '../player/playerManager.js';
import { getRoomInfo } from './roomManager.js';

/**
 * Sync voting results to player profiles
 * Gets top-voted MVP and burden from API and updates their profiles
 */
export async function syncVotingToProfiles() {
  const roomInfo = getRoomInfo();

  if (!roomInfo.roomCode) {
    console.log('No room code - skipping voting sync');
    return { success: false, reason: 'no_room' };
  }

  try {
    // Fetch voting results from API
    const response = await fetch(`/api/rooms/vote/${roomInfo.roomCode}`);
    const data = await response.json();

    if (!data.success || !data.votes) {
      console.log('No voting data available');
      return { success: false, reason: 'no_votes' };
    }

    const players = getPlayers();

    // Find top-voted MVP
    let mvpId = null;
    let maxMVP = 0;
    Object.entries(data.votes.mvp || {}).forEach(([playerId, count]) => {
      if (count > maxMVP) {
        maxMVP = count;
        mvpId = parseInt(playerId);
      }
    });

    // Find top-voted burden
    let burdenId = null;
    let maxBurden = 0;
    Object.entries(data.votes.burden || {}).forEach(([playerId, count]) => {
      if (count > maxBurden) {
        maxBurden = count;
        burdenId = parseInt(playerId);
      }
    });

    console.log('Syncing voting results:', { mvpId, maxMVP, burdenId, maxBurden });

    // Update profiles for voted players
    const updates = [];

    if (mvpId) {
      const mvpPlayer = players.find(p => p.id === mvpId);
      if (mvpPlayer && mvpPlayer.handle) {
        const update = updatePlayerStats(mvpPlayer.handle, {
          votedMVP: true,
          votedBurden: false,
          roomCode: roomInfo.roomCode,
          ranking: 0,  // Not used for voting-only update
          team: mvpPlayer.team,
          teamWon: false,
          gamesInSession: 0,
          mode: 'VOTE_ONLY'
        });
        updates.push(update);
        console.log(`✅ Syncing MVP vote for @${mvpPlayer.handle}`);
      }
    }

    if (burdenId) {
      const burdenPlayer = players.find(p => p.id === burdenId);
      if (burdenPlayer && burdenPlayer.handle) {
        const update = updatePlayerStats(burdenPlayer.handle, {
          votedMVP: false,
          votedBurden: true,
          roomCode: roomInfo.roomCode,
          ranking: 0,
          team: burdenPlayer.team,
          teamWon: false,
          gamesInSession: 0,
          mode: 'VOTE_ONLY'
        });
        updates.push(update);
        console.log(`✅ Syncing burden vote for @${burdenPlayer.handle}`);
      }
    }

    await Promise.all(updates);

    return {
      success: true,
      mvpPlayer: players.find(p => p.id === mvpId),
      burdenPlayer: players.find(p => p.id === burdenId),
      mvpVotes: maxMVP,
      burdenVotes: maxBurden
    };

  } catch (error) {
    console.error('Error syncing voting results:', error);
    return { success: false, reason: 'error', error };
  }
}

/**
 * Schedule automatic voting sync 5 minutes after game ends
 */
export function scheduleAutoVotingSync() {
  console.log('⏲️ Auto voting sync scheduled for 5 minutes');

  setTimeout(async () => {
    console.log('⏲️ Auto-syncing voting results...');
    const result = await syncVotingToProfiles();

    if (result.success) {
      console.log('✅ Auto-sync complete:', result);
    } else {
      console.log('❌ Auto-sync failed:', result.reason);
    }
  }, 5 * 60 * 1000); // 5 minutes
}
