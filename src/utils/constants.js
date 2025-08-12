/**
 * Application constants
 */

export const STORAGE_KEYS = {
  SETTINGS: 'guandanSettings',
  STATE: 'guandanState',
  PLAYERS: 'guandanPlayers'
};

export const LEVELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const DEFAULT_SETTINGS = {
  autoNext: true,
  autoApply: true,
  strictA: true,
  must1: true,
  teamNames: {
    A: '蓝队',
    B: '红队'
  },
  teamColors: {
    A: '#3b82f6',
    B: '#ef4444'
  }
};

export const GAME_RULES = {
  6: {
    thresholds: { g3: 7, g2: 4, g1: 1 },
    points: { 1: 5, 2: 4, 3: 3, 4: 3, 5: 1, 6: 0 }
  },
  8: {
    thresholds: { g3: 11, g2: 6, g1: 1 },
    points: { 1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0 }
  }
};