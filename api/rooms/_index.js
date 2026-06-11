function normalizeRoomIndexEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  if (typeof entry.roomCode !== 'string') return null;

  const roomCode = entry.roomCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(roomCode)) return null;

  return {
    ...entry,
    roomCode
  };
}

export function parseRoomIndex(value) {
  const entries = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return entries.map(normalizeRoomIndexEntry).filter(Boolean);
}

export function addRoomIndexEntry(indexValue, entry, limit = 100) {
  const rooms = parseRoomIndex(indexValue);
  const normalizedEntry = normalizeRoomIndexEntry(entry);
  if (!normalizedEntry) return rooms.slice(0, limit);

  if (rooms.find(room => room.roomCode === normalizedEntry.roomCode)) {
    return rooms.slice(0, limit);
  }

  return [normalizedEntry, ...rooms].slice(0, limit);
}
