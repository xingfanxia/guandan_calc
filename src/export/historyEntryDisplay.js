import config from '../core/config.js';
import { isClearingANote } from '../game/gameStatus.js';

const VALID_TEAM_KEYS = new Set(['t1', 't2']);

function normalizeTeamKey(value) {
  return VALID_TEAM_KEYS.has(value) ? value : null;
}

function normalizeDisplayName(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function getHistoryWinnerKey(entry) {
  if (entry?.gameStatus?.ended) {
    const statusWinnerKey = normalizeTeamKey(entry.gameStatus.winnerKey);
    if (statusWinnerKey) return statusWinnerKey;
  }

  return normalizeTeamKey(entry?.winKey);
}

export function getHistoryWinnerName(entry) {
  if (entry?.gameStatus?.ended) {
    const statusWinnerName = normalizeDisplayName(entry.gameStatus.winnerName);
    if (statusWinnerName) return statusWinnerName;
  }

  const legacyWinnerName = normalizeDisplayName(entry?.win);
  if (legacyWinnerName) return legacyWinnerName;

  const winnerKey = getHistoryWinnerKey(entry);
  return winnerKey ? config.getTeamName(winnerKey) : '胜方';
}

export function isVictoryEntry(entry) {
  if (!entry) return false;
  if (entry.gameStatus?.ended) return true;
  return isClearingANote(entry.aNote);
}
