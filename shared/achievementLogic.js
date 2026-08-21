import {
  CURRENT_HONOR_TITLES,
  HONOR_TITLES_BY_KEY,
  countCurrentHonors,
  honorCategoryForTitle,
  normalizeHonorCounter
} from './honorCatalog.js';

const UNSAFE_RELATION_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const achievementSafeCount = (value) => Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));
const safeRatio = (value, target) => target > 0 ? Math.min(1, achievementSafeCount(value) / target) : 0;
const percent = (...ratios) => Math.round(Math.min(...ratios) * 100);

export const ACHIEVEMENT_SCHEMA_VERSION = 'career-trophies-v3';

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
  highlight_5: { name: '高光起步', tier: 'bronze', badgeKey: 'highlight_5', desc: '优秀表现类荣誉累计达到 5 次' },
  highlight_10: { name: '稳定上镜', tier: 'bronze', badgeKey: 'highlight_10', desc: '优秀表现类荣誉累计达到 10 次' },
  career_500: { name: '牌桌常驻人口', tier: 'silver', badgeKey: 'career_500', desc: '累计记录 500 个小局，并跨越 30 个打牌日' },
  win_streak_5: { name: '五连制霸', tier: 'silver', badgeKey: 'win_streak_5', desc: '生涯最长通关连胜达到 5 场' },
  relations_15: { name: '牌圈显眼包', tier: 'silver', badgeKey: 'relations_15', desc: '与至少 15 位不同牌友同桌' },
  all_modes_3: { name: '全模式毕业', tier: 'silver', badgeKey: 'all_modes_3', desc: '4 人、6 人和 8 人局各完成至少 3 场' },
  highlight_20: { name: '集锦常驻', tier: 'silver', badgeKey: 'highlight_20', desc: '优秀表现类荣誉累计达到 20 次' },
  highlight_50: { name: '牌桌显卡', tier: 'silver', badgeKey: 'highlight_50', desc: '优秀表现类荣誉累计达到 50 次' },
  comeback_10: { name: '棺材板压不住', tier: 'silver', badgeKey: 'comeback_10', desc: '在 10 场牌局获得「医学奇迹」' },
  clean_sheet_10: { name: '锅都追不上', tier: 'silver', badgeKey: 'clean_sheet_10', desc: '在 10 场牌局获得「顶级不粘锅」' },
  roast_honors_50: { name: '公开处刑常驻嘉宾', tier: 'silver', badgeKey: 'roast_honors_50', desc: '自嘲类荣誉累计达到 50 次' },
  win_streak_8: { name: '八连无人区', tier: 'gold', badgeKey: 'win_streak_8', desc: '生涯最长通关连胜达到 8 场' },
  rank_gold: { name: '黄金时代', tier: 'gold', badgeKey: 'rank_gold', desc: '生涯最高 NaoRank 达到黄金段（1000 分）' },
  mvp_10: { name: '民选牌桌之光', tier: 'gold', badgeKey: 'mvp_10', desc: '累计获得 10 张同桌匿名 MVP 票' },
  career_1000: { name: '千局不灭', tier: 'gold', badgeKey: 'career_1000', desc: '累计记录 1000 个小局，并跨越 50 个打牌日' },
  highlight_100: { name: '高光永动机', tier: 'gold', badgeKey: 'highlight_100', desc: '优秀表现类荣誉累计达到 100 次' },
  rank_platinum: { name: '白金门票', tier: 'gold', badgeKey: 'rank_platinum', desc: '生涯最高 NaoRank 达到铂金段（1200 分）' },
  rank_diamond: { name: '钻石恒久远', tier: 'gold', badgeKey: 'rank_diamond', desc: '生涯最高 NaoRank 达到钻石段（1400 分）' },
  rank_king: { name: '王者降临', tier: 'gold', badgeKey: 'rank_king', desc: '生涯最高 NaoRank 达到王者段（1600 分）' },
  career_2000: { name: '两千局长明', tier: 'gold', badgeKey: 'career_2000', desc: '累计记录 2000 个小局，并跨越 100 个打牌日' },
  all_modes_10: { name: '三界全通', tier: 'gold', badgeKey: 'all_modes_10', desc: '4 人、6 人和 8 人局各完成至少 10 场' },
  relations_30: { name: '牌友遍天下', tier: 'gold', badgeKey: 'relations_30', desc: '与至少 30 位不同牌友同桌' },
  mvp_25: { name: '民选传奇', tier: 'gold', badgeKey: 'mvp_25', desc: '累计获得 25 张同桌匿名 MVP 票' },
  wins_25: { name: '通关专业户', tier: 'gold', badgeKey: 'wins_25', desc: '累计通关 25 场正式牌局' },
  firsts_50: { name: '头游收割机', tier: 'gold', badgeKey: 'firsts_50', desc: '累计拿到 50 次头游' },
  solo_carry_10: { name: '孤勇者十巡', tier: 'gold', badgeKey: 'solo_carry_10', desc: '在 10 场牌局获得「纯纯孤勇者」' },
  team_honors_20: { name: '团魂发动机', tier: 'gold', badgeKey: 'team_honors_20', desc: '团队类荣誉累计达到 20 次' },
  naoma_platinum: { name: '闹麻全满贯', tier: 'platinum', badgeKey: 'naoma_platinum', desc: '解锁其余全部 31 项生涯奖杯' }
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
export const PROOF_BOUND_ACHIEVEMENTS = Object.freeze([
  'rank_gold', 'rank_platinum', 'rank_diamond', 'rank_king', 'naoma_platinum'
]);

function relationKeyIsSafe(key) {
  return typeof key === 'string' && key.trim().length > 0 && !UNSAFE_RELATION_KEYS.has(key.trim().toLowerCase());
}

function relationHasGames(value) {
  return value && typeof value === 'object' && achievementSafeCount(value.games) > 0;
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
  const normalizedHonors = normalizeHonorCounter(playerStats.honors || {});
  const countCategory = (category) => CURRENT_HONOR_TITLES.reduce((total, title) => (
    honorCategoryForTitle(title) === category ? total + achievementSafeCount(normalizedHonors[title]) : total
  ), 0);
  const countHonor = (key) => achievementSafeCount(normalizedHonors[HONOR_TITLES_BY_KEY[key]]);
  const ladderAuthoritative = ladder.engine === 'team-first-v3' && ladder.stale !== true && Number.isFinite(Number(ladder.peak));
  return {
    matches: achievementSafeCount(playerStats.matchesTotal ?? playerStats.sessionsPlayed ?? playerStats.gamesPlayed),
    hands: achievementSafeCount(playerStats.totalGames ?? playerStats.progress?.hands),
    days: achievementSafeCount(playerStats.gameDays ?? playerStats.progress?.nights),
    streak: achievementSafeCount(playerStats.longestWinStreak),
    mvpVotes: achievementSafeCount(playerStats.mvpVotes),
    honors: countCurrentHonors(normalizedHonors),
    highlightHonors: countCategory('personal_performance'),
    teamHonors: countCategory('team'),
    roastHonors: countCategory('personal_roast'),
    comebackHonors: countHonor('bounce_back'),
    cleanSheetHonors: countHonor('clean_sheet'),
    soloCarryHonors: countHonor('solo_carry'),
    relations: countDistinctProfileRelations(playerStats),
    wins: achievementSafeCount(playerStats.sessionsWon),
    firsts: achievementSafeCount(playerStats.firstPlaceCount),
    mode4: achievementSafeCount(mode['4P']), mode6: achievementSafeCount(mode['6P']), mode8: achievementSafeCount(mode['8P']),
    ladderAuthoritative,
    ladderPeak: ladderAuthoritative ? achievementSafeCount(ladder.peak) : 0
  };
}

function rankProgress(m, id, threshold) {
  return {
    id,
    unlocked: m.ladderAuthoritative && m.ladderPeak >= threshold,
    progressPct: m.ladderAuthoritative ? percent(safeRatio(Math.max(0, m.ladderPeak - 400), threshold - 400)) : 0,
    progressText: m.ladderAuthoritative ? `最高 NaoRank ${Math.min(m.ladderPeak, threshold)}/${threshold}` : '等待权威天梯同步'
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
    { id: 'highlight_5', unlocked: m.highlightHonors >= 5,
      progressPct: percent(safeRatio(m.highlightHonors, 5)), progressText: `优秀表现荣誉 ${Math.min(m.highlightHonors, 5)}/5` },
    { id: 'highlight_10', unlocked: m.highlightHonors >= 10,
      progressPct: percent(safeRatio(m.highlightHonors, 10)), progressText: `优秀表现荣誉 ${Math.min(m.highlightHonors, 10)}/10` },
    { id: 'career_500', unlocked: m.hands >= 500 && m.days >= 30,
      progressPct: percent(safeRatio(m.hands, 500), safeRatio(m.days, 30)),
      progressText: `小局 ${Math.min(m.hands, 500)}/500 · 打牌日 ${Math.min(m.days, 30)}/30` },
    { id: 'win_streak_5', unlocked: m.streak >= 5,
      progressPct: percent(safeRatio(m.streak, 5)), progressText: `最长连胜 ${Math.min(m.streak, 5)}/5` },
    { id: 'relations_15', unlocked: m.relations >= 15,
      progressPct: percent(safeRatio(m.relations, 15)), progressText: `不同牌友 ${Math.min(m.relations, 15)}/15` },
    { id: 'all_modes_3', unlocked: modeMin >= 3,
      progressPct: percent(safeRatio(modeMin, 3)), progressText: `各模式最低完成 ${Math.min(modeMin, 3)}/3 场` },
    { id: 'highlight_20', unlocked: m.highlightHonors >= 20,
      progressPct: percent(safeRatio(m.highlightHonors, 20)), progressText: `优秀表现荣誉 ${Math.min(m.highlightHonors, 20)}/20` },
    { id: 'highlight_50', unlocked: m.highlightHonors >= 50,
      progressPct: percent(safeRatio(m.highlightHonors, 50)), progressText: `优秀表现荣誉 ${Math.min(m.highlightHonors, 50)}/50` },
    { id: 'comeback_10', unlocked: m.comebackHonors >= 10,
      progressPct: percent(safeRatio(m.comebackHonors, 10)), progressText: `医学奇迹 ${Math.min(m.comebackHonors, 10)}/10 场` },
    { id: 'clean_sheet_10', unlocked: m.cleanSheetHonors >= 10,
      progressPct: percent(safeRatio(m.cleanSheetHonors, 10)), progressText: `顶级不粘锅 ${Math.min(m.cleanSheetHonors, 10)}/10 场` },
    { id: 'roast_honors_50', unlocked: m.roastHonors >= 50,
      progressPct: percent(safeRatio(m.roastHonors, 50)), progressText: `自嘲荣誉 ${Math.min(m.roastHonors, 50)}/50` },
    { id: 'win_streak_8', unlocked: m.streak >= 8,
      progressPct: percent(safeRatio(m.streak, 8)), progressText: `最长连胜 ${Math.min(m.streak, 8)}/8` },
    rankProgress(m, 'rank_gold', 1000),
    { id: 'mvp_10', unlocked: m.mvpVotes >= 10,
      progressPct: percent(safeRatio(m.mvpVotes, 10)), progressText: `累计 MVP 票 ${Math.min(m.mvpVotes, 10)}/10` },
    { id: 'career_1000', unlocked: m.hands >= 1000 && m.days >= 50,
      progressPct: percent(safeRatio(m.hands, 1000), safeRatio(m.days, 50)),
      progressText: `小局 ${Math.min(m.hands, 1000)}/1000 · 打牌日 ${Math.min(m.days, 50)}/50` },
    { id: 'highlight_100', unlocked: m.highlightHonors >= 100,
      progressPct: percent(safeRatio(m.highlightHonors, 100)), progressText: `优秀表现荣誉 ${Math.min(m.highlightHonors, 100)}/100` },
    rankProgress(m, 'rank_platinum', 1200),
    rankProgress(m, 'rank_diamond', 1400),
    rankProgress(m, 'rank_king', 1600),
    { id: 'career_2000', unlocked: m.hands >= 2000 && m.days >= 100,
      progressPct: percent(safeRatio(m.hands, 2000), safeRatio(m.days, 100)),
      progressText: `小局 ${Math.min(m.hands, 2000)}/2000 · 打牌日 ${Math.min(m.days, 100)}/100` },
    { id: 'all_modes_10', unlocked: modeMin >= 10,
      progressPct: percent(safeRatio(modeMin, 10)), progressText: `各模式最低完成 ${Math.min(modeMin, 10)}/10 场` },
    { id: 'relations_30', unlocked: m.relations >= 30,
      progressPct: percent(safeRatio(m.relations, 30)), progressText: `不同牌友 ${Math.min(m.relations, 30)}/30` },
    { id: 'mvp_25', unlocked: m.mvpVotes >= 25,
      progressPct: percent(safeRatio(m.mvpVotes, 25)), progressText: `累计 MVP 票 ${Math.min(m.mvpVotes, 25)}/25` },
    { id: 'wins_25', unlocked: m.wins >= 25,
      progressPct: percent(safeRatio(m.wins, 25)), progressText: `累计通关 ${Math.min(m.wins, 25)}/25 场` },
    { id: 'firsts_50', unlocked: m.firsts >= 50,
      progressPct: percent(safeRatio(m.firsts, 50)), progressText: `累计头游 ${Math.min(m.firsts, 50)}/50` },
    { id: 'solo_carry_10', unlocked: m.soloCarryHonors >= 10,
      progressPct: percent(safeRatio(m.soloCarryHonors, 10)), progressText: `纯纯孤勇者 ${Math.min(m.soloCarryHonors, 10)}/10 场` },
    { id: 'team_honors_20', unlocked: m.teamHonors >= 20,
      progressPct: percent(safeRatio(m.teamHonors, 20)), progressText: `团队荣誉 ${Math.min(m.teamHonors, 20)}/20` }
  ];
}

export function achievementProgress(playerStats = {}) {
  const persisted = new Set(migrateAchievementStorage(playerStats.achievementsEver).achievementsEver);
  const base = baseProgress(playerStats).map((row) => {
    const permanentlyUnlocked = persisted.has(row.id);
    return {
      ...ACHIEVEMENTS[row.id],
      ...row,
      unlocked: row.unlocked || permanentlyUnlocked,
      progressPct: permanentlyUnlocked ? 100 : row.progressPct,
      progressText: permanentlyUnlocked && !row.unlocked ? '已永久解锁' : row.progressText
    };
  });
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

export function persistableAchievementIds(ids = []) {
  const active = new Set(Object.keys(ACHIEVEMENTS));
  const proofBound = new Set(PROOF_BOUND_ACHIEVEMENTS);
  return cleanIds(ids).filter((id) => active.has(id) && !proofBound.has(id));
}

export function migrateAchievementStorage(achievementsEver = [], legacyArchive = []) {
  return {
    version: ACHIEVEMENT_SCHEMA_VERSION,
    achievementsEver: persistableAchievementIds(achievementsEver),
    // 旧版与无权威证明的段位奖杯都是可重算派生值；V3 不保留影子奖杯。
    legacyArchive: []
  };
}

export function getNewAchievements(oldAchievements = [], newAchievements = []) {
  const oldAchievementSet = new Set(cleanIds(oldAchievements));
  return cleanIds(newAchievements).filter((id) => !oldAchievementSet.has(id));
}
