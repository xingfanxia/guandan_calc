import { countCurrentHonors, normalizeHonorCounter } from './honorCatalog.js';

const UNSAFE_RELATION_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const safeCount = (value) => Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));
const safeRatio = (value, target) => target > 0 ? Math.min(1, safeCount(value) / target) : 0;
const percent = (...ratios) => Math.round(Math.min(...ratios) * 100);

export const ACHIEVEMENT_SCHEMA_VERSION = 'career-trophies-v2';

export const ACHIEVEMENT_TIERS = Object.freeze({
  bronze: { label: '青铜奖杯', shortLabel: '青铜', order: 1 },
  silver: { label: '白银奖杯', shortLabel: '白银', order: 2 },
  gold: { label: '黄金奖杯', shortLabel: '黄金', order: 3 },
  platinum: { label: '白金奖杯', shortLabel: '白金', order: 4 }
});

/** 生涯成就只描述难以一次偶然完成的长期目标；单场奇观和可重复事件属于荣誉。 */
export const ACHIEVEMENTS = Object.freeze({
  career_20: { name: '正式入编', tier: 'bronze', badgeKey: 'career_20', desc: '累计参与 20 场正式牌局，并记录 200 个小局' },
  all_modes_1: { name: '三栖牌手', tier: 'bronze', badgeKey: 'all_modes_1', desc: '4 人、6 人和 8 人局各完成至少 1 场' },
  win_streak_3: { name: '状态启动', tier: 'bronze', badgeKey: 'win_streak_3', desc: '生涯最长通关连胜达到 3 场' },
  honors_12: { name: '荣誉收割机', tier: 'bronze', badgeKey: 'honors_12', desc: '解锁 12 种不同荣誉' },
  career_500: { name: '牌桌常驻人口', tier: 'silver', badgeKey: 'career_500', desc: '累计记录 500 个小局，并跨越 30 个打牌日' },
  win_streak_5: { name: '五连制霸', tier: 'silver', badgeKey: 'win_streak_5', desc: '生涯最长通关连胜达到 5 场' },
  relations_15: { name: '牌圈显眼包', tier: 'silver', badgeKey: 'relations_15', desc: '与至少 15 位不同牌友同桌' },
  all_modes_3: { name: '全模式毕业', tier: 'silver', badgeKey: 'all_modes_3', desc: '4 人、6 人和 8 人局各完成至少 3 场' },
  win_streak_8: { name: '八连无人区', tier: 'gold', badgeKey: 'win_streak_8', desc: '生涯最长通关连胜达到 8 场' },
  rank_gold: { name: '黄金时代', tier: 'gold', badgeKey: 'rank_gold', desc: '生涯最高 NaoRank 达到黄金段（1000 分）' },
  mvp_10: { name: '民选牌桌之光', tier: 'gold', badgeKey: 'mvp_10', desc: '累计获得 10 张同桌匿名 MVP 票' },
  career_1000: { name: '千局不灭', tier: 'gold', badgeKey: 'career_1000', desc: '累计记录 1000 个小局，并跨越 50 个打牌日' },
  naoma_platinum: { name: '闹麻全满贯', tier: 'platinum', badgeKey: 'naoma_platinum', desc: '解锁其余全部 12 项生涯奖杯' }
});

/** 1.0.34 及更早的低门槛/单场成就：仅用于识别并丢弃旧派生值。 */
export const LEGACY_ACHIEVEMENTS = Object.freeze({
  newbie: { name: '初来乍到' }, started: { name: '小试牛刀' }, veteran: { name: '百战老兵' },
  legend: { name: '千场传奇' }, first_win: { name: '首胜' }, streak_5: { name: '连胜达人' },
  streak_10: { name: '十连胜' }, champion: { name: '常胜将军' }, honor_5: { name: '荣誉猎手' },
  honor_10: { name: '荣誉收藏家' }, honor_all: { name: '全荣誉大师' }, lubu_10: { name: '满级人类常客' },
  social_butterfly: { name: '社交蝴蝶' }, marathon: { name: '马拉松战士' }, quick_finish: { name: '闪电战' },
  perfect: { name: '完美表现' }, unlucky: { name: '天选之子' }
});

export const ACHIEVEMENT_COUNT = Object.keys(ACHIEVEMENTS).length;

function relationKeyIsSafe(key) {
  return typeof key === 'string' && key.trim().length > 0 && !UNSAFE_RELATION_KEYS.has(key.trim().toLowerCase());
}

function relationHasGames(value) {
  return value && typeof value === 'object' && safeCount(value.games) > 0;
}

function relationEntries(value) {
  if (Array.isArray(value)) {
    return value.flatMap((row) => {
      const key = String(row?.handle || '').trim().toLowerCase();
      return relationKeyIsSafe(key) && relationHasGames(row) ? [[key, row]] : [];
    });
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([rawKey, row]) => {
    const key = String(rawKey).trim().toLowerCase();
    return relationKeyIsSafe(key) && relationHasGames(row) ? [[key, row]] : [];
  });
}

export function countDistinctProfileRelations(playerStats = {}) {
  const source = playerStats.relations && typeof playerStats.relations === 'object' ? playerStats.relations : playerStats;
  const handles = new Set();
  for (const kind of ['partners', 'opponents']) {
    for (const [handle] of relationEntries(source[kind])) handles.add(handle);
  }
  return handles.size;
}

function metricsFor(playerStats = {}) {
  const mode = playerStats.modeBreakdown || {};
  const ladder = playerStats.ladder && typeof playerStats.ladder === 'object' ? playerStats.ladder : {};
  return {
    matches: safeCount(playerStats.matchesTotal ?? playerStats.sessionsPlayed ?? playerStats.gamesPlayed),
    hands: safeCount(playerStats.totalGames ?? playerStats.progress?.hands),
    days: safeCount(playerStats.gameDays ?? playerStats.progress?.nights),
    streak: safeCount(playerStats.longestWinStreak),
    mvpVotes: safeCount(playerStats.mvpVotes),
    honors: countCurrentHonors(normalizeHonorCounter(playerStats.honors || {})),
    relations: countDistinctProfileRelations(playerStats),
    mode4: safeCount(mode['4P']), mode6: safeCount(mode['6P']), mode8: safeCount(mode['8P']),
    ladderPeak: safeCount(ladder.peak ?? ladder.rating ?? playerStats.ladderPeak)
  };
}

function baseProgress(playerStats = {}) {
  const m = metricsFor(playerStats);
  const modeMin = Math.min(m.mode4, m.mode6, m.mode8);
  return [
    { id: 'career_20', unlocked: m.matches >= 20 && m.hands >= 200,
      progressPct: percent(safeRatio(m.matches, 20), safeRatio(m.hands, 200)),
      progressText: `正式牌局 ${Math.min(m.matches, 20)}/20 · 小局 ${Math.min(m.hands, 200)}/200` },
    { id: 'all_modes_1', unlocked: modeMin >= 1,
      progressPct: percent(safeRatio(modeMin, 1)), progressText: `已完成模式 ${[m.mode4, m.mode6, m.mode8].filter((value) => value >= 1).length}/3` },
    { id: 'win_streak_3', unlocked: m.streak >= 3,
      progressPct: percent(safeRatio(m.streak, 3)), progressText: `最长连胜 ${Math.min(m.streak, 3)}/3` },
    { id: 'honors_12', unlocked: m.honors >= 12,
      progressPct: percent(safeRatio(m.honors, 12)), progressText: `不同荣誉 ${Math.min(m.honors, 12)}/12` },
    { id: 'career_500', unlocked: m.hands >= 500 && m.days >= 30,
      progressPct: percent(safeRatio(m.hands, 500), safeRatio(m.days, 30)),
      progressText: `小局 ${Math.min(m.hands, 500)}/500 · 打牌日 ${Math.min(m.days, 30)}/30` },
    { id: 'win_streak_5', unlocked: m.streak >= 5,
      progressPct: percent(safeRatio(m.streak, 5)), progressText: `最长连胜 ${Math.min(m.streak, 5)}/5` },
    { id: 'relations_15', unlocked: m.relations >= 15,
      progressPct: percent(safeRatio(m.relations, 15)), progressText: `不同牌友 ${Math.min(m.relations, 15)}/15` },
    { id: 'all_modes_3', unlocked: modeMin >= 3,
      progressPct: percent(safeRatio(modeMin, 3)), progressText: `各模式最低完成 ${Math.min(modeMin, 3)}/3 场` },
    { id: 'win_streak_8', unlocked: m.streak >= 8,
      progressPct: percent(safeRatio(m.streak, 8)), progressText: `最长连胜 ${Math.min(m.streak, 8)}/8` },
    { id: 'rank_gold', unlocked: m.ladderPeak >= 1000,
      progressPct: percent(safeRatio(Math.max(0, m.ladderPeak - 400), 600)), progressText: `最高 NaoRank ${Math.min(m.ladderPeak, 1000)}/1000` },
    { id: 'mvp_10', unlocked: m.mvpVotes >= 10,
      progressPct: percent(safeRatio(m.mvpVotes, 10)), progressText: `累计 MVP 票 ${Math.min(m.mvpVotes, 10)}/10` },
    { id: 'career_1000', unlocked: m.hands >= 1000 && m.days >= 50,
      progressPct: percent(safeRatio(m.hands, 1000), safeRatio(m.days, 50)),
      progressText: `小局 ${Math.min(m.hands, 1000)}/1000 · 打牌日 ${Math.min(m.days, 50)}/50` }
  ];
}

export function achievementProgress(playerStats = {}) {
  const base = baseProgress(playerStats).map((row) => ({ ...ACHIEVEMENTS[row.id], ...row }));
  const unlockedPrerequisites = base.filter((row) => row.unlocked).length;
  return [...base, {
    ...ACHIEVEMENTS.naoma_platinum,
    id: 'naoma_platinum',
    unlocked: unlockedPrerequisites === base.length,
    progressPct: Math.round(unlockedPrerequisites * 100 / base.length),
    progressText: `已解锁 ${unlockedPrerequisites}/${base.length} 项前置奖杯`
  }];
}

export function checkAchievements(playerStats = {}) {
  return achievementProgress(playerStats).filter((row) => row.unlocked).map((row) => row.id);
}

const cleanIds = (ids) => [...new Set((Array.isArray(ids) ? ids : [])
  .map((id) => String(id || '').trim()).filter((id) => /^[A-Za-z0-9_]{1,64}$/.test(id)))];

export function migrateAchievementStorage(achievementsEver = [], legacyArchive = []) {
  const active = new Set(Object.keys(ACHIEVEMENTS));
  const current = cleanIds(achievementsEver);
  return {
    version: ACHIEVEMENT_SCHEMA_VERSION,
    achievementsEver: current.filter((id) => active.has(id)),
    // 旧版成就是可重算的派生值，不是权威牌局事实；V2 上线后直接取消，不保留影子奖杯。
    legacyArchive: []
  };
}

export function getNewAchievements(oldAchievements = [], newAchievements = []) {
  const oldAchievementSet = new Set(cleanIds(oldAchievements));
  return cleanIds(newAchievements).filter((id) => !oldAchievementSet.has(id));
}
