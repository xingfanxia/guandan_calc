import { resolvePlayerCountMode } from '../core/playerCountMode.js';

export function resolveStatsSparklinePlayerCount(modeValue, fallbackCount = 8) {
  return resolvePlayerCountMode(modeValue, fallbackCount);
}
