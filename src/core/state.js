/**
 * Game State Manager (Singleton Pattern)
 * Extracted from app.js lines 133-159
 * Single source of truth for all game state
 */

import { load, save, KEYS } from './storage.js';
import { emit } from './events.js';
import { resolveGameStatus } from '../../shared/gameStatus.js';
import { isValidRoomSnapshotPayload } from '../../shared/roomSnapshotValidation.js';

function clonePlainData(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

const VALID_LEVELS = new Set(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']);
const VALID_TEAM_KEYS = new Set(['t1', 't2']);

function normalizeLevel(value) {
  const normalized = String(value);
  return VALID_LEVELS.has(normalized) ? normalized : null;
}

function normalizeOptionalLevel(value) {
  if (value === undefined || value === null) return null;
  return normalizeLevel(value);
}

function isValidTeamKey(value) {
  return VALID_TEAM_KEYS.has(value);
}

function normalizeAFail(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 && count <= 2 ? count : null;
}

function normalizePlayerTeam(team) {
  if (team === undefined || team === null) return null;
  if (team === 1 || team === 2) return team;
  if (typeof team === 'string') {
    const trimmed = team.trim();
    if (trimmed === '1' || trimmed === 'A') return 1;
    if (trimmed === '2' || trimmed === 'B') return 2;
  }
  // Preserve unknown values so validation can reject malformed snapshots.
  return team;
}

function normalizePlayerId(id) {
  if (Number.isSafeInteger(id) && id > 0) return id;
  if (typeof id === 'string') {
    const trimmed = id.trim();
    if (/^[1-9]\d*$/.test(trimmed)) {
      const numericId = Number(trimmed);
      if (Number.isSafeInteger(numericId)) return numericId;
    }
  }
  // Preserve unknown values so validation can reject malformed snapshots.
  return id;
}

function normalizePlayerRecord(player) {
  if (player === null || typeof player !== 'object' || Array.isArray(player)) {
    return player;
  }

  return {
    ...player,
    id: normalizePlayerId(player.id),
    team: normalizePlayerTeam(player.team)
  };
}

function normalizePlayers(players) {
  return clonePlainData(players).map(normalizePlayerRecord);
}

function normalizePlayersForValidation(players) {
  if (!Array.isArray(players)) return players;
  return normalizePlayers(players);
}

function pruneRankingForPlayers(ranking, players) {
  if (!ranking || typeof ranking !== 'object' || Array.isArray(ranking)) return {};
  if (!Array.isArray(players) || players.length === 0) return {};

  const playerIds = new Set(players.map(player => player.id));
  const maxRank = Math.min(players.length, 8);
  const seen = new Set();
  const pruned = {};

  for (const [rankKey, playerId] of Object.entries(ranking)) {
    const rank = Number(rankKey);
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > maxRank) continue;
    if (!Number.isSafeInteger(playerId) || !playerIds.has(playerId) || seen.has(playerId)) continue;
    pruned[rankKey] = playerId;
    seen.add(playerId);
  }

  return pruned;
}

function plainDataEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validatePlayersPayload(players) {
  return isValidRoomSnapshotPayload({ players: normalizePlayersForValidation(players) });
}

function validatePlayerStatsPayload(players, playerStats) {
  return isValidRoomSnapshotPayload({
    players: normalizePlayersForValidation(players),
    playerStats
  });
}

function validateCurrentRankingPayload(players, currentRanking) {
  return isValidRoomSnapshotPayload({
    players: normalizePlayersForValidation(players),
    currentRanking
  });
}

function validateHistoryPayload(history) {
  return isValidRoomSnapshotPayload({ state: { history } });
}

// Singleton instance
let instance = null;

class GameState {
  constructor() {
    // Enforce singleton
    if (instance) {
      return instance;
    }

    // Initialize state
    this.teams = {
      t1: { lvl: '2', aFail: 0 },
      t2: { lvl: '2', aFail: 0 }
    };

    this.roundLevel = '2';
    this.roundOwner = null;
    this.nextRoundBase = null;
    this.gameStatus = {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    };
    this.history = [];
    this.winner = 't1';

    // Players state (managed separately but stored together)
    this.players = [];
    this.playerStats = {};
    this.currentRanking = {};
    
    // Session timing
    this.sessionStartTime = null;

    instance = this;
  }

  /**
   * Hydrate state from localStorage. Idempotent — safe to call multiple times,
   * but skips re-hydration if state has already been loaded (prevents clobbering
   * in-flight mutations from late module init).
   */
  hydrate() {
    if (this._hydrated) return;
    this._hydrated = true;

    const savedState = load(KEYS.STATE, null);
    const savedPlayers = load(KEYS.PLAYERS, []);
    const savedStats = load(KEYS.STATS, {});

    if (isValidRoomSnapshotPayload({ state: savedState })) {
      this.teams = savedState.teams
        ? {
          t1: {
            lvl: normalizeLevel(savedState.teams.t1.lvl) || '2',
            aFail: normalizeAFail(savedState.teams.t1.aFail ?? 0) ?? 0
          },
          t2: {
            lvl: normalizeLevel(savedState.teams.t2.lvl) || '2',
            aFail: normalizeAFail(savedState.teams.t2.aFail ?? 0) ?? 0
          }
        }
        : this.teams;
      this.roundLevel = normalizeLevel(savedState.roundLevel ?? '2') || '2';
      this.roundOwner = savedState.roundOwner ?? null;
      this.history = Array.isArray(savedState.history)
        ? JSON.parse(JSON.stringify(savedState.history))
        : [];
      this.gameStatus = resolveGameStatus(savedState.gameStatus, this.history);
      this.nextRoundBase = this.gameStatus.ended
        ? null
        : normalizeOptionalLevel(savedState.nextRoundBase);
      this.winner = this.gameStatus.ended && isValidTeamKey(this.gameStatus.winnerKey)
        ? this.gameStatus.winnerKey
        : (isValidTeamKey(savedState.winner) ? savedState.winner : 't1');
    }

    // Load players separately. These are persisted outside KEYS.STATE, so they
    // must be validated separately before becoming room-sync source data.
    this.players = validatePlayersPayload(savedPlayers)
      ? normalizePlayers(savedPlayers)
      : [];
    this.playerStats = validatePlayerStatsPayload(this.players, savedStats)
      ? clonePlainData(savedStats)
      : {};

    emit('state:hydrated');
  }

  /**
   * Persist state to localStorage
   */
  persist() {
    const stateData = {
      teams: this.teams,
      roundLevel: this.roundLevel,
      roundOwner: this.roundOwner,
      nextRoundBase: this.nextRoundBase,
      gameStatus: this.gameStatus,
      history: this.history,
      winner: this.winner
    };

    save(KEYS.STATE, stateData);

    // Save players and stats separately
    save(KEYS.PLAYERS, this.players);
    save(KEYS.STATS, this.playerStats);

    emit('state:persisted');
  }

  // ===========================
  // Team Getters
  // ===========================

  getTeam(teamKey) {
    return this.teams[teamKey] ? clonePlainData(this.teams[teamKey]) : undefined;
  }

  getTeamLevel(teamKey) {
    return this.teams[teamKey]?.lvl || '2';
  }

  getTeamAFail(teamKey) {
    return this.teams[teamKey]?.aFail || 0;
  }

  getWinner() {
    return this.winner;
  }

  // ===========================
  // Team Setters
  // ===========================

  setTeamLevel(teamKey, level) {
    if (!isValidTeamKey(teamKey)) {
      throw new Error(`Invalid team key: ${teamKey}`);
    }

    const normalizedLevel = normalizeLevel(level);
    if (!normalizedLevel) {
      throw new Error(`Invalid team level: ${level}`);
    }

    this.teams[teamKey].lvl = normalizedLevel;
    this.persist();
    emit('state:teamLevelChanged', { team: teamKey, level: normalizedLevel });
  }

  setTeamAFail(teamKey, count) {
    if (!isValidTeamKey(teamKey)) {
      throw new Error(`Invalid team key: ${teamKey}`);
    }

    const normalizedCount = normalizeAFail(count);
    if (normalizedCount === null) {
      throw new Error(`Invalid A-fail count: ${count}`);
    }

    this.teams[teamKey].aFail = normalizedCount;
    this.persist();
    emit('state:teamAFailChanged', { team: teamKey, count: normalizedCount });
  }

  setWinner(teamKey) {
    if (!['t1', 't2'].includes(teamKey)) {
      throw new Error(`Invalid team key: ${teamKey}`);
    }

    this.winner = teamKey;
    this.persist();
    emit('state:winnerChanged', { winner: teamKey });
  }

  // ===========================
  // Round Management
  // ===========================

  getRoundLevel() {
    return this.roundLevel;
  }

  setRoundLevel(level) {
    const normalizedLevel = normalizeLevel(level);
    if (!normalizedLevel) {
      throw new Error(`Invalid round level: ${level}`);
    }

    this.roundLevel = normalizedLevel;
    this.persist();
    emit('state:roundLevelChanged', { level: normalizedLevel });
  }

  getRoundOwner() {
    return this.roundOwner;
  }

  setRoundOwner(teamKey) {
    if (teamKey !== null && !isValidTeamKey(teamKey)) {
      throw new Error(`Invalid round owner: ${teamKey}`);
    }

    this.roundOwner = teamKey;
    this.persist();
    emit('state:roundOwnerChanged', { owner: teamKey });
  }

  getNextRoundBase() {
    return this.nextRoundBase;
  }

  setNextRoundBase(level) {
    if (level !== null) {
      const normalizedLevel = normalizeLevel(level);
      if (!normalizedLevel) {
        throw new Error(`Invalid next round base: ${level}`);
      }
      this.nextRoundBase = normalizedLevel;
    } else {
      this.nextRoundBase = null;
    }
    this.persist();
    emit('state:nextRoundBaseChanged', { level: this.nextRoundBase });
  }

  getGameStatus() {
    return JSON.parse(JSON.stringify(this.gameStatus));
  }

  setGameStatus(status) {
    if (status?.ended !== undefined && typeof status.ended !== 'boolean') {
      throw new Error('Invalid game status: ended must be a boolean');
    }

    const ended = status?.ended === true;
    const winnerKey = ended ? (status?.winnerKey || null) : null;
    const winnerName = ended ? (status?.winnerName || null) : null;
    const reason = ended ? (status?.reason || null) : null;

    if (winnerKey !== null && !isValidTeamKey(winnerKey)) {
      throw new Error('Invalid game status: winnerKey must be t1, t2, or null');
    }
    if (ended && !winnerKey) {
      throw new Error('Invalid game status: ended status requires a winner key');
    }
    if (winnerName !== null && typeof winnerName !== 'string') {
      throw new Error('Invalid game status: winnerName must be a string or null');
    }
    if (reason !== null && typeof reason !== 'string') {
      throw new Error('Invalid game status: reason must be a string or null');
    }

    const nextRoundBaseChanged = ended && this.nextRoundBase !== null;
    if (nextRoundBaseChanged) {
      this.nextRoundBase = null;
    }
    const winnerChanged = ended && winnerKey && this.winner !== winnerKey;
    if (winnerChanged) {
      this.winner = winnerKey;
    }

    this.gameStatus = {
      ended,
      winnerKey,
      winnerName,
      reason
    };
    this.persist();
    if (winnerChanged) {
      emit('state:winnerChanged', { winner: winnerKey });
    }
    if (nextRoundBaseChanged) {
      emit('state:nextRoundBaseChanged', { level: null });
    }
    emit('state:gameStatusChanged', { status: this.getGameStatus() });
  }

  clearGameStatus() {
    this.setGameStatus({
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    });
  }

  // ===========================
  // History Management
  // ===========================

  getHistory() {
    return clonePlainData(this.history);
  }

  addHistoryEntry(entry) {
    const nextHistory = [...this.history, entry];
    if (!validateHistoryPayload(nextHistory)) {
      throw new Error('Invalid history entry');
    }

    // Deep clone to break reference sharing with callers — prevents external
    // mutation of a stored entry from corrupting rollback snapshots.
    this.history.push(JSON.parse(JSON.stringify(entry)));
    this.persist();
    emit('state:historyAdded', { entry });
  }

  rollbackToIndex(index) {
    if (index < 0 || index >= this.history.length) {
      throw new Error(`Invalid history index: ${index}`);
    }

    this.history = this.history.slice(0, index);
    this.persist();
    emit('state:historyRolledBack', { index });
  }

  clearHistory() {
    this.history = [];
    this.persist();
    emit('state:historyCleared');
  }

  /**
   * Set entire history array (for room sync)
   * @param {Array} historyArray - Complete history array
   */
  setHistory(historyArray) {
    const nextHistory = historyArray || [];
    if (!validateHistoryPayload(nextHistory)) {
      throw new Error('Invalid history');
    }

    // Deep clone to detach from caller's reference (room-sync payload, etc.)
    this.history = JSON.parse(JSON.stringify(nextHistory));
    this.persist();
    emit('state:historySet', { historyArray });
  }

  // ===========================
  // Players Management
  // ===========================

  getPlayers() {
    return clonePlainData(this.players);
  }

  setPlayers(players) {
    const nextPlayers = players || [];
    if (!validatePlayersPayload(nextPlayers)) {
      throw new Error('Invalid players');
    }

    const normalizedPlayers = normalizePlayers(nextPlayers);
    const nextRanking = pruneRankingForPlayers(this.currentRanking, normalizedPlayers);
    const rankingChanged = !plainDataEqual(this.currentRanking, nextRanking);
    this.players = normalizedPlayers;
    this.currentRanking = nextRanking;
    this.persist();
    emit('state:playersChanged', { players: this.getPlayers() });
    if (rankingChanged) {
      emit('state:currentRankingChanged', { ranking: this.getCurrentRanking() });
    }
  }

  getPlayerStats() {
    // Deep clone — the shallow `{ ...this.playerStats }` would still allow
    // callers to mutate nested per-player records (e.g., `stats[id].rankings.push(...)`),
    // which leaked into the source of truth. JSON round-trip is the cheapest deep
    // clone that handles the plain-data shape stats use; structuredClone would also
    // work but JSON is well-supported and the hot path is post-game (not per-frame).
    return JSON.parse(JSON.stringify(this.playerStats));
  }

  setPlayerStats(stats) {
    const nextStats = stats || {};
    if (!validatePlayerStatsPayload(this.players, nextStats)) {
      throw new Error('Invalid player stats');
    }

    this.playerStats = clonePlainData(nextStats);
    this.persist();
    emit('state:playerStatsChanged', { stats });
  }

  getCurrentRanking() {
    return clonePlainData(this.currentRanking);
  }

  /**
   * True when a game has started — at least one completed round in history OR
   * any rank placed in the current round. Single source of truth for the
   * "blank vs in-progress" distinction used by the room gate, setup-section
   * visibility, and the create-room reset confirm.
   */
  isGameInProgress() {
    if (Array.isArray(this.history) && this.history.length > 0) return true;
    const ranking = this.currentRanking || {};
    for (const k in ranking) {
      if (ranking[k] != null) return true;
    }
    return false;
  }

  setCurrentRanking(ranking) {
    const nextRanking = ranking || {};
    if (!validateCurrentRankingPayload(this.players, nextRanking)) {
      throw new Error('Invalid current ranking');
    }

    this.currentRanking = clonePlainData(nextRanking);
    // Note: Don't persist ranking (temporary state)
    emit('state:currentRankingChanged', { ranking });
  }

  // ===========================
  // Session Timing
  // ===========================

  getSessionStartTime() {
    return this.sessionStartTime;
  }

  setSessionStartTime(timestamp) {
    this.sessionStartTime = timestamp;
    // Don't persist - session timing is per-session only
  }

  getSessionDuration() {
    if (!this.sessionStartTime) return 0;
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);  // seconds
  }

  // ===========================
  // Reset Functions
  // ===========================

  resetGame() {
    this.teams = {
      t1: { lvl: '2', aFail: 0 },
      t2: { lvl: '2', aFail: 0 }
    };
    this.roundLevel = '2';
    this.roundOwner = null;
    this.nextRoundBase = null;
    this.gameStatus = {
      ended: false,
      winnerKey: null,
      winnerName: null,
      reason: null
    };
    this.history = [];
    this.winner = 't1';
    this.currentRanking = {};

    this.persist();
    emit('state:gameReset');
  }

  resetAll() {
    this.resetGame();
    this.players = [];
    this.playerStats = {};

    this.persist();
    emit('state:allReset');
  }
}

// Create and export singleton instance
const gameState = new GameState();
export default gameState;
