const VALID_PLAYER_COUNTS = new Set([4, 6, 8]);

export function normalizePlayerCountMode(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return VALID_PLAYER_COUNTS.has(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^(4|6|8)$/.test(trimmed)) {
      return Number(trimmed);
    }
  }

  return null;
}

export function resolvePlayerCountMode(modeValue, fallbackCount = 8) {
  return normalizePlayerCountMode(modeValue) ||
    normalizePlayerCountMode(fallbackCount) ||
    8;
}

export function resolveInitialPlayerCountMode(modeValue, playersOrCount = []) {
  const loadedCount = Array.isArray(playersOrCount)
    ? playersOrCount.length
    : playersOrCount;
  const loadedMode = normalizePlayerCountMode(loadedCount);
  return loadedMode || resolvePlayerCountMode(modeValue);
}
