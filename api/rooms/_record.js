export function parseRoomRecord(value) {
  if (value === null || value === undefined) return null;

  const parsed = typeof value === 'string'
    ? (() => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    })()
    : value;

  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed
    : null;
}
