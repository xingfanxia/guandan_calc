// Constants and configuration for Guandan Calculator
// UTF-8 encoding for Chinese characters

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'gd_v7_5_1_settings',
  STATE: 'gd_v7_5_1_state',
  PLAYERS: 'gd_players',
  PLAYER_STATS: 'gd_player_stats'
};

// Animal and food emoji pool for player avatars (insects removed)
export const ANIMAL_EMOJIS = [
  // Mammals
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐵','🐺','🐗','🐴','🦄',
  // Birds
  '🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇',
  // Marine life
  '🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈',
  // Reptiles (non-insects)
  '🐢','🐍','🦎','🦖','🦕',
  // Food emojis
  '🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒',
  '🥝','🍑','🥭','🍍','🥥','🥕','🌽','🌶️','🫒','🥑',
  '🍆','🥔','🥒','🥬','🧄','🧅','🍄','🥜','🌰',
  '🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀',
  '🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪',
  '🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🍲',
  '🫕','🥗','🍿','🧈','🥛','🍼','☕','🍵','🧃',
  '🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸',
  '🍹','🧉','🍾','🧊','🍨','🍧','🍦','🍰','🧁',
  '🥧','🍮','🍭','🍬','🍫','🍩','🍪','🌰','🥠'
];

// Default game settings
export const DEFAULT_SETTINGS = {
  // 4-player mode rules
  c4: {'1,2': 3, '1,3': 2, '1,4': 1},
  
  // 6-player mode thresholds and points
  t6: {g3: 7, g2: 4, g1: 1},
  p6: {1: 5, 2: 4, 3: 3, 4: 3, 5: 1, 6: 0},
  
  // 8-player mode thresholds and points
  t8: {g3: 11, g2: 6, g1: 1},
  p8: {1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0},
  
  // Game preferences
  must1: true,
  autoNext: true,
  autoApply: true,
  strictA: true,
  
  // Team settings
  t1: {name: '蓝队', color: '#3b82f6'},
  t2: {name: '红队', color: '#ef4444'}
};

// Default game state
export const DEFAULT_STATE = {
  t1: {lvl: '2', aFail: 0},
  t2: {lvl: '2', aFail: 0},
  hist: [],
  roundLevel: '2',
  nextRoundBase: null,
  roundOwner: null
};

// Game level progression
export const GAME_LEVELS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];