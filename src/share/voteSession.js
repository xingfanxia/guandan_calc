import { deriveVoteSessionKey } from '../../shared/voteSessionKey.js';

export { deriveVoteSessionKey };

const VOTED_ROOMS_KEY = 'gd_voted_rooms';
const MAX_STORED_VOTE_SESSIONS = 200;

function safeParseObject(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeGetItem(storage, key) {
  try {
    return storage?.getItem?.(key) || null;
  } catch {
    return null;
  }
}

function safeSetItem(storage, key, value) {
  try {
    if (!storage?.setItem) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readVotedSessions(storage = globalThis.localStorage) {
  const raw = safeParseObject(safeGetItem(storage, VOTED_ROOMS_KEY));
  const source = raw.sessions && typeof raw.sessions === 'object' && !Array.isArray(raw.sessions)
    ? raw.sessions
    : raw;

  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => value === true && String(key).includes(':vote:'))
  );
}

export function hasAlreadyVotedInSession(storage = globalThis.localStorage, voteSessionKey) {
  if (!voteSessionKey) return false;
  return readVotedSessions(storage)[voteSessionKey] === true;
}

export function markVotedInSession(storage = globalThis.localStorage, voteSessionKey) {
  if (!voteSessionKey || !storage) return false;

  const sessions = readVotedSessions(storage);
  sessions[voteSessionKey] = true;

  const prunedSessions = Object.fromEntries(
    Object.entries(sessions).slice(-MAX_STORED_VOTE_SESSIONS)
  );

  return safeSetItem(storage, VOTED_ROOMS_KEY, JSON.stringify({
    sessions: prunedSessions,
    updatedAt: new Date().toISOString()
  }));
}
