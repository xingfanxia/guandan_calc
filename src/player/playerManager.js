/**
 * Player Manager - Player Data Management
 * Extracted from app.js lines 161-183, 602-658, 815-830
 * Manages player generation, team assignment, and player data
 */

import state from '../core/state.js';
import { emit } from '../core/events.js';
import { touchPlayer } from '../api/playerApi.js';

// 77+ animal and food emoji avatars (no insects)
const ANIMAL_EMOJIS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆',
  '🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋',
  '🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎',
  '🦖','🦕','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬',
  '🐳','🐋','🦈','🍎','🍊','🍋','🍌','🍉','🍇','🍓',
  '🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑',
  '🥦','🥬','🥒','🌶','🌽','🥕','🧄','🧅','🥔','🍠'
];

// Export for use in other modules
export { ANIMAL_EMOJIS };

/**
 * Generate players for the game
 * @param {number} count - Number of players (4, 6, or 8)
 * @param {boolean} forceNew - Force generation of new players
 * @returns {Object[]} Array of player objects
 */
export function generatePlayers(count, forceNew = false) {
  const num = parseInt(count);

  if (!num || isNaN(num) || num < 4 || num > 8) {
    console.error('Invalid player count:', count);
    return state.getPlayers();
  }

  let players = [];

  // Try to load saved players first (unless forcing new generation)
  if (!forceNew) {
    const savedPlayers = state.getPlayers();
    if (savedPlayers && savedPlayers.length === num) {
      players = savedPlayers;

      // Ensure proper data format
      players.forEach((player, index) => {
        if (!player.id || typeof player.id === 'string') {
          player.id = index + 1;
        }

        // Normalize team values (1, 2, or null)
        if (player.team === 'A') {
          player.team = 1;
        } else if (player.team === 'B') {
          player.team = 2;
        } else if (![1, 2, null].includes(player.team)) {
          player.team = null;
        }
      });

      state.setPlayers(players);
      return players;
    }

    // If no saved players and not forcing new, return empty array (use player search instead)
    console.log('No existing players - start with empty pool (use player search to add)');
    state.setPlayers([]);
    return [];
  }

  // Generate new players (only when forceNew = true)
  players = [];

  // Shuffle emojis for variety
  const shuffledEmojis = ANIMAL_EMOJIS.slice().sort(() => Math.random() - 0.5);

  for (let i = 0; i < num; i++) {
    const player = {
      id: i + 1,  // Numeric ID (1-indexed)
      name: `玩家${i + 1}`,
      emoji: shuffledEmojis[i % shuffledEmojis.length],
      team: null  // Start unassigned
    };
    players.push(player);
  }

  // Save to state
  state.setPlayers(players);

  // Clear current ranking when changing player count
  state.setCurrentRanking({});

  emit('player:generated', { players, count: num });

  return players;
}

/**
 * Get all players
 * @returns {Object[]} Array of player objects (copy)
 */
export function getPlayers() {
  return state.getPlayers();
}

/**
 * Add player from profile
 * Creates a session player linked to a profile
 * @param {Object} profile - Player profile from API
 * @returns {Object} Created player object
 */
export function addPlayerFromProfile(profile) {
  const players = state.getPlayers();
  
  // Check if player already added
  const existing = players.find(p => p.handle === profile.handle);
  if (existing) {
    console.warn(`Player @${profile.handle} already added`);
    return existing;
  }

  // Get next available ID
  const nextId = players.length > 0 
    ? Math.max(...players.map(p => p.id)) + 1 
    : 1;

  // Create player object with profile data
  const player = {
    id: nextId,
    name: profile.displayName,     // Use displayName from profile
    emoji: profile.emoji,
    team: null,                     // Start unassigned
    handle: profile.handle,         // Link to profile
    playerId: profile.id,          // For stats updates
    playStyle: profile.playStyle,  // From profile
    tagline: profile.tagline,       // For victory screen
    photoBase64: profile.photoBase64  // Profile photo (optional)
  };

  // Add to players array
  players.push(player);
  state.setPlayers(players);

  // Update lastActiveAt timestamp (non-blocking)
  if (profile.handle) {
    touchPlayer(profile.handle).catch(err => {
      console.warn('Failed to update lastActiveAt:', err);
    });
  }

  emit('player:addedFromProfile', { player, profile });

  return player;
}

/**
 * Remove player from game
 * @param {number} playerId - Player ID to remove
 * @returns {boolean} Success
 */
export function removePlayer(playerId) {
  const players = state.getPlayers();
  const index = players.findIndex(p => p.id === playerId);
  
  if (index === -1) {
    console.warn(`Player ${playerId} not found`);
    return false;
  }

  // Remove player
  const removed = players.splice(index, 1)[0];
  state.setPlayers(players);

  // Clear from ranking if assigned
  const ranking = state.getCurrentRanking();
  Object.keys(ranking).forEach(pos => {
    if (ranking[pos] === playerId) {
      delete ranking[pos];
    }
  });
  state.setCurrentRanking(ranking);

  emit('player:removed', { player: removed });

  return true;
}

/**
 * Get player by ID
 * @param {number} playerId - Player ID
 * @returns {Object|null} Player object or null
 */
export function getPlayerById(playerId) {
  const players = state.getPlayers();
  return players.find(p => p.id === playerId) || null;
}

/**
 * Update player data
 * @param {number} playerId - Player ID
 * @param {Object} updates - Properties to update
 */
export function updatePlayer(playerId, updates) {
  const players = state.getPlayers();
  const player = players.find(p => p.id === playerId);

  if (!player) {
    console.error('Player not found:', playerId);
    return;
  }

  Object.assign(player, updates);
  state.setPlayers(players);

  emit('player:updated', { playerId, updates });
}

/**
 * Assign player to team
 * @param {number} playerId - Player ID
 * @param {number|null} team - Team number (1, 2, or null for unassigned)
 */
export function assignPlayerToTeam(playerId, team) {
  if (team !== null && team !== 1 && team !== 2) {
    console.error('Invalid team:', team);
    return;
  }

  updatePlayer(playerId, { team });
  emit('player:teamAssigned', { playerId, team });
}

/**
 * Shuffle players into random teams
 * @param {number} mode - Game mode (4, 6, or 8)
 */
export function shuffleTeams(mode) {
  const num = parseInt(mode);
  const halfSize = num / 2;

  const players = state.getPlayers();

  // Shuffle players
  const shuffled = players.slice().sort(() => Math.random() - 0.5);

  // Assign to teams
  shuffled.forEach((player, index) => {
    player.team = index < halfSize ? 1 : 2;
  });

  state.setPlayers(shuffled);

  emit('player:teamsShuffled', { players: shuffled });
}

/**
 * Apply bulk player names
 * @param {string} namesString - Space-separated names
 * @returns {boolean} Success
 */
export function applyBulkNames(namesString) {
  if (!namesString || !namesString.trim()) {
    return false;
  }

  const names = namesString.trim().split(/\s+/);
  const players = state.getPlayers();

  if (names.length !== players.length) {
    console.warn(`Expected ${players.length} names, got ${names.length}`);
    return false;
  }

  players.forEach((player, index) => {
    if (names[index]) {
      player.name = names[index];
    }
  });

  state.setPlayers(players);

  emit('player:bulkNamesApplied', { names });

  return true;
}

/**
 * Get team size limit for current mode
 * @param {number} mode - Game mode
 * @returns {number} Max players per team
 */
export function getTeamSizeLimit(mode) {
  return parseInt(mode) / 2;
}

/**
 * Check if team is full
 * @param {number} teamNum - Team number (1 or 2)
 * @param {number} mode - Game mode
 * @returns {boolean} True if team is full
 */
export function isTeamFull(teamNum, mode) {
  const players = state.getPlayers();
  const teamPlayers = players.filter(p => p.team === teamNum);
  const maxPerTeam = getTeamSizeLimit(mode);

  return teamPlayers.length >= maxPerTeam;
}

/**
 * Get players by team
 * @param {number|null} teamNum - Team number (1, 2, or null for unassigned)
 * @returns {Object[]} Array of players
 */
export function getPlayersByTeam(teamNum) {
  const players = state.getPlayers();
  return players.filter(p => p.team === teamNum);
}

/**
 * Check if all players are assigned to teams
 * @returns {boolean} True if all assigned
 */
export function areAllPlayersAssigned() {
  const players = state.getPlayers();
  return players.every(p => p.team !== null);
}
