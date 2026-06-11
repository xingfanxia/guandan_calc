import { resolveGameStatus } from '../../shared/gameStatus.js';
import { parseRoomRecord } from './_record.js';

function normalizeRoomCode(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
}

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePlayerHandleCandidate(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'session') return null;
  if (normalized.length < 3 || normalized.length > 20) return null;
  if (!/^[a-z0-9_]+$/.test(normalized)) return null;
  if (['__proto__', 'prototype', 'constructor'].includes(normalized)) return null;
  return normalized;
}

function getPlayerHandle(player) {
  return normalizePlayerHandleCandidate(player?.handle) ||
    normalizePlayerHandleCandidate(player?.profileHandle);
}

function parseRoomData(roomData) {
  return parseRoomRecord(roomData) || {};
}

function getHistory(state = {}) {
  const normalizedState = asRecord(state);
  return Array.isArray(normalizedState.history)
    ? normalizedState.history
    : asArray(normalizedState.hist);
}

function getTeamNames(settings = {}) {
  const normalizedSettings = asRecord(settings);
  if (Array.isArray(normalizedSettings.teamNames)) {
    return [...new Set(normalizedSettings.teamNames.map(normalizeString).filter(Boolean))];
  }

  const names = [
    normalizedSettings.t1?.name,
    normalizedSettings.t2?.name,
    normalizedSettings.team1Name,
    normalizedSettings.team2Name,
    normalizedSettings.team3Name,
    normalizedSettings.team4Name
  ].map(normalizeString).filter(Boolean);

  return [...new Set(names)];
}

function getPlayerHandles(players = []) {
  return asArray(players)
    .map(getPlayerHandle)
    .filter(Boolean);
}

function getCurrentRound(state = {}, isFinished = false) {
  const normalizedState = asRecord(state);
  const explicitRound = Number(normalizedState.roundNumber);
  if (Number.isSafeInteger(explicitRound) && explicitRound > 0) {
    return explicitRound;
  }

  const completedRounds = getHistory(normalizedState).length;
  return Math.max(1, completedRounds + (isFinished ? 0 : 1));
}

function completedStatusText(gameStatus, isFinished) {
  if (!isFinished) return 'LIVE';
  const winnerName = normalizeString(gameStatus?.winnerName);
  return winnerName ? `${winnerName}通关` : 'FINISHED';
}

export function summarizeRoomForList(roomData, fallback = {}) {
  const parsed = parseRoomData(roomData);
  const state = asRecord(parsed.state);
  const history = getHistory(state);
  const gameStatus = resolveGameStatus(state.gameStatus, history);
  const hasExplicitGameStatus = state.gameStatus &&
    typeof state.gameStatus === 'object' &&
    Object.prototype.hasOwnProperty.call(state.gameStatus, 'ended');
  const isFinished = Boolean(
    gameStatus.ended ||
    (!hasExplicitGameStatus && (state.gameEnded || parsed.finishedAt))
  );
  const fallbackRoomCode = normalizeRoomCode(fallback.roomCode);
  const roomCode = fallbackRoomCode || normalizeRoomCode(parsed.roomCode);

  return {
    roomCode,
    createdAt: parsed.createdAt || fallback.createdAt || null,
    lastUpdated: parsed.lastUpdated || fallback.lastUpdated || fallback.favoritedAt || null,
    isFavorite: Boolean(parsed.isFavorite || fallback.isFavorite),
    playerCount: asArray(parsed.players).length,
    playerHandles: getPlayerHandles(parsed.players),
    currentRound: getCurrentRound(state, isFinished),
    isFinished,
    winnerKey: isFinished ? gameStatus.winnerKey || null : null,
    winnerName: isFinished ? normalizeString(gameStatus.winnerName) : null,
    statusText: completedStatusText(gameStatus, isFinished),
    teamNames: getTeamNames(parsed.settings)
  };
}

export function buildFavoriteIndexEntry(roomData, favoritedAt, fallback = {}) {
  const parsed = parseRoomData(roomData);
  const summary = summarizeRoomForList(parsed, {
    ...fallback,
    isFavorite: true,
    favoritedAt
  });
  const history = getHistory(parsed.state);

  return {
    ...summary,
    favoritedAt,
    isFavorite: true,
    gameCount: Array.isArray(history) ? history.length : 0
  };
}
