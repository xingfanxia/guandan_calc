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
  'boom_bust',
  'copy_paste',
  'rocket_jump',
  'clutch_first',
  'solo_carry',
  'front_row_streak',
  'cut_line_master',
  'late_engine',
  'no_first',
  'last_king',
  'back_row_streak'
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
  dd_opener: '救世主',
  dd_closer: '金牌保安',
  a_blocker: '香槟粉碎机',
  streak_king: '人形外挂',
  first_king: '满级人类',
  opening_flash: '开局小震撼',
  bounce_back: '医学奇迹',
  rank_rainbow: '薛定谔的牌路',
  clean_sheet: '顶级不粘锅',
  almost: '天选打工人',
  boom_bust: '牌桌蹦极人',
  copy_paste: '牌桌鬼打墙',
  rocket_jump: '油门踩断了',
  clutch_first: '热血番主角',
  solo_carry: '纯纯孤勇者',
  front_row_streak: '上流体验卡',
  cut_line_master: '及格线战神',
  late_engine: '网线终于接通',
  no_first: '全场指定玩具',
  last_king: '汗流浃背了吧',
  back_row_streak: '牢底坐穿',
  dd_night: '降维打击',
  all_firsts: '全员上嘴脸',
  foe_reset: '一键格式化',
  comeback_a: '纯爽文结局',
  finisher: '无情绝杀',
  speed_run: '光速打卡下班',
  long_night: '修仙渡劫模拟器'
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

export const HONOR_CATEGORIES = Object.freeze([
  'personal_performance',
  'personal_fun',
  'personal_roast',
  'team',
  'memorial',
  'social_vote'
]);

export const HONOR_CATEGORY_BY_KEY = Object.freeze({
  dd_opener: 'personal_performance',
  dd_closer: 'personal_performance',
  a_blocker: 'personal_performance',
  streak_king: 'personal_performance',
  first_king: 'personal_performance',
  clean_sheet: 'personal_performance',
  clutch_first: 'personal_performance',
  solo_carry: 'personal_performance',
  front_row_streak: 'personal_performance',
  late_engine: 'personal_performance',
  opening_flash: 'personal_fun',
  bounce_back: 'personal_fun',
  rank_rainbow: 'personal_fun',
  boom_bust: 'personal_fun',
  copy_paste: 'personal_fun',
  rocket_jump: 'personal_fun',
  cut_line_master: 'personal_fun',
  almost: 'personal_roast',
  no_first: 'personal_roast',
  last_king: 'personal_roast',
  back_row_streak: 'personal_roast',
  dd_night: 'team',
  all_firsts: 'team',
  foe_reset: 'team',
  comeback_a: 'team',
  finisher: 'memorial',
  speed_run: 'memorial',
  long_night: 'memorial'
});

export function honorCategoryForKey(key) {
  return HONOR_CATEGORY_BY_KEY[key] || null;
}

export function honorKeyForTitle(title) {
  const canonical = canonicalizeHonorTitle(title);
  if (!canonical) return null;
  return Object.keys(HONOR_TITLES_BY_KEY).find((key) => HONOR_TITLES_BY_KEY[key] === canonical) || null;
}

export function honorCategoryForTitle(title) {
  const key = honorKeyForTitle(title);
  return key ? honorCategoryForKey(key) : null;
}

/** 收藏成就看个人徽章 + 队伍战果；场纪念另列，不进收藏。 */
export const CURRENT_HONOR_TITLES = Object.freeze(
  [...PERSONAL_HONOR_KEYS, ...TEAM_HONOR_KEYS].map(key => HONOR_TITLES_BY_KEY[key])
);
export const CURRENT_HONOR_COUNT = CURRENT_HONOR_TITLES.length;
export const MEMORIAL_TITLES = Object.freeze(MEMORIAL_KEYS.map(key => HONOR_TITLES_BY_KEY[key]));
export const ALL_HONOR_TITLES = Object.freeze([...CURRENT_HONOR_TITLES, ...MEMORIAL_TITLES]);

/** honor_10 的 key 为兼容存档保留，但 v2 的可达目标显式固定为 8，禁止跟数组长度联动。 */
export const HONOR_ALL_TARGET = 8;
export const HONOR_STORAGE_VERSION = 'honor-abstract-v1';

export const LEGACY_HONOR_TITLE_ALIASES = Object.freeze({
  开门手: '救世主',
  开团大爹: '救世主',
  关门手: '金牌保安',
  拦路虎: '香槟粉碎机',
  火车头: '人形外挂',
  头游王: '满级人类',
  开局红: '开局小震撼',
  触底反弹: '医学奇迹',
  百变牌路: '薛定谔的牌路',
  不倒翁: '顶级不粘锅',
  棋差一着: '天选打工人',
  大开大合: '牌桌蹦极人',
  复制粘贴: '牌桌鬼打墙',
  坐火箭: '油门踩断了',
  压哨头游: '热血番主角',
  热血番男主: '热血番主角',
  '独苗 C 位': '纯纯孤勇者',
  前排钉子户: '上流体验卡',
  卡线大师: '及格线战神',
  后程发动机: '网线终于接通',
  头游体验卡未到账: '全场指定玩具',
  末游打卡王: '汗流浃背了吧',
  后排钉子户: '牢底坐穿',
  双下之夜: '降维打击',
  人人开花: '全员上嘴脸',
  打回原形: '一键格式化',
  绝境翻盘: '纯爽文结局',
  通关手: '无情绝杀',
  速通之夜: '光速打卡下班',
  鏖战之夜: '修仙渡劫模拟器',
  赌徒: '牌桌蹦极人',
  连段王: '人形外挂',
  连胜王: '人形外挂',
  吕布: '满级人类'
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

/**
 * 持久化迁移与读时 normalize 分离：正式 honors 只留下现行 title 和真正退役项，
 * alias 原始计数移入只读 archive。这样重复迁移幂等，也不会在下一次读取时再次相加。
 */
export function migrateHonorStorage(honors = {}, legacyArchive = {}) {
  const raw = honors && typeof honors === 'object' && !Array.isArray(honors) ? honors : {};
  const previousArchive = legacyArchive && typeof legacyArchive === 'object' && !Array.isArray(legacyArchive)
    ? legacyArchive
    : {};
  const migrated = {};
  const archive = {};

  for (const [title, value] of Object.entries(previousArchive)) {
    if (!title || UNSAFE_COUNTER_KEYS.has(title.toLowerCase())) continue;
    const count = safeCount(value);
    if (count > 0) archive[title] = count;
  }
  for (const [title, value] of Object.entries(raw)) {
    if (!title || UNSAFE_COUNTER_KEYS.has(title.toLowerCase())) continue;
    const count = safeCount(value);
    if (Object.prototype.hasOwnProperty.call(LEGACY_HONOR_TITLE_ALIASES, title)) {
      const currentTitle = LEGACY_HONOR_TITLE_ALIASES[title];
      migrated[currentTitle] = safeCount(migrated[currentTitle]) + count;
      if (count > 0) archive[title] = Math.max(safeCount(archive[title]), count);
      continue;
    }
    migrated[title] = safeCount(migrated[title]) + count;
  }

  return { version: HONOR_STORAGE_VERSION, honors: migrated, legacyArchive: archive };
}

export function migrateHonorTitles(titles = []) {
  return [...new Set((Array.isArray(titles) ? titles : []).flatMap((title) => {
    const raw = typeof title === 'string' ? title.trim() : '';
    if (!raw || UNSAFE_COUNTER_KEYS.has(raw.toLowerCase())) return [];
    return [canonicalizeHonorTitle(raw) || raw];
  }))];
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
