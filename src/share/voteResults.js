function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function normalizeVotePlayerId(value) {
  if (Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) return null;

  const id = Number(normalized);
  return Number.isSafeInteger(id) ? String(id) : null;
}

export function findPlayerByVoteId(players, value) {
  const normalizedPlayerId = normalizeVotePlayerId(value);
  if (!normalizedPlayerId || !Array.isArray(players)) return null;

  return players.find(player => normalizeVotePlayerId(player?.id) === normalizedPlayerId) || null;
}

function extractVoteMap(value) {
  const objectValue = plainObject(value);
  const voteMap = plainObject(objectValue.votes || objectValue);

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

function normalizeFingerprints(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(fingerprint => typeof fingerprint === 'string' && fingerprint.length > 0);
}

export function normalizeVoteApiResults(payload) {
  const source = plainObject(payload?.votes || payload);

  return {
    mvp: {
      votes: extractVoteMap(source.mvp)
    },
    burden: {
      votes: extractVoteMap(source.burden)
    },
    fingerprints: normalizeFingerprints(source.fingerprints)
  };
}
