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

    console.log('Syncing ALL voting results to profiles');

    // Update profiles for ALL players who received votes
    const updates = [];

    // Sync all MVP votes
    Object.entries(data.votes.mvp || {}).forEach(([playerId, voteCount]) => {
      if (voteCount > 0) {
        const player = players.find(p => p.id === parseInt(playerId));
        if (player && player.handle) {
          const update = updatePlayerStats(player.handle, {
            votedMVP: true,
            votedBurden: false,
            mvpVoteCount: voteCount,  // Actual vote count
            roomCode: roomInfo.roomCode,
            ranking: 0,
            team: player.team,
            teamWon: false,
            gamesInSession: 0,
            mode: 'VOTE_ONLY'
          });
          updates.push(update);
          console.log(`✅ Syncing ${voteCount} MVP votes for @${player.handle}`);
        }
      }
    });

    // Sync all burden votes
    Object.entries(data.votes.burden || {}).forEach(([playerId, voteCount]) => {
      if (voteCount > 0) {
        const player = players.find(p => p.id === parseInt(playerId));
        if (player && player.handle) {
          // Check if already updated as MVP (same player)
          const alreadyUpdated = updates.find(u => 
            u.then && player.handle === players.find(p => p.id === parseInt(playerId))?.handle
          );
          
          if (alreadyUpdated) {
            console.log(`⚠️ ${player.name} received both MVP and burden votes - skipping burden`);
          } else {
            const update = updatePlayerStats(player.handle, {
              votedMVP: false,
              votedBurden: true,
              burdenVoteCount: voteCount,  // Actual vote count
              roomCode: roomInfo.roomCode,
              ranking: 0,
              team: player.team,
              teamWon: false,
              gamesInSession: 0,
              mode: 'VOTE_ONLY'
            });
            updates.push(update);
            console.log(`✅ Syncing ${voteCount} burden votes for @${player.handle}`);
          }
        }
      }
    });

    await Promise.all(updates);

    // Find top voted for return message
    const topMVP = Object.entries(data.votes.mvp || {})
      .sort((a, b) => b[1] - a[1])[0];
    const topBurden = Object.entries(data.votes.burden || {})
      .sort((a, b) => b[1] - a[1])[0];

    const mvpPlayer = topMVP ? players.find(p => p.id === parseInt(topMVP[0])) : null;
    const burdenPlayer = topBurden ? players.find(p => p.id === parseInt(topBurden[0])) : null;

    return {
      success: true,
      mvpPlayer: mvpPlayer,
      burdenPlayer: burdenPlayer,
      mvpVotes: topMVP ? topMVP[1] : 0,
      burdenVotes: topBurden ? topBurden[1] : 0,
      totalPlayersSynced: updates.length
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
