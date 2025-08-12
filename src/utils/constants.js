/**
 * Constants and configuration
 */

export const LEVELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const ANIMAL_EMOJIS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆',
  '🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋',
  '🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎',
  '🦖','🦕','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬',
  '🐳','🐋','🦈'
];

export const DEFAULT_SETTINGS = {
  c4: { '1,2': 3, '1,3': 2, '1,4': 1 },
  t6: { g3: 7, g2: 4, g1: 1 },
  p6: { 1: 5, 2: 4, 3: 3, 4: 3, 5: 1, 6: 0 },
  t8: { g3: 11, g2: 6, g1: 1 },
  p8: { 1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 0 },
  must1: true,
  autoNext: false,
  autoApply: true,
  strictA: true,
  t1: { name: '蓝队', color: '#3b82f6' },
  t2: { name: '红队', color: '#ef4444' }
};

export const DEFAULT_STATE = {
  t1: { lvl: '2', aFail: 0 },
  t2: { lvl: '2', aFail: 0 },
  hist: [],
  roundLevel: '2',
  nextRoundBase: null
};