import { getHistoryEntries, resolveGameStatus } from '../../shared/gameStatus.js';

const ROOM_TTL_SECONDS = 31536000;
export const VOTE_FINGERPRINT_CAP = 1000;
const FINGERPRINT_MAX_LENGTH = 128;

export function isValidRoomCode(roomCode) {
  return typeof roomCode === 'string' && /^[A-Z0-9]{6}$/.test(roomCode);
}

function normalizeVotePlayerId(value) {
  if (Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) return null;

  const id = Number(normalized);
  return Number.isSafeInteger(id) ? String(id) : null;
}

function normalizeVoteMap(voteMap) {
  if (!voteMap || typeof voteMap !== 'object' || Array.isArray(voteMap)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(voteMap)
      .map(([playerId, voteCount]) => {
        const normalizedPlayerId = normalizeVotePlayerId(playerId);
        const normalizedVoteCount = Number(voteCount);
        if (
          !normalizedPlayerId ||
          !Number.isSafeInteger(normalizedVoteCount) ||
          normalizedVoteCount <= 0
        ) {
          return null;
        }
        return [normalizedPlayerId, normalizedVoteCount];
      })
      .filter(Boolean)
  );
}

export function normalizeVoteFingerprint(fingerprint) {
  if (typeof fingerprint !== 'string') return null;

  const normalized = fingerprint.trim();
  if (normalized.length === 0 || normalized.length > FINGERPRINT_MAX_LENGTH) {
    return null;
  }
  return normalized;
}

function normalizeFingerprints(fingerprints) {
  if (!Array.isArray(fingerprints)) return [];
  return fingerprints
    .map(normalizeVoteFingerprint)
    .filter(Boolean)
    .slice(-VOTE_FINGERPRINT_CAP);
}

export function normalizeVoteStore(votes) {
  return {
    mvp: normalizeVoteMap(votes?.mvp),
    burden: normalizeVoteMap(votes?.burden),
    fingerprints: normalizeFingerprints(votes?.fingerprints)
  };
}

export function publicVoteStore(votes) {
  const normalized = normalizeVoteStore(votes);
  return {
    mvp: normalized.mvp,
    burden: normalized.burden
  };
}

export function publicVoteStoreForRoom(room) {
  if (!roomVotingIsOpen(room)) {
    return { mvp: {}, burden: {} };
  }

  return publicVoteStore(room?.endGameVotes);
}

export async function saveRoomWithFavoriteTtl(kvClient, roomCode, room) {
  const value = JSON.stringify({
    ...room,
    roomCode
  });
  if (room?.isFavorite) {
    await kvClient.set(`room:${roomCode}`, value);
    return;
  }

  await kvClient.setex(`room:${roomCode}`, ROOM_TTL_SECONDS, value);
}

function roomVotingIsOpen(room) {
  const history = getHistoryEntries(room?.state);
  const gameStatus = resolveGameStatus(room?.state?.gameStatus, history);
  return Boolean(gameStatus.ended && gameStatus.winnerKey);
}

export function validateVotePayload(room, { mvpPlayerId, burdenPlayerId, fingerprint }) {
  const normalizedMvp = normalizeVotePlayerId(mvpPlayerId);
  const normalizedBurden = normalizeVotePlayerId(burdenPlayerId);
  const normalizedFingerprint = normalizeVoteFingerprint(fingerprint);

  if (!normalizedMvp || !normalizedBurden) {
    return { ok: false, status: 400, error: 'Missing player IDs' };
  }

  if (normalizedMvp === normalizedBurden) {
    return { ok: false, status: 400, error: 'same_person' };
  }

  if (!normalizedFingerprint) {
    return { ok: false, status: 400, error: 'invalid_fingerprint' };
  }

  if (!roomVotingIsOpen(room)) {
    return { ok: false, status: 409, error: 'voting_not_open' };
  }

  const roomPlayers = Array.isArray(room?.players) ? room.players : [];
  const validPlayerIds = new Set(
    roomPlayers
      .map(player => normalizeVotePlayerId(player?.id))
      .filter(Boolean)
  );
  if (!validPlayerIds.has(normalizedMvp) || !validPlayerIds.has(normalizedBurden)) {
    return { ok: false, status: 400, error: 'invalid_player' };
  }

  return {
    ok: true,
    mvpPlayerId: normalizedMvp,
    burdenPlayerId: normalizedBurden,
    fingerprint: normalizedFingerprint
  };
}
