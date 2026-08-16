export const PERSONAL_HONOR_KEYS = Object.freeze([
  'dd_opener',
  'dd_closer',
  'a_blocker',
  'streak_king',
  'first_king',
  'opening_flash',
  'bounce_back',
  'rank_rainbow',
  'clean_sheet',
  'almost',
  'boom_bust'
]);

export const TEAM_HONOR_KEYS = Object.freeze([
  'dd_night',
  'all_firsts',
  'foe_reset',
  'comeback_a'
]);

export const MEMORIAL_KEYS = Object.freeze([
  'finisher',
  'speed_run',
  'long_night'
]);

export const HONOR_V2_TITLES_BY_KEY = Object.freeze({
  dd_opener: '开门手',
  dd_closer: '关门手',
  a_blocker: '拦路虎',
  streak_king: '火车头',
  first_king: '头游王',
  opening_flash: '开局红',
  bounce_back: '触底反弹',
  rank_rainbow: '百变牌路',
  clean_sheet: '不倒翁',
  almost: '棋差一着',
  boom_bust: '大开大合',
  dd_night: '双下之夜',
  all_firsts: '人人开花',
  foe_reset: '打回原形',
  comeback_a: '绝境翻盘',
  finisher: '通关手',
  speed_run: '速通之夜',
  long_night: '鏖战之夜'
});

/** HONOR-1 接线前供旧 web / 小程序海报继续渲染原 16 项，避免纯内核提交改变线上展示。 */
export const LEGACY_HONOR_TITLES_BY_KEY = Object.freeze({
  mvp: '吕布',
  burden: '阿斗',
  stable: '石佛',
  rollercoaster: '波动王',
  comeback: '奋斗王',
  fanche: '翻车王',
  gambler: '赌徒',
  complete: '大满贯',
  streak: '连段王',
  median: '团队中轴',
  carp: '逆转核心',
  nonstick: '保底核心',
  frequent: '节奏核心',
  burnout: '燃尽王',
  almost: '棋差一着',
  resilient: '抗压王'
});

export const HONOR_TITLES_BY_KEY = Object.freeze({
  ...LEGACY_HONOR_TITLES_BY_KEY,
  ...HONOR_V2_TITLES_BY_KEY
});

/** 收藏成就看个人徽章 + 队伍战果；场纪念另列，不进收藏。 */
export const CURRENT_HONOR_TITLES = Object.freeze(
  [...PERSONAL_HONOR_KEYS, ...TEAM_HONOR_KEYS].map(key => HONOR_TITLES_BY_KEY[key])
);
export const CURRENT_HONOR_COUNT = CURRENT_HONOR_TITLES.length;
export const MEMORIAL_TITLES = Object.freeze(MEMORIAL_KEYS.map(key => HONOR_TITLES_BY_KEY[key]));
export const ALL_HONOR_TITLES = Object.freeze([...CURRENT_HONOR_TITLES, ...MEMORIAL_TITLES]);

/** honor_10 的 key 为兼容存档保留，但 v2 的可达目标显式固定为 8，禁止跟数组长度联动。 */
export const HONOR_ALL_TARGET = 8;

export const LEGACY_HONOR_TITLE_ALIASES = Object.freeze({
  赌徒: '大开大合',
  连段王: '火车头',
  连胜王: '火车头',
  吕布: '头游王'
});

const UNSAFE_COUNTER_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const safeCount = value => {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
};

export function createHonorCounter() {
  return Object.fromEntries(ALL_HONOR_TITLES.map(title => [title, 0]));
}

/**
 * 读取时把 legacy M:1 单跳并入现行 title，同时保留所有旧 title 的裸计数。
 * 保留是数据安全边界：历史荣誉有 12 项已退役，调用方即使误把结果持久化，也不能抹掉它们。
 */
export function normalizeHonorCounter(honors = {}) {
  const raw = honors && typeof honors === 'object' && !Array.isArray(honors) ? honors : {};
  const normalized = createHonorCounter();

  for (const [title, value] of Object.entries(raw)) {
    if (!title || UNSAFE_COUNTER_KEYS.has(title.toLowerCase())) continue;
    normalized[title] = safeCount(value);
  }

  const aliasTotals = {};
  for (const [legacyTitle, currentTitle] of Object.entries(LEGACY_HONOR_TITLE_ALIASES)) {
    aliasTotals[currentTitle] = safeCount(aliasTotals[currentTitle]) + safeCount(raw[legacyTitle]);
  }
  for (const [currentTitle, aliasTotal] of Object.entries(aliasTotals)) {
    normalized[currentTitle] = safeCount(raw[currentTitle]) + aliasTotal;
  }

  return normalized;
}

export function canonicalizeHonorTitle(title) {
  if (typeof title !== 'string') return null;
  if (ALL_HONOR_TITLES.includes(title)) return title;
  return Object.prototype.hasOwnProperty.call(LEGACY_HONOR_TITLE_ALIASES, title)
    ? LEGACY_HONOR_TITLE_ALIASES[title]
    : null;
}

export function countCurrentHonors(honors = {}) {
  return CURRENT_HONOR_TITLES.filter(title => safeCount(honors[title]) > 0).length;
}
